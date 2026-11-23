#include "box.hpp"
#include "generator.hpp"
#include "geometry.hpp"
#include "pallet.hpp"
#include "testing.hpp"

using namespace pal;

static AABB makeBox(int x, int y, int z, int sx, int sy, int sz) {
    return AABB{{x, y, z}, {x + sx, y + sy, z + sz}};
}

TEST(overlap1D_basic) {
    CHECK(overlap1D(0, 10, 5, 15) == 5);   // partial overlap
    CHECK(overlap1D(0, 10, 10, 20) == 0);  // touching end-to-start: half-open, so no overlap
    CHECK(overlap1D(0, 10, 20, 30) == 0);  // gap
    CHECK(overlap1D(0, 10, 2, 4) == 2);    // one inside the other
}

TEST(aabb_intersection) {
    AABB a = makeBox(0, 0, 0, 100, 100, 100);
    CHECK(intersects(a, makeBox(50, 50, 50, 100, 100, 100)));    // corner overlap
    CHECK(!intersects(a, makeBox(100, 0, 0, 100, 100, 100)));    // side by side, touching
    CHECK(!intersects(a, makeBox(0, 0, 100, 100, 100, 100)));    // stacked on top, touching
    CHECK(!intersects(a, makeBox(50, 50, 200, 10, 10, 10)));     // above, overlaps in x and y only
    CHECK(intersects(a, makeBox(25, 25, 25, 10, 10, 10)));       // fully inside
}

TEST(footprint_overlap_area) {
    AABB bottom = makeBox(0, 0, 0, 400, 300, 200);
    AABB top = makeBox(200, 100, 200, 400, 300, 200);  // shifted half off
    CHECK(footprintOverlap(bottom, top) == 200 * 200);
    CHECK(footprintOverlap(bottom, makeBox(500, 0, 0, 10, 10, 10)) == 0);
}

TEST(containment_in_pallet) {
    PalletSpec pallet;
    AABB space = pallet.usableSpace();
    CHECK(contains(space, makeBox(0, 0, 0, 1200, 1000, 1800)));  // exactly fills it
    CHECK(!contains(space, makeBox(900, 0, 0, 400, 300, 200)));  // sticks out in x
    CHECK(!contains(space, makeBox(0, 0, 1700, 100, 100, 200))); // too tall
}

TEST(volume_uses_64bit) {
    PalletSpec pallet;
    // 1200 * 1000 * 1800 = 2,160,000,000 > INT32_MAX; would be negative with 32-bit math.
    CHECK(pallet.usableSpace().volume() == 2160000000LL);
}

TEST(rotation_swaps_footprint) {
    Box b{1, 400, 300, 250, 5.0};
    Placement p{b, {0, 0, 0}, false};
    CHECK(p.aabb().sizeX() == 400 && p.aabb().sizeY() == 300);
    p.rotated = true;
    CHECK(p.aabb().sizeX() == 300 && p.aabb().sizeY() == 400);
    CHECK(p.aabb().sizeZ() == 250);  // height never changes: boxes stay upright
}

TEST(generator_is_deterministic_and_in_range) {
    auto a = generateBoxes(100, 42);
    auto b = generateBoxes(100, 42);
    auto c = generateBoxes(100, 7);
    CHECK(a.size() == 100);

    bool sameAsA = true, differsFromC = false;
    for (size_t i = 0; i < a.size(); ++i) {
        sameAsA = sameAsA && a[i].w == b[i].w && a[i].d == b[i].d && a[i].h == b[i].h &&
                  a[i].weight == b[i].weight;
        differsFromC = differsFromC || a[i].w != c[i].w || a[i].h != c[i].h;
    }
    CHECK(sameAsA);
    CHECK(differsFromC);

    GeneratorParams p;
    for (const Box& box : a) {
        CHECK(box.w >= p.minW && box.w <= p.maxW && box.w % p.step == 0);
        CHECK(box.d >= p.minD && box.d <= p.maxD && box.d % p.step == 0);
        CHECK(box.h >= p.minH && box.h <= p.maxH && box.h % p.step == 0);
        CHECK(box.weight > 0.0);
    }
}
