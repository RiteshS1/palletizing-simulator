#pragma once
// Deterministic random helpers on top of std::mt19937.
//
// Why not std::uniform_int_distribution? The C++ standard fixes the exact output of
// std::mt19937, but NOT of the distributions: libc++ (macOS) and libstdc++ (Linux) may map the
// same raw numbers to different values. Doing the mapping ourselves keeps results identical
// everywhere (native, Linux CI, and WebAssembly later).

#include <cstdint>
#include <random>

namespace pal {

// Uniform integer in [lo, hi]. The modulo bias (some values slightly more likely) is ~1e-7 for
// our small ranges: irrelevant here. The unbiased fix is rejection sampling.
inline int uniformInt(std::mt19937& rng, int lo, int hi) {
    uint32_t range = uint32_t(hi - lo + 1);
    return lo + int(rng() % range);
}

// Uniform real in [lo, hi).
inline double uniformReal(std::mt19937& rng, double lo, double hi) {
    double unit = double(rng()) / 4294967296.0;  // rng() is in [0, 2^32 - 1]
    return lo + unit * (hi - lo);
}

}  // namespace pal
