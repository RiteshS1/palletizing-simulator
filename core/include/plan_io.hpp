#pragma once
// Turn a pallet plan into JSON for the three.js viewer.

#include <cstdint>
#include <string>
#include <vector>

#include "metrics.hpp"

namespace pal {

std::string planToJson(const PackResult& result, const Metrics& metrics,
                       const std::vector<Box>& offered, uint32_t seed);

}  // namespace pal
