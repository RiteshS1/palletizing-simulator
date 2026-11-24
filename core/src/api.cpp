#include "pal/api.hpp"

#include <chrono>
#include <fmt/format.h>

#include "pal/generator.hpp"
#include "pal/metrics.hpp"
#include "pal/plan_io.hpp"
#include "pal/wes.hpp"

namespace pal {

namespace {

// steady_clock never jumps (unlike the wall clock, which NTP can adjust): right for timing.
template <typename F>
double timeMs(F&& f) {
    const auto t0 = std::chrono::steady_clock::now();
    f();
    const auto t1 = std::chrono::steady_clock::now();
    return std::chrono::duration<double, std::milli>(t1 - t0).count();
}

Json stepToJson(const StepRecord& s) {
    const AABB a = s.placement.aabb();
    return Json{{"step", s.step},
                {"id", s.placement.box.id},
                {"orderId", s.orderId},
                {"time", s.time},
                {"x", a.min.x}, {"y", a.min.y}, {"z", a.min.z},
                {"sx", a.sizeX()}, {"sy", a.sizeY()}, {"sz", a.sizeZ()},
                {"weight", s.placement.box.weight},
                {"rotated", s.placement.rotated}};
}

}  // namespace

RunOutput runPack(const PackRequest& req) {
    const std::vector<Box> boxes = generateBoxes(req.n, req.seed);
    const PalletSpec spec;
    Rules rules;
    rules.minSupportRatio = req.minSupport;

    PackResult result;
    const double ms = timeMs([&] {
        result = req.algo == "greedy"
                     ? packGreedyLayer(boxes, spec, rules)
                     : packExtremePoints(boxes, spec, rules, EPOptions{req.restarts, req.seed});
    });
    const Metrics m = computeMetrics(result, ms);
    return RunOutput{
        planToJson(result, m, boxes, req.seed).dump(),
        fmt::format("{}: placed {}/{}, density {:.1f}%, height {} mm, CoM offset {:.0f} mm, {:.1f} ms",
                    result.algorithm, m.placed, m.offered, m.density * 100, m.height, m.comOffset,
                    m.runtimeMs)};
}

RunOutput runWesSim(const WesRequest& req) {
    const std::vector<Order> orders = generateOrders(req.orders, req.seed);
    WesConfig cfg;
    cfg.policy = req.policy == "order" ? WesPolicy::OrderByOrder : WesPolicy::Waves;

    WesResult r;
    const double ms = timeMs([&] { r = runWes(orders, cfg); });

    int rejected = 0, late = 0;
    for (const OrderRecord& o : r.orders) {
        rejected += o.rejected;
        late += o.late;
    }
    double fillSum = 0;
    for (const PalletRecord& p : r.pallets) fillSum += computeMetrics(PackResult{"", p.state, {}}, 0).fillOfMax;
    const double avgFill = r.pallets.empty() ? 0 : fillSum / double(r.pallets.size());
    const double perHour = r.makespan > 0 ? r.totalSteps / (r.makespan / 3600.0) : 0;

    Json j;
    j["kind"] = "wes";
    j["seed"] = req.seed;
    j["pallet"] = {{"length", cfg.pallet.length}, {"width", cfg.pallet.width},
                   {"maxHeight", cfg.pallet.maxHeight}, {"maxLoad", cfg.pallet.maxLoad}};
    j["config"] = {{"policy", cfg.policy == WesPolicy::Waves ? "waves" : "order_by_order"},
                   {"cycleTimeS", cfg.cycleTimeS},
                   {"waveVolume", cfg.waveVolume},
                   {"stations", cfg.stations}};

    Json orderList = Json::array();
    for (const OrderRecord& o : r.orders) {
        orderList.push_back({{"id", o.order.id},
                             {"destination", o.order.destination},
                             {"priority", o.order.priority},
                             {"release", o.order.release},
                             {"deadline", o.order.deadline},
                             {"boxes", o.order.boxes.size()},
                             {"processed", o.processed},
                             {"pallet", o.pallet},
                             {"start", o.start},
                             {"finish", o.finish},
                             {"late", o.late},
                             {"firstStep", o.firstStep},
                             {"lastStep", o.lastStep},
                             {"status", o.rejected ? "rejected" : "done"}});
    }
    j["orders"] = std::move(orderList);

    Json pallets = Json::array();
    for (const PalletRecord& p : r.pallets) {
        const Metrics pm = computeMetrics(PackResult{"", p.state, {}}, 0);
        Json steps = Json::array();
        for (const StepRecord& s : p.steps) steps.push_back(stepToJson(s));
        pallets.push_back({{"id", p.id},
                           {"destination", p.destination},
                           {"closedAfterStep", p.closedAfterStep},
                           {"closeReason", p.closeReason},
                           {"placements", std::move(steps)},
                           {"metrics", {{"placed", pm.placed},
                                        {"fillOfMax", pm.fillOfMax},
                                        {"height", pm.height},
                                        {"totalWeight", pm.totalWeight},
                                        {"comOffset", pm.comOffset}}}});
    }
    j["pallets"] = std::move(pallets);

    j["metrics"] = {{"orders", r.orders.size()}, {"rejected", rejected},
                    {"pallets", r.pallets.size()}, {"boxes", r.totalSteps},
                    {"avgFill", avgFill},          {"lateOrders", late},
                    {"makespanS", r.makespan},     {"boxesPerHour", perHour},
                    {"runtimeMs", ms}};

    return RunOutput{
        j.dump(),
        fmt::format("wes ({}): {} orders ({} rejected), {} pallets, avg fill {:.1f}%, {} late, shift {:.0f} s, {:.1f} ms",
                    req.policy == "order" ? "order by order" : "waves", r.orders.size(), rejected,
                    r.pallets.size(), avgFill * 100, late, r.makespan, ms)};
}

}  // namespace pal
