// Invariants of the order-to-pallet layer, checked for both policies.
#include <algorithm>
#include <set>

#include "metrics.hpp"
#include "testing.hpp"
#include "wes.hpp"

using namespace pal;

static WesConfig policy(WesPolicy p) {
    WesConfig c;
    c.policy = p;
    return c;
}

TEST(every_order_handled_once_on_one_pallet) {
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
                CHECK(onPallet == int(o.order.boxes.size()));
                steps += onPallet;
            }
            CHECK(processed.size() == orders.size());  // a permutation: nobody handled twice
            CHECK(steps == r.totalSteps);              // and no box from nowhere
        }
    }
}

TEST(pallets_have_one_destination_and_valid_stacks) {
    for (WesPolicy p : {WesPolicy::OrderByOrder, WesPolicy::Waves}) {
        auto orders = generateOrders(30, 3);
        WesResult r = runWes(orders, policy(p));
        for (const PalletRecord& pr : r.pallets) {
            PalletState replay(pr.state.spec(), pr.state.rules());
            for (const StepRecord& s : pr.steps) {
                CHECK(orders[s.orderId].destination == pr.destination);
                CHECK(replay.tryPlace(s.placement).ok());  // the robot's order is physically valid
            }
            CHECK(!pr.open);  // everything shipped by the end
        }
    }
}

TEST(station_limit_is_respected) {
    WesConfig cfg = policy(WesPolicy::OrderByOrder);
    cfg.stations = 3;
    WesResult r = runWes(generateOrders(40, 11), cfg);
    for (int step = 0; step < r.totalSteps; ++step) {
        int open = 0;  // pallets started at or before this step and not yet shipped
        for (const PalletRecord& p : r.pallets) {
            if (!p.steps.empty() && p.steps.front().step <= step && step < p.closedAfterStep) ++open;
        }
        CHECK(open <= cfg.stations);
    }
}

TEST(queue_order_is_priority_then_deadline) {
    auto orders = generateOrders(15, 5);
    for (Order& o : orders) o.release = 0;  // everyone waiting at once: pure queue order
    WesResult r = runWes(orders, policy(WesPolicy::OrderByOrder));
    std::vector<const OrderRecord*> seq;
    for (const OrderRecord& o : r.orders) seq.push_back(&o);
    std::sort(seq.begin(), seq.end(), [](auto a, auto b) { return a->processed < b->processed; });
    for (size_t i = 1; i < seq.size(); ++i) {
        const Order &a = seq[i - 1]->order, &b = seq[i]->order;
        CHECK(a.priority < b.priority || (a.priority == b.priority && a.deadline <= b.deadline));
    }
}

TEST(waves_fill_pallets_better_than_order_by_order) {
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
    CHECK(nWaves < nOrder);                          // fewer pallets...
    CHECK(fillWaves / nWaves > fillOrder / nOrder);  // ...each one fuller
}

TEST(wes_is_deterministic) {
    auto orders = generateOrders(20, 9);
    WesResult a = runWes(orders), b = runWes(orders);
    CHECK(a.totalSteps == b.totalSteps && a.pallets.size() == b.pallets.size());
    CHECK(a.makespan == b.makespan);
}
