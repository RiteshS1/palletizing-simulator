// Hand-built stacks where we know the right answer.
#include <gtest/gtest.h>

#include "pal/pallet_state.hpp"

using namespace pal;

namespace {
// Box with given size and weight, placed at (x, y, z), not rotated.
Placement at(int id, int x, int y, int z, int w, int d, int h, double kg) {
    return Placement{Box{id, w, d, h, kg}, Vec3{x, y, z}, false};
}
}  // namespace

TEST(Stability, FirstBoxOnDeck) {
    PalletState s;
    const CheckResult r = s.tryPlace(at(0, 0, 0, 0, 400, 300, 200, 10));
    EXPECT_TRUE(r.ok());
    EXPECT_DOUBLE_EQ(r.supportRatio, 1.0);
    EXPECT_EQ(s.placements().size(), 1u);
}

TEST(Stability, OutOfBounds) {
    PalletState s;
    EXPECT_EQ(s.check(at(0, 1000, 0, 0, 400, 300, 200, 10)).violation, Violation::OutOfBounds);
    EXPECT_EQ(s.check(at(0, 0, 0, 1700, 400, 300, 200, 10)).violation, Violation::OutOfBounds);
}

TEST(Stability, OverlapRejectedTouchingAllowed) {
    PalletState s;
    s.tryPlace(at(0, 0, 0, 0, 400, 300, 200, 10));
    EXPECT_EQ(s.check(at(1, 200, 0, 0, 400, 300, 200, 10)).violation, Violation::Overlap);
    EXPECT_TRUE(s.check(at(1, 400, 0, 0, 400, 300, 200, 10)).ok());
}

TEST(Stability, FloatingBoxHasNoSupport) {
    PalletState s;
    const CheckResult r = s.check(at(0, 0, 0, 100, 400, 300, 200, 10));
    EXPECT_EQ(r.violation, Violation::InsufficientSupport);
    EXPECT_DOUBLE_EQ(r.supportRatio, 0.0);
}

TEST(Stability, StackedAndOverhang) {
    PalletState s;
    s.tryPlace(at(0, 0, 0, 0, 400, 400, 200, 20));
    EXPECT_TRUE(s.tryPlace(at(1, 0, 0, 200, 400, 400, 200, 10)).ok());

    PalletState s2;
    s2.tryPlace(at(0, 0, 0, 0, 400, 400, 200, 20));
    const CheckResult half = s2.check(at(1, 200, 0, 200, 400, 400, 200, 10));
    EXPECT_EQ(half.violation, Violation::InsufficientSupport);
    EXPECT_NEAR(half.supportRatio, 0.5, 1e-9);
    EXPECT_TRUE(s2.check(at(1, 100, 0, 200, 400, 400, 200, 10)).ok());  // exactly 75%
}

TEST(Stability, CenterOutsideSupportPolygonTipsOver) {
    Rules lenient;
    lenient.minSupportRatio = 0.2;  // let the area rule pass so the polygon rule decides
    PalletState s({}, lenient);
    s.tryPlace(at(0, 0, 0, 0, 400, 400, 200, 20));
    EXPECT_EQ(s.check(at(1, 300, 0, 200, 400, 400, 200, 10)).violation, Violation::CenterUnsupported);
}

TEST(Stability, BridgeOverGapIsStable) {
    Rules lenient;
    lenient.minSupportRatio = 0.4;
    PalletState s({}, lenient);
    s.tryPlace(at(0, 0, 0, 0, 100, 400, 200, 20));
    s.tryPlace(at(1, 300, 0, 0, 100, 400, 200, 20));
    EXPECT_TRUE(s.tryPlace(at(2, 0, 0, 200, 400, 400, 200, 10)).ok());  // centre inside the hull
}

TEST(Stability, HeavyOnLightRejected) {
    PalletState s;
    s.tryPlace(at(0, 0, 0, 0, 400, 400, 200, 5));
    EXPECT_EQ(s.check(at(1, 0, 0, 200, 400, 400, 200, 12)).violation, Violation::LoadBearing);
    EXPECT_TRUE(s.check(at(1, 0, 0, 200, 400, 400, 200, 5)).ok());
}

TEST(Stability, BoxAboveBlocksTopDownApproach) {
    PalletState s;
    s.tryPlace(at(0, 0, 0, 0, 400, 400, 200, 20));
    s.tryPlace(at(1, 100, 0, 200, 400, 400, 200, 10));  // overhangs x 400..500
    EXPECT_EQ(s.check(at(2, 400, 0, 0, 200, 400, 200, 5)).violation, Violation::Unreachable);
    EXPECT_TRUE(s.check(at(2, 500, 0, 0, 200, 400, 200, 5)).ok());
}

TEST(Stability, MaxLoad) {
    PalletSpec light;
    light.maxLoad = 25.0;
    PalletState s(light);
    s.tryPlace(at(0, 0, 0, 0, 400, 400, 200, 20));
    EXPECT_EQ(s.check(at(1, 400, 0, 0, 400, 400, 200, 10)).violation, Violation::Overweight);
}

TEST(Stability, CenterOfMassTracksWeights) {
    PalletState s;
    s.tryPlace(at(0, 0, 0, 0, 200, 200, 200, 10));
    s.tryPlace(at(1, 400, 0, 0, 200, 200, 200, 30));
    const Point3d com = s.centerOfMass();
    EXPECT_NEAR(com.x, 400.0, 1e-9);  // (10*100 + 30*500) / 40
    EXPECT_NEAR(com.y, 100.0, 1e-9);
    EXPECT_DOUBLE_EQ(s.totalWeight(), 40.0);
    EXPECT_EQ(s.stackHeight(), 200);
}
