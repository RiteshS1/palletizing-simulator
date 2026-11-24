#pragma once
// Turn plans into JSON (nlohmann/json) for the web viewer, the WASM build and the ROS 2 node.

#include <cstdint>
#include <nlohmann/json.hpp>
#include <string>
#include <vector>

#include "pal/metrics.hpp"
#include "pal/robot_cell.hpp"

namespace pal {

// ordered_json keeps keys in insertion order (plain json sorts them), so the output reads
// top-down: what was planned, then the plan, then the scores.
using Json = nlohmann::ordered_json;

Json poseToJson(const Pose& p);

Json planToJson(const PackResult& result, const Metrics& metrics, const std::vector<Box>& offered,
                uint32_t seed, const RobotCell& cell = {});

}  // namespace pal
