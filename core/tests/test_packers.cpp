// Property tests: instead of one known answer, check rules that must hold for EVERY plan,
// across hundreds of random box sets.
#include <algorithm>
#include <set>

#include "generator.hpp"
#include "json.hpp"
#include "metrics.hpp"
#include "testing.hpp"

using namespace pal;

// Verify a plan with checks that do NOT reuse the packer's own logic where possible
// (an independent "test oracle"), so a bug in the packer can't hide itself.
static bool planIsValid(const PackResult& r, const std::vector<Box>& offered) {
    const auto& placed = r.pallet.placements();
    bool ok = true;

    // 1. Every offered box appears exactly once: either placed or unplaced.
    std::multiset<int> ids;
    for (const Placement& p : placed) ids.insert(p.box.id);
    for (const Box& b : r.unplaced) ids.insert(b.id);
    std::multiset<int> expected;
    for (const Box& b : offered) expected.insert(b.id);
    ok = ok && ids == expected;

    // 2. Brute-force pairwise: no two boxes intersect, all inside the pallet. O(n^2), fine in tests.
    AABB space = r.pallet.spec().usableSpace();
    for (size_t i = 0; i < placed.size(); ++i) {
        ok = ok && contains(space, placed[i].aabb());
        for (size_t j = i + 1; j < placed.size(); ++j) {
            ok = ok && !intersects(placed[i].aabb(), placed[j].aabb());
        }
    }

    // 3. Replay the plan step by step on an empty pallet: every step must pass every rule
    //    at the moment it is placed (this is what the robot would experience).
    PalletState replay(r.pallet.spec(), r.pallet.rules());
    for (const Placement& p : placed) ok = ok && replay.tryPlace(p).ok();
    return ok;
}

TEST(greedy_plans_are_valid_for_200_seeds) {
    int bad = 0;
    for (uint32_t seed = 1; seed <= 200; ++seed) {
        auto boxes = generateBoxes(50, seed);
        if (!planIsValid(packGreedyLayer(boxes), boxes)) ++bad;
    }
    CHECK(bad == 0);
}

TEST(ep_plans_are_valid_for_100_seeds) {
    int bad = 0;
    for (uint32_t seed = 1; seed <= 100; ++seed) {
        auto boxes = generateBoxes(50, seed);
        if (!planIsValid(packExtremePoints(boxes), boxes)) ++bad;
    }
    CHECK(bad == 0);
}

TEST(packers_are_deterministic) {
    auto boxes = generateBoxes(40, 123);
    for (int algo = 0; algo < 2; ++algo) {
        PackResult a = algo ? packExtremePoints(boxes) : packGreedyLayer(boxes);
        PackResult b = algo ? packExtremePoints(boxes) : packGreedyLayer(boxes);
        const auto &pa = a.pallet.placements(), &pb = b.pallet.placements();
        bool same = pa.size() == pb.size();
        for (size_t i = 0; same && i < pa.size(); ++i) {
            same = pa[i].box.id == pb[i].box.id && pa[i].pos == pb[i].pos && pa[i].rotated == pb[i].rotated;
        }
        CHECK(same);
    }
}

TEST(ep_beats_greedy_on_average) {
    int64_t greedyVol = 0, epVol = 0;
    for (uint32_t seed = 1; seed <= 30; ++seed) {
        auto boxes = generateBoxes(70, seed);  // more than fits: who loads more?
        greedyVol += computeMetrics(packGreedyLayer(boxes), 0).placedVolume;
        epVol += computeMetrics(packExtremePoints(boxes), 0).placedVolume;
    }
    CHECK(epVol > greedyVol);
}

TEST(json_writer_commas_and_nesting) {
    JsonWriter j;
    j.beginObject().key("a").value(1).key("b").beginArray().value(2).value(3.5).endArray()
        .key("c").beginObject().endObject().key("s").value("q\"x").endObject();
    CHECK(j.str() == R"({"a":1,"b":[2,3.5],"c":{},"s":"q\"x"})");
}
