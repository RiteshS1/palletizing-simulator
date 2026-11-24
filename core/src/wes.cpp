#include "pal/wes.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <numeric>
#include <queue>
#include <unordered_map>

#include "pal/generator.hpp"
#include "pal/random.hpp"

namespace pal {

std::vector<Order> generateOrders(int n, uint32_t seed) {
    static const char* kDestinations[] = {"Store A", "Store B", "Store C"};
    static const double kSlack[] = {0, 1800, 3600, 7200};  // time allowed, by priority (s)
    std::mt19937 rng(seed);
    std::vector<Order> orders;
    double t = 0;
    int nextBoxId = 0;
    for (int i = 0; i < n; ++i) {
        Order o;
        o.id = i;
        o.destination = kDestinations[uniformInt(rng, 0, 2)];
        o.priority = uniformInt(rng, 1, 3);
        t += uniformReal(rng, 0, 60);  // orders trickle in during the shift
        o.release = std::round(t);
        o.deadline = o.release + kSlack[o.priority];
        int count = uniformInt(rng, 3, 10);
        o.boxes = generateBoxes(count, seed * 7919u + uint32_t(i));
        for (Box& b : o.boxes) b.id = nextBoxId++;  // ids unique across the whole shift
        orders.push_back(o);
    }
    return orders;
}

namespace {

double fill(const PalletState& s) {
    int64_t v = 0;
    for (const Placement& p : s.placements()) v += p.box.volume();
    return double(v) / double(s.spec().usableSpace().volume());
}

int64_t orderVolume(const Order& o) {
    int64_t v = 0;
    for (const Box& b : o.boxes) v += b.volume();
    return v;
}

// "Is a MORE urgent than b?": priority 1 beats 3, then earlier deadline, then first come first served.
bool moreUrgent(const Order& a, const Order& b) {
    if (a.priority != b.priority) return a.priority < b.priority;
    if (a.deadline != b.deadline) return a.deadline < b.deadline;
    return a.id < b.id;
}

// std::priority_queue is a MAX-heap: top() is the element that compares greatest.
// So its comparator must answer "is a LESS urgent than b?", the reverse of moreUrgent.
struct LessUrgent {
    const std::vector<Order>* orders;
    bool operator()(int a, int b) const { return moreUrgent((*orders)[b], (*orders)[a]); }
};

std::vector<int> indicesByRelease(const std::vector<Order>& orders) {
    std::vector<int> idx(orders.size());
    std::iota(idx.begin(), idx.end(), 0);
    std::stable_sort(idx.begin(), idx.end(),
                     [&](int a, int b) { return orders[a].release < orders[b].release; });
    return idx;
}

// Record the robot placing `placements` onto pallet `p`, one cycle per box.
// `orderOf` maps box id -> order id.
void placeBoxes(WesResult& res, PalletRecord& p, const std::vector<Placement>& placements,
                const std::unordered_map<int, int>& orderOf, double& clock, double cycle) {
    for (const Placement& pl : placements) {
        clock += cycle;
        int orderId = orderOf.at(pl.box.id);
        OrderRecord& rec = res.orders[orderId];
        if (rec.firstStep < 0) rec.firstStep = res.totalSteps;
        rec.lastStep = res.totalSteps;
        rec.finish = clock;
        rec.late = rec.finish > rec.order.deadline;
        p.steps.push_back(StepRecord{res.totalSteps++, orderId, clock, pl});
    }
}

// ---------------------------------------------------------------- online: order by order
void runOrderByOrder(const std::vector<Order>& orders, const WesConfig& cfg, WesResult& res) {
    std::vector<int> byRelease = indicesByRelease(orders);
    std::priority_queue<int, std::vector<int>, LessUrgent> queue(LessUrgent{&orders});
    // Hash map: destination -> indices of its open pallets. O(1) average lookup.
    std::unordered_map<std::string, std::vector<int>> openByDest;
    int openCount = 0;

    auto closePallet = [&](int idx, const char* reason) {
        PalletRecord& p = res.pallets[idx];
        p.open = false;
        p.closeReason = reason;
        p.closedAfterStep = res.totalSteps;
        auto& list = openByDest[p.destination];
        list.erase(std::remove(list.begin(), list.end(), idx), list.end());
        --openCount;
    };

    double clock = 0;
    size_t next = 0;
    int processed = 0;
    while (next < byRelease.size() || !queue.empty()) {
        // Event-driven: if nothing is waiting, jump the clock straight to the next arrival.
        if (queue.empty()) clock = std::max(clock, orders[byRelease[next]].release);
        while (next < byRelease.size() && orders[byRelease[next]].release <= clock) {
            queue.push(byRelease[next++]);
        }
        int oi = queue.top();
        queue.pop();
        const Order& order = orders[oi];
        OrderRecord& rec = res.orders[oi];
        rec.processed = processed++;

        // Try every open pallet for this destination. First-Fit takes the first that works;
        // Best-Fit takes the one that ends up fullest (keeps the others free for big orders).
        int chosen = -1;
        PalletState chosenState;
        double chosenFill = -1;
        for (int idx : openByDest[order.destination]) {
            PalletState trial = res.pallets[idx].state;
            if (!addBoxesExtremePoints(trial, order.boxes)) continue;
            double f = fill(trial);
            if (chosen < 0 || f > chosenFill) {
                chosen = idx;
                chosenState = trial;
                chosenFill = f;
            }
            if (!cfg.bestFit) break;
        }

        if (chosen < 0) {
            PalletState trial(cfg.pallet, cfg.rules);
            if (!addBoxesExtremePoints(trial, order.boxes)) {  // too big even for an empty pallet
                rec.rejected = true;
                continue;
            }
            if (openCount >= cfg.stations) {  // all stations busy: ship the fullest pallet
                int fullest = -1;
                for (size_t i = 0; i < res.pallets.size(); ++i) {
                    if (res.pallets[i].open &&
                        (fullest < 0 || fill(res.pallets[i].state) > fill(res.pallets[fullest].state)))
                        fullest = int(i);
                }
                closePallet(fullest, "station_needed");
            }
            PalletRecord p;
            p.id = int(res.pallets.size());
            p.destination = order.destination;
            p.state = PalletState(cfg.pallet, cfg.rules);
            res.pallets.push_back(p);
            openByDest[order.destination].push_back(p.id);
            ++openCount;
            chosen = p.id;
            chosenState = trial;
        }

        PalletRecord& pallet = res.pallets[chosen];
        const size_t before = pallet.state.placements().size();
        pallet.state = chosenState;
        rec.pallet = chosen;
        rec.start = clock;
        std::vector<Placement> added(pallet.state.placements().begin() + long(before),
                                     pallet.state.placements().end());
        std::unordered_map<int, int> orderOf;
        for (const Box& b : order.boxes) orderOf[b.id] = order.id;
        placeBoxes(res, pallet, added, orderOf, clock, cfg.cycleTimeS);

        if (fill(pallet.state) >= cfg.closeFill) closePallet(chosen, "full");
    }
    for (size_t i = 0; i < res.pallets.size(); ++i) {
        if (res.pallets[i].open) closePallet(int(i), "end_of_shift");
    }
    res.makespan = clock;
}

// ---------------------------------------------------------------- batched: waves
void runWaves(const std::vector<Order>& orders, const WesConfig& cfg, WesResult& res) {
    std::vector<int> byRelease = indicesByRelease(orders);
    // destination -> orders waiting for a wave
    std::unordered_map<std::string, std::vector<int>> waiting;
    const double palletVolume = double(cfg.pallet.usableSpace().volume());
    const double inf = std::numeric_limits<double>::infinity();

    auto waitingVolume = [&](const std::vector<int>& list) {
        double v = 0;
        for (int i : list) v += double(orderVolume(orders[i]));
        return v;
    };
    // Latest time this destination's wave can start and still meet every waiting deadline.
    auto mustStartBy = [&](const std::vector<int>& list) {
        int boxes = 0;
        double earliest = inf;
        for (int i : list) {
            boxes += int(orders[i].boxes.size());
            earliest = std::min(earliest, orders[i].deadline);
        }
        return earliest - boxes * cfg.cycleTimeS - cfg.urgencyBufferS;
    };

    double clock = 0;
    size_t next = 0;
    int processed = 0;
    while (true) {
        while (next < byRelease.size() && orders[byRelease[next]].release <= clock) {
            int oi = byRelease[next++];
            waiting[orders[oi].destination].push_back(oi);
        }
        const bool moreComing = next < byRelease.size();

        // Which destinations are ready for a wave? Pick the one holding the most urgent order.
        std::string dest;
        const Order* best = nullptr;
        double soonest = inf;  // when the next destination would become urgent
        for (auto& [d, list] : waiting) {
            if (list.empty()) continue;
            double startBy = mustStartBy(list);
            bool ready = !moreComing || waitingVolume(list) >= cfg.waveVolume * palletVolume ||
                         startBy <= clock;
            if (!ready) {
                soonest = std::min(soonest, startBy);
                continue;
            }
            for (int i : list) {
                if (!best || moreUrgent(orders[i], *best)) {
                    best = &orders[i];
                    dest = d;
                }
            }
        }

        if (!best) {
            if (!moreComing && soonest == inf) break;  // nothing waiting, nothing coming: done
            // Event-driven: jump to the next arrival or the next deadline-driven start.
            double nextArrival = moreComing ? orders[byRelease[next]].release : inf;
            clock = std::max(clock, std::min(nextArrival, soonest));
            continue;
        }

        // Build the wave: most urgent orders first, while they could plausibly fit.
        std::vector<int>& list = waiting[dest];
        std::sort(list.begin(), list.end(), [&](int a, int b) { return moreUrgent(orders[a], orders[b]); });
        std::vector<int> wave;
        double vol = 0;
        for (int i : list) {
            if (!wave.empty() && vol + double(orderVolume(orders[i])) > 0.9 * palletVolume) continue;
            wave.push_back(i);
            vol += double(orderVolume(orders[i]));
        }

        // Plan the whole wave at once with the offline packer. If some box doesn't fit, drop the
        // least urgent order (orders are all-or-nothing) and plan again.
        PackResult plan;
        while (true) {
            std::vector<Box> boxes;
            for (int i : wave) boxes.insert(boxes.end(), orders[i].boxes.begin(), orders[i].boxes.end());
            plan = packExtremePoints(boxes, cfg.pallet, cfg.rules, EPOptions{4, uint32_t(processed + 1)});
            if (plan.unplaced.empty() || wave.size() == 1) break;
            wave.pop_back();
        }

        for (int i : wave) list.erase(std::find(list.begin(), list.end(), i));
        if (!plan.unplaced.empty()) {  // a single order too big for an empty pallet
            res.orders[wave[0]].rejected = true;
            res.orders[wave[0]].processed = processed++;
            continue;
        }

        PalletRecord p;
        p.id = int(res.pallets.size());
        p.destination = dest;
        p.state = plan.pallet;
        std::unordered_map<int, int> orderOf;
        for (int i : wave) {
            OrderRecord& rec = res.orders[i];
            rec.processed = processed++;
            rec.pallet = p.id;
            rec.start = clock;
            for (const Box& b : orders[i].boxes) orderOf[b.id] = orders[i].id;
        }
        res.pallets.push_back(p);
        PalletRecord& pr = res.pallets.back();
        placeBoxes(res, pr, plan.pallet.placements(), orderOf, clock, cfg.cycleTimeS);
        pr.open = false;
        pr.closeReason = "wave_complete";
        pr.closedAfterStep = res.totalSteps;
    }
    res.makespan = clock;
}

}  // namespace

WesResult runWes(const std::vector<Order>& orders, const WesConfig& cfg) {
    WesResult res;
    for (const Order& o : orders) res.orders.push_back(OrderRecord{o});
    if (cfg.policy == WesPolicy::Waves) runWaves(orders, cfg, res);
    else runOrderByOrder(orders, cfg, res);
    return res;
}

}  // namespace pal
