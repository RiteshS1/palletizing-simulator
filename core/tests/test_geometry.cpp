// Geometry basics: intervals, AABBs, footprints, containment, rotation, the generator.
#include <gtest/gtest.h>

#include "pal/box.hpp"
#include "pal/generator.hpp"
#include "pal/geometry.hpp"
#include "pal/pallet.hpp"

using namespace pal;

namespace {
AABB makeBox(int x, int y, int z, int sx, int sy, int sz) { return AABB{{x, y, z}, {x + sx, y + sy, z + sz}}; }
}  // namespace

TEST(Geometry, Overlap1D) {
    EXPECT_EQ(overlap1D(0, 10, 5, 15), 5);   // partial overlap
    EXPECT_EQ(overlap1D(0, 10, 10, 20), 0);  // touching: half-open, so no overlap
    EXPECT_EQ(overlap1D(0, 10, 20, 30), 0);  // gap
    EXPECT_EQ(overlap1D(0, 10, 2, 4), 2);    // one inside the other
}

TEST(Geometry, AabbIntersection) {
    const AABB a = makeBox(0, 0, 0, 100, 100, 100);
    EXPECT_TRUE(intersects(a, makeBox(50, 50, 50, 100, 100, 100)));   // corner overlap
    EXPECT_FALSE(intersects(a, makeBox(100, 0, 0, 100, 100, 100)));  // side by side, touching
    EXPECT_FALSE(intersects(a, makeBox(0, 0, 100, 100, 100, 100)));  // stacked, touching
    EXPECT_FALSE(intersects(a, makeBox(50, 50, 200, 10, 10, 10)));   // above: overlaps in x, y only
    EXPECT_TRUE(intersects(a, makeBox(25, 25, 25, 10, 10, 10)));     // fully inside
}

TEST(Geometry, FootprintOverlapArea) {
    const AABB bottom = makeBox(0, 0, 0, 400, 300, 200);
    EXPECT_EQ(footprintOverlap(bottom, makeBox(200, 100, 200, 400, 300, 200)), 200 * 200);
    EXPECT_EQ(footprintOverlap(bottom, makeBox(500, 0, 0, 10, 10, 10)), 0);
}

TEST(Geometry, ContainmentInPallet) {
    const AABB space = PalletSpec{}.usableSpace();
    EXPECT_TRUE(contains(space, makeBox(0, 0, 0, 1200, 1000, 1800)));
    EXPECT_FALSE(contains(space, makeBox(900, 0, 0, 400, 300, 200)));   // sticks out in x
    EXPECT_FALSE(contains(space, makeBox(0, 0, 1700, 100, 100, 200)));  // too tall
}

TEST(Geometry, VolumeUses64Bit) {
    // 1200 * 1000 * 1800 = 2,160,000,000 > INT32_MAX: would overflow with 32-bit math.
    EXPECT_EQ(PalletSpec{}.usableSpace().volume(), 2160000000LL);
}

TEST(Geometry, RotationSwapsFootprintNotHeight) {
    const Box b{1, 400, 300, 250, 5.0};
    Placement p{b, {0, 0, 0}, false};
    EXPECT_EQ(p.aabb().sizeX(), 400);
    EXPECT_EQ(p.aabb().sizeY(), 300);
    p.rotated = true;
    EXPECT_EQ(p.aabb().sizeX(), 300);
    EXPECT_EQ(p.aabb().sizeY(), 400);
    EXPECT_EQ(p.aabb().sizeZ(), 250);  // boxes stay upright
}

TEST(Generator, DeterministicAndInRange) {
    const auto a = generateBoxes(100, 42), b = generateBoxes(100, 42), c = generateBoxes(100, 7);
    ASSERT_EQ(a.size(), 100u);
    bool differs = false;
    const GeneratorParams p;
    for (size_t i = 0; i < a.size(); ++i) {
        EXPECT_EQ(a[i].w, b[i].w);
        EXPECT_EQ(a[i].h, b[i].h);
        EXPECT_DOUBLE_EQ(a[i].weight, b[i].weight);
        differs = differs || a[i].w != c[i].w || a[i].h != c[i].h;
        EXPECT_TRUE(a[i].w >= p.minW && a[i].w <= p.maxW && a[i].w % p.step == 0);
        EXPECT_TRUE(a[i].d >= p.minD && a[i].d <= p.maxD && a[i].d % p.step == 0);
        EXPECT_TRUE(a[i].h >= p.minH && a[i].h <= p.maxH && a[i].h % p.step == 0);
        EXPECT_GT(a[i].weight, 0.0);
    }
    EXPECT_TRUE(differs);
}
