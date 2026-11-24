// Invariants of the order-to-pallet layer, checked for both policies.
#include <gtest/gtest.h>

#include <algorithm>
#include <set>

#include "pal/metrics.hpp"
#include "pal/wes.hpp"

using namespace pal;

namespace {
WesConfig policy(WesPolicy p) {
    WesConfig c;
    c.policy = p;
    return c;
}
}  // namespace

TEST(Wes, EveryOrderHandledOnceOnOnePallet) {
    for (WesPolicy p : {WesPolicy::OrderByOrder, WesPolicy::Waves}) {
        for (uint32_t seed = 1; seed <= 8; ++seed) {
            auto orders = generateOrders(20, seed);
            WesResult r = runWes(orders, policy(p));
            std::set<int> processed;
            int steps = 0;
            for (const OrderRecord& o : r.orders) {
                processed.insert(o.processed);
                if (o.rejected) continue;
                int onPallet = 0;  // every box of the order is on the SAME pallet
                for (const StepRecord& s : r.pallets[o.pallet].steps) onPallet += s.orderId == o.order.id;
                EXPECT_TRUE(onPallet == int(o.order.boxes.size()));
                steps += onPallet;
            }
            EXPECT_TRUE(processed.size() == orders.size());  // a permutation: nobody handled twice
            EXPECT_TRUE(steps == r.totalSteps);              // and no box from nowhere
        }
    }
}

TEST(Wes, PalletsHaveOneDestinationAndValidStacks) {
    for (WesPolicy p : {WesPolicy::OrderByOrder, WesPolicy::Waves}) {
        auto orders = generateOrders(30, 3);
        WesResult r = runWes(orders, policy(p));
        for (const PalletRecord& pr : r.pallets) {
            PalletState replay(pr.state.spec(), pr.state.rules());
            for (const StepRecord& s : pr.steps) {
                EXPECT_TRUE(orders[s.orderId].destination == pr.destination);
                EXPECT_TRUE(replay.tryPlace(s.placement).ok());  // the robot's order is physically valid
            }
            EXPECT_TRUE(!pr.open);  // everything shipped by the end
        }
    }
}

TEST(Wes, StationLimitIsRespected) {
    WesConfig cfg = policy(WesPolicy::OrderByOrder);
    cfg.stations = 3;
    WesResult r = runWes(generateOrders(40, 11), cfg);
    for (int step = 0; step < r.totalSteps; ++step) {
        int open = 0;  // pallets started at or before this step and not yet shipped
        for (const PalletRecord& p : r.pallets) {
            if (!p.steps.empty() && p.steps.front().step <= step && step < p.closedAfterStep) ++open;
        }
        EXPECT_TRUE(open <= cfg.stations);
    }
}

TEST(Wes, QueueOrderIsPriorityThenDeadline) {
    auto orders = generateOrders(15, 5);
    for (Order& o : orders) o.release = 0;  // everyone waiting at once: pure queue order
    WesResult r = runWes(orders, policy(WesPolicy::OrderByOrder));
    std::vector<const OrderRecord*> seq;
    for (const OrderRecord& o : r.orders) seq.push_back(&o);
    std::sort(seq.begin(), seq.end(), [](auto a, auto b) { return a->processed < b->processed; });
    for (size_t i = 1; i < seq.size(); ++i) {
        const Order &a = seq[i - 1]->order, &b = seq[i]->order;
        EXPECT_TRUE(a.priority < b.priority || (a.priority == b.priority && a.deadline <= b.deadline));
    }
}

TEST(Wes, WavesFillPalletsBetter) {
    double fillOrder = 0, fillWaves = 0;
    int nOrder = 0, nWaves = 0;
    for (uint32_t seed = 1; seed <= 6; ++seed) {
        auto orders = generateOrders(30, seed);
        for (const auto& p : runWes(orders, policy(WesPolicy::OrderByOrder)).pallets) {
            fillOrder += computeMetrics(PackResult{"", p.state, {}}, 0).fillOfMax;
            ++nOrder;
        }
        for (const auto& p : runWes(orders, policy(WesPolicy::Waves)).pallets) {
            fillWaves += computeMetrics(PackResult{"", p.state, {}}, 0).fillOfMax;
            ++nWaves;
        }
    }
    EXPECT_TRUE(nWaves < nOrder);                          // fewer pallets...
    EXPECT_TRUE(fillWaves / nWaves > fillOrder / nOrder);  // ...each one fuller
}

TEST(Wes, Deterministic) {
    auto orders = generateOrders(20, 9);
    WesResult a = runWes(orders), b = runWes(orders);
    EXPECT_TRUE(a.totalSteps == b.totalSteps && a.pallets.size() == b.pallets.size());
    EXPECT_TRUE(a.makespan == b.makespan);
}
