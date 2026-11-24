// Property tests: rules that must hold for EVERY plan, swept over many random box sets with
// GoogleTest's parameterized tests (one test case per seed, so a failure names its seed).
#include <gtest/gtest.h>

#include <set>

#include "pal/generator.hpp"
#include "pal/metrics.hpp"
#include "pal/plan_io.hpp"

using namespace pal;

namespace {

// An independent "test oracle": checks that do not reuse the packer's logic where possible.
void expectValidPlan(const PackResult& r, const std::vector<Box>& offered) {
    const auto& placed = r.pallet.placements();

    std::multiset<int> ids, expected;  // every offered box exactly once: placed or unplaced
    for (const Placement& p : placed) ids.insert(p.box.id);
    for (const Box& b : r.unplaced) ids.insert(b.id);
    for (const Box& b : offered) expected.insert(b.id);
    EXPECT_EQ(ids, expected);

    const AABB space = r.pallet.spec().usableSpace();  // brute force O(n^2): no overlaps, all inside
    for (size_t i = 0; i < placed.size(); ++i) {
        EXPECT_TRUE(contains(space, placed[i].aabb()));
        for (size_t j = i + 1; j < placed.size(); ++j) {
            EXPECT_FALSE(intersects(placed[i].aabb(), placed[j].aabb())) << "boxes " << i << " and " << j;
        }
    }

    PalletState replay(r.pallet.spec(), r.pallet.rules());  // the robot's order is valid step by step
    for (const Placement& p : placed) EXPECT_TRUE(replay.tryPlace(p).ok());
}

class GreedySeeds : public ::testing::TestWithParam<uint32_t> {};
class ExtremePointSeeds : public ::testing::TestWithParam<uint32_t> {};

}  // namespace

TEST_P(GreedySeeds, PlanIsValid) {
    const auto boxes = generateBoxes(50, GetParam());
    expectValidPlan(packGreedyLayer(boxes), boxes);
}
INSTANTIATE_TEST_SUITE_P(Property, GreedySeeds, ::testing::Range(1u, 201u));

TEST_P(ExtremePointSeeds, PlanIsValid) {
    const auto boxes = generateBoxes(50, GetParam());
    expectValidPlan(packExtremePoints(boxes), boxes);
}
INSTANTIATE_TEST_SUITE_P(Property, ExtremePointSeeds, ::testing::Range(1u, 101u));

TEST(Packers, Deterministic) {
    const auto boxes = generateBoxes(40, 123);
    for (bool ep : {false, true}) {
        const PackResult a = ep ? packExtremePoints(boxes) : packGreedyLayer(boxes);
        const PackResult b = ep ? packExtremePoints(boxes) : packGreedyLayer(boxes);
        ASSERT_EQ(a.pallet.placements().size(), b.pallet.placements().size());
        for (size_t i = 0; i < a.pallet.placements().size(); ++i) {
            const auto &pa = a.pallet.placements()[i], &pb = b.pallet.placements()[i];
            EXPECT_EQ(pa.box.id, pb.box.id);
            EXPECT_EQ(pa.pos, pb.pos);
            EXPECT_EQ(pa.rotated, pb.rotated);
        }
    }
}

TEST(Packers, ExtremePointsBeatsGreedyOnAverage) {
    int64_t greedyVol = 0, epVol = 0;
    for (uint32_t seed = 1; seed <= 30; ++seed) {
        const auto boxes = generateBoxes(70, seed);  // more than fits: who loads more?
        greedyVol += computeMetrics(packGreedyLayer(boxes), 0).placedVolume;
        epVol += computeMetrics(packExtremePoints(boxes), 0).placedVolume;
    }
    EXPECT_GT(epVol, greedyVol);
}

TEST(PlanJson, HasPlanAndPoses) {
    const auto boxes = generateBoxes(10, 3);
    const PackResult r = packExtremePoints(boxes);
    const Json j = planToJson(r, computeMetrics(r, 0), boxes, 3);
    EXPECT_EQ(j["algorithm"], "extreme_points");
    ASSERT_EQ(j["placements"].size(), r.pallet.placements().size());
    EXPECT_EQ(j["placements"][0]["placePose"]["orientation"].size(), 4u);  // quaternion x, y, z, w
    EXPECT_EQ(j.begin().key(), "algorithm");  // ordered_json keeps insertion order
    // Extreme points exports the candidate points it considered; the chosen spot is one of them.
    const auto& first = j["placements"][0];
    ASSERT_TRUE(first.contains("candidates"));
    bool chosenIsCandidate = false;
    for (const auto& c : first["candidates"]) {
        chosenIsCandidate = chosenIsCandidate || (c[0] == first["x"] && c[1] == first["y"] && c[2] == first["z"]);
    }
    EXPECT_TRUE(chosenIsCandidate);
}
