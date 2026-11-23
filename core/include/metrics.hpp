#pragma once
// Numbers that describe how good a pallet plan is.

#include <cstdint>

#include "packer.hpp"

namespace pal {

struct Metrics {
    int offered = 0;             // boxes we were given
    int placed = 0;              // boxes that made it onto the pallet
    int64_t placedVolume = 0;    // mm^3
    double density = 0.0;        // placed volume / (deck area * stack height): how little air
    double fillOfMax = 0.0;      // placed volume / (deck area * max height): how full the pallet is
    int height = 0;              // mm
    double totalWeight = 0.0;    // kg
    double comOffset = 0.0;      // horizontal distance of center of mass from pallet center (mm)
    double comHeight = 0.0;      // mm above the deck
    double runtimeMs = 0.0;
};

Metrics computeMetrics(const PackResult& result, double runtimeMs);

}  // namespace pal
