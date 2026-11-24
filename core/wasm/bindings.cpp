// WebAssembly entry points, exposed to JavaScript with embind.
//
// JS calls:  engine.pack("ep", 40, 42, 0.75)  ->  JSON string (same as `palletize`)
//            engine.wes(24, 7)                ->  JSON string (same as `wes_sim`)
//
// Passing JSON strings across the boundary keeps the interface tiny: embind converts
// std::string <-> JS string for us, and the viewer already knows how to read these plans.
// Both functions call the exact code the CLI uses (api.cpp), so outputs match byte for byte
// (except the measured runtime).

#include <emscripten/bind.h>

#include "pal/api.hpp"

namespace {

std::string pack(std::string algo, int n, uint32_t seed, double minSupport) {
    pal::PackRequest req;
    req.algo = algo;
    req.n = n;
    req.seed = seed;
    req.minSupport = minSupport;
    return pal::runPack(req).json;
}

std::string wes(int orders, uint32_t seed) {
    pal::WesRequest req;
    req.orders = orders;
    req.seed = seed;
    return pal::runWesSim(req).json;
}

}  // namespace

EMSCRIPTEN_BINDINGS(palletizer) {
    emscripten::function("pack", &pack);
    emscripten::function("wes", &wes);
}
