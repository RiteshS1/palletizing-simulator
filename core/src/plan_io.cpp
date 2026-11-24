#include "pal/plan_io.hpp"

#include <cmath>

namespace pal {

namespace {

// Micrometre precision is plenty for poses and keeps the JSON readable.
double round6(double v) { return std::round(v * 1e6) / 1e6; }

}  // namespace

Json poseToJson(const Pose& p) {
    const auto& q = p.orientation;
    return Json{
        {"position", {round6(p.position.x()), round6(p.position.y()), round6(p.position.z())}},
        {"orientation", {round6(q.x()), round6(q.y()), round6(q.z()), round6(q.w())}},
    };
}

// Output shape (box lengths in mm in the pallet frame; poses in metres in the robot base frame):
// { algorithm, seed, pallet, rules, robotCell, boxes[], placements[], unplaced[], metrics }
Json planToJson(const PackResult& r, const Metrics& m, const std::vector<Box>& offered, uint32_t seed,
                const RobotCell& cell) {
    const PalletSpec& s = r.pallet.spec();
    const Rules& rules = r.pallet.rules();

    Json j;
    j["algorithm"] = r.algorithm;
    j["seed"] = seed;
    j["pallet"] = {{"length", s.length}, {"width", s.width}, {"maxHeight", s.maxHeight}, {"maxLoad", s.maxLoad}};
    j["rules"] = {{"minSupportRatio", rules.minSupportRatio},
                  {"loadFactor", rules.loadFactor},
                  {"requireCenterSupported", rules.requireCenterSupported}};
    j["robotCell"] = {{"frame", "robot_base"},
                      {"units", "m"},
                      {"palletPose", poseToJson(toPose(cell.basePallet))},
                      {"approachHeight", cell.approachHeightM}};

    Json boxes = Json::array();
    for (const Box& b : offered) {
        boxes.push_back({{"id", b.id}, {"w", b.w}, {"d", b.d}, {"h", b.h}, {"weight", b.weight}});
    }
    j["boxes"] = std::move(boxes);

    Json placements = Json::array();
    int step = 0;
    for (const Placement& p : r.pallet.placements()) {
        const AABB a = p.aabb();
        const PlacePoses poses = placePoses(cell, p);
        placements.push_back({
            {"step", step++},
            {"id", p.box.id},
            {"x", a.min.x}, {"y", a.min.y}, {"z", a.min.z},
            {"sx", a.sizeX()}, {"sy", a.sizeY()}, {"sz", a.sizeZ()},
            {"weight", p.box.weight},
            {"rotated", p.rotated},
            {"placePose", poseToJson(poses.place)},
            {"approachPose", poseToJson(poses.approach)},
        });
        if (static_cast<size_t>(step) <= r.candidates.size()) {
            Json pts = Json::array();
            for (const Vec3& v : r.candidates[static_cast<size_t>(step - 1)]) pts.push_back({v.x, v.y, v.z});
            placements.back()["candidates"] = std::move(pts);
        }
    }
    j["placements"] = std::move(placements);

    Json unplaced = Json::array();
    for (const Box& b : r.unplaced) unplaced.push_back(b.id);
    j["unplaced"] = std::move(unplaced);

    j["metrics"] = {{"offered", m.offered},       {"placed", m.placed},
                    {"placedVolume", m.placedVolume}, {"density", m.density},
                    {"fillOfMax", m.fillOfMax},   {"height", m.height},
                    {"totalWeight", m.totalWeight}, {"comOffset", m.comOffset},
                    {"comHeight", m.comHeight},   {"runtimeMs", m.runtimeMs}};
    return j;
}

}  // namespace pal
