#include "generator.hpp"

#include <cmath>

#include "random.hpp"

namespace pal {

namespace {

// Random multiple of `step` within [lo, hi].
int snappedSize(std::mt19937& rng, int lo, int hi, int step) {
    return uniformInt(rng, lo / step, hi / step) * step;
}

}  // namespace

std::vector<Box> generateBoxes(int n, uint32_t seed, const GeneratorParams& p) {
    std::mt19937 rng(seed);
    std::vector<Box> boxes;
    boxes.reserve(n);  // one allocation instead of repeated growth

    for (int i = 0; i < n; ++i) {
        Box b;
        b.id = i;
        b.w = snappedSize(rng, p.minW, p.maxW, p.step);
        b.d = snappedSize(rng, p.minD, p.maxD, p.step);
        b.h = snappedSize(rng, p.minH, p.maxH, p.step);

        // weight = volume (m^3) * density (kg/m^3), rounded to 0.1 kg.
        double volumeM3 = double(b.volume()) / 1e9;
        double density = uniformReal(rng, p.minDensity, p.maxDensity);
        b.weight = std::round(volumeM3 * density * 10.0) / 10.0;
        if (b.weight < 0.1) b.weight = 0.1;

        boxes.push_back(b);
    }
    return boxes;
}

}  // namespace pal
