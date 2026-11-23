#include "api.hpp"

#include <chrono>
#include <cmath>
#include <cstdio>

#include "generator.hpp"
#include "json.hpp"
#include "metrics.hpp"
#include "plan_io.hpp"
#include "wes.hpp"

namespace pal {

namespace {

// steady_clock never jumps (unlike the wall clock, which NTP can adjust): right for timing.
template <typename F>
double timeMs(F&& f) {
    auto t0 = std::chrono::steady_clock::now();
    f();
    auto t1 = std::chrono::steady_clock::now();
    return std::chrono::duration<double, std::milli>(t1 - t0).count();
}

void writePlacement(JsonWriter& j, const StepRecord& s) {
    AABB a = s.placement.aabb();
    j.beginObject()
        .key("step").value(s.step)
        .key("id").value(s.placement.box.id)
        .key("orderId").value(s.orderId)
        .key("time").value(s.time)
        .key("x").value(a.min.x).key("y").value(a.min.y).key("z").value(a.min.z)
        .key("sx").value(a.sizeX()).key("sy").value(a.sizeY()).key("sz").value(a.sizeZ())
        .key("weight").value(s.placement.box.weight)
        .key("rotated").value(s.placement.rotated)
        .endObject();
}

}  // namespace

RunOutput runPack(const PackRequest& req) {
    std::vector<Box> boxes = generateBoxes(req.n, req.seed);
    PalletSpec spec;
    Rules rules;
    rules.minSupportRatio = req.minSupport;

    PackResult result;
    double ms = timeMs([&] {
        result = req.algo == "greedy"
                     ? packGreedyLayer(boxes, spec, rules)
                     : packExtremePoints(boxes, spec, rules, EPOptions{req.restarts, req.seed});
    });
    Metrics m = computeMetrics(result, ms);

    char line[200];
    std::snprintf(line, sizeof line,
                  "%s: placed %d/%d, density %.1f%%, height %d mm, CoM offset %.0f mm, %.1f ms",
                  result.algorithm.c_str(), m.placed, m.offered, m.density * 100, m.height,
                  m.comOffset, m.runtimeMs);
    return RunOutput{planToJson(result, m, boxes, req.seed), line};
}

RunOutput runWesSim(const WesRequest& req) {
    std::vector<Order> orders = generateOrders(req.orders, req.seed);
    WesConfig cfg;
    cfg.policy = req.policy == "order" ? WesPolicy::OrderByOrder : WesPolicy::Waves;

    WesResult r;
    double ms = timeMs([&] { r = runWes(orders, cfg); });

    int rejected = 0, late = 0;
    for (const OrderRecord& o : r.orders) {
        rejected += o.rejected;
        late += o.late;
    }
    double fillSum = 0;
    for (const PalletRecord& p : r.pallets) fillSum += computeMetrics(PackResult{"", p.state, {}}, 0).fillOfMax;
    double avgFill = r.pallets.empty() ? 0 : fillSum / double(r.pallets.size());
    double perHour = r.makespan > 0 ? r.totalSteps / (r.makespan / 3600.0) : 0;

    JsonWriter j;
    j.beginObject();
    j.key("kind").value("wes");
    j.key("seed").value(req.seed);
    j.key("pallet").beginObject()
        .key("length").value(cfg.pallet.length).key("width").value(cfg.pallet.width)
        .key("maxHeight").value(cfg.pallet.maxHeight).key("maxLoad").value(cfg.pallet.maxLoad)
        .endObject();
    j.key("config").beginObject()
        .key("policy").value(cfg.policy == WesPolicy::Waves ? "waves" : "order_by_order")
        .key("cycleTimeS").value(cfg.cycleTimeS)
        .key("waveVolume").value(cfg.waveVolume)
        .key("stations").value(cfg.stations)
        .endObject();

    j.key("orders").beginArray();
    for (const OrderRecord& o : r.orders) {
        j.beginObject()
            .key("id").value(o.order.id)
            .key("destination").value(o.order.destination)
            .key("priority").value(o.order.priority)
            .key("release").value(o.order.release)
            .key("deadline").value(o.order.deadline)
            .key("boxes").value(o.order.boxes.size())
            .key("processed").value(o.processed)
            .key("pallet").value(o.pallet)
            .key("start").value(o.start)
            .key("finish").value(o.finish)
            .key("late").value(o.late)
            .key("firstStep").value(o.firstStep)
            .key("lastStep").value(o.lastStep)
            .key("status").value(o.rejected ? "rejected" : "done")
            .endObject();
    }
    j.endArray();

    j.key("pallets").beginArray();
    for (const PalletRecord& p : r.pallets) {
        Metrics pm = computeMetrics(PackResult{"", p.state, {}}, 0);
        j.beginObject()
            .key("id").value(p.id)
            .key("destination").value(p.destination)
            .key("closedAfterStep").value(p.closedAfterStep)
            .key("closeReason").value(p.closeReason);
        j.key("placements").beginArray();
        for (const StepRecord& s : p.steps) writePlacement(j, s);
        j.endArray();
        j.key("metrics").beginObject()
            .key("placed").value(pm.placed)
            .key("fillOfMax").value(pm.fillOfMax)
            .key("height").value(pm.height)
            .key("totalWeight").value(pm.totalWeight)
            .key("comOffset").value(pm.comOffset)
            .endObject();
        j.endObject();
    }
    j.endArray();

    j.key("metrics").beginObject()
        .key("orders").value(r.orders.size())
        .key("rejected").value(rejected)
        .key("pallets").value(r.pallets.size())
        .key("boxes").value(r.totalSteps)
        .key("avgFill").value(avgFill)
        .key("lateOrders").value(late)
        .key("makespanS").value(r.makespan)
        .key("boxesPerHour").value(perHour)
        .key("runtimeMs").value(ms)
        .endObject();
    j.endObject();

    char line[200];
    std::snprintf(line, sizeof line,
                  "wes (%s): %zu orders (%d rejected), %zu pallets, avg fill %.1f%%, %d late, shift %.0f s, %.1f ms",
                  req.policy == "order" ? "order by order" : "waves", r.orders.size(), rejected, r.pallets.size(), avgFill * 100, late, r.makespan, ms);
    return RunOutput{j.str(), line};
}

}  // namespace pal
