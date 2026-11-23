#pragma once
// Reproducible random box sets, so both algorithms can be compared on identical inputs.

#include <cstdint>
#include <vector>

#include "box.hpp"

namespace pal {

struct GeneratorParams {
    int minW = 200, maxW = 600;  // mm
    int minD = 200, maxD = 500;  // mm
    int minH = 150, maxH = 400;  // mm
    int step = 50;               // sizes snap to multiples of this (real cartons come in standard sizes)
    double minDensity = 80.0;    // kg per cubic metre (light goods, e.g. paper towels)
    double maxDensity = 350.0;   // kg per cubic metre (dense goods, e.g. canned food)
};

// Same (n, seed, params) -> exactly the same boxes, on every machine.
std::vector<Box> generateBoxes(int n, uint32_t seed, const GeneratorParams& params = {});

}  // namespace pal
