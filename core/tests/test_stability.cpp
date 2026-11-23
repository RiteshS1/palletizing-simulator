// Hand-built stacks where we know the right answer.
#include <cmath>

#include "pallet_state.hpp"
#include "testing.hpp"

using namespace pal;

// Box with given size and weight, placed at (x, y, z), not rotated.
static Placement at(int id, int x, int y, int z, int w, int d, int h, double kg) {
    return Placement{Box{id, w, d, h, kg}, Vec3{x, y, z}, false};
}

TEST(first_box_on_deck_is_ok) {
    PalletState s;
    CheckResult r = s.tryPlace(at(0, 0, 0, 0, 400, 300, 200, 10));
    CHECK(r.ok());
    CHECK(r.supportRatio == 1.0);
    CHECK(s.placements().size() == 1);
}

TEST(out_of_bounds) {
    PalletState s;
    CHECK(s.check(at(0, 1000, 0, 0, 400, 300, 200, 10)).violation == Violation::OutOfBounds);
    CHECK(s.check(at(0, 0, 0, 1700, 400, 300, 200, 10)).violation == Violation::OutOfBounds);
}

TEST(overlap_rejected_touching_allowed) {
    PalletState s;
    s.tryPlace(at(0, 0, 0, 0, 400, 300, 200, 10));
    CHECK(s.check(at(1, 200, 0, 0, 400, 300, 200, 10)).violation == Violation::Overlap);
    CHECK(s.check(at(1, 400, 0, 0, 400, 300, 200, 10)).ok());  // side by side, faces touch
}

TEST(floating_box_has_no_support) {
    PalletState s;
    CheckResult r = s.check(at(0, 0, 0, 100, 400, 300, 200, 10));
    CHECK(r.violation == Violation::InsufficientSupport);
    CHECK(r.supportRatio == 0.0);
}

TEST(stacked_and_overhang) {
    PalletState s;
    s.tryPlace(at(0, 0, 0, 0, 400, 400, 200, 20));
    CHECK(s.tryPlace(at(1, 0, 0, 200, 400, 400, 200, 10)).ok());  // perfectly on top

    PalletState s2;
    s2.tryPlace(at(0, 0, 0, 0, 400, 400, 200, 20));
    CheckResult half = s2.check(at(1, 200, 0, 200, 400, 400, 200, 10));  // half hangs off
    CHECK(half.violation == Violation::InsufficientSupport);
    CHECK(std::fabs(half.supportRatio - 0.5) < 1e-9);
    CHECK(s2.check(at(1, 100, 0, 200, 400, 400, 200, 10)).ok());  // 75% supported: exactly enough
}

TEST(center_outside_support_polygon_tips_over) {
    Rules lenient;
    lenient.minSupportRatio = 0.2;  // let the area rule pass so the center rule decides
    PalletState s({}, lenient);
    s.tryPlace(at(0, 0, 0, 0, 400, 400, 200, 20));
    // Only 25% of the base rests on the lower box, and the center (x=500) is beyond its edge (x=400).
    CheckResult r = s.check(at(1, 300, 0, 200, 400, 400, 200, 10));
    CHECK(r.violation == Violation::CenterUnsupported);
}

TEST(bridge_over_gap_is_stable) {
    Rules lenient;
    lenient.minSupportRatio = 0.4;
    PalletState s({}, lenient);
    s.tryPlace(at(0, 0, 0, 0, 100, 400, 200, 20));    // left pillar
    s.tryPlace(at(1, 300, 0, 0, 100, 400, 200, 20));  // right pillar, gap in between
    // 50% supported, center (x=200) sits over the gap but INSIDE the convex hull of both contacts.
    CheckResult r = s.tryPlace(at(2, 0, 0, 200, 400, 400, 200, 10));
    CHECK(r.ok());
}

TEST(heavy_box_on_light_box_rejected) {
    PalletState s;
    s.tryPlace(at(0, 0, 0, 0, 400, 400, 200, 5));
    CHECK(s.check(at(1, 0, 0, 200, 400, 400, 200, 12)).violation == Violation::LoadBearing);
    CHECK(s.check(at(1, 0, 0, 200, 400, 400, 200, 5)).ok());  // equal weight is fine
}

TEST(box_above_blocks_top_down_approach) {
    PalletState s;
    s.tryPlace(at(0, 0, 0, 0, 400, 400, 200, 20));
    s.tryPlace(at(1, 100, 0, 200, 400, 400, 200, 10));  // overhangs x 400..500
    // A box on the deck under that overhang: geometrically free, but the gripper can't reach it.
    CHECK(s.check(at(2, 400, 0, 0, 200, 400, 200, 5)).violation == Violation::Unreachable);
    CHECK(s.check(at(2, 500, 0, 0, 200, 400, 200, 5)).ok());  // just past the overhang
}

TEST(max_load) {
    PalletSpec light;
    light.maxLoad = 25.0;
    PalletState s(light);
    s.tryPlace(at(0, 0, 0, 0, 400, 400, 200, 20));
    CHECK(s.check(at(1, 400, 0, 0, 400, 400, 200, 10)).violation == Violation::Overweight);
}

TEST(center_of_mass_tracks_weights) {
    PalletState s;
    s.tryPlace(at(0, 0, 0, 0, 200, 200, 200, 10));    // center (100, 100, 100)
    s.tryPlace(at(1, 400, 0, 0, 200, 200, 200, 30));  // center (500, 100, 100)
    Point3d com = s.centerOfMass();
    CHECK(std::fabs(com.x - 400.0) < 1e-9);  // (10*100 + 30*500) / 40
    CHECK(std::fabs(com.y - 100.0) < 1e-9);
    CHECK(s.totalWeight() == 40.0);
    CHECK(s.stackHeight() == 200);
}
