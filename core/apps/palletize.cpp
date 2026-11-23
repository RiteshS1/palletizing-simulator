// palletize: generate a box set, pack it, print the plan as JSON.
//
//   palletize --algo ep --n 40 --seed 42 --out plan.json
//
// JSON goes to stdout (or --out); a one-line summary goes to stderr, so piping the JSON into
// another program never mixes in human-readable text.

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <string>

#include "generator.hpp"
#include "metrics.hpp"
#include "plan_io.hpp"

using namespace pal;

static void usage() {
    std::fprintf(stderr,
                 "usage: palletize [--algo greedy|ep] [--n 40] [--seed 42] [--support 0.75]\n"
                 "                 [--restarts 8] [--out file.json]\n");
    std::exit(2);
}

int main(int argc, char** argv) {
    std::string algo = "ep", outPath;
    int n = 40, restarts = 8;
    uint32_t seed = 42;
    Rules rules;

    for (int i = 1; i < argc; ++i) {
        auto next = [&]() -> const char* { if (i + 1 >= argc) usage(); return argv[++i]; };
        if (!std::strcmp(argv[i], "--algo")) algo = next();
        else if (!std::strcmp(argv[i], "--n")) n = std::atoi(next());
        else if (!std::strcmp(argv[i], "--seed")) seed = uint32_t(std::strtoul(next(), nullptr, 10));
        else if (!std::strcmp(argv[i], "--support")) rules.minSupportRatio = std::atof(next());
        else if (!std::strcmp(argv[i], "--restarts")) restarts = std::atoi(next());
        else if (!std::strcmp(argv[i], "--out")) outPath = next();
        else usage();
    }
    if (algo != "greedy" && algo != "ep") usage();

    std::vector<Box> boxes = generateBoxes(n, seed);
    PalletSpec spec;

    // steady_clock never jumps (unlike the wall clock, which NTP can adjust): right for timing.
    auto t0 = std::chrono::steady_clock::now();
    PackResult result = algo == "greedy"
        ? packGreedyLayer(boxes, spec, rules)
        : packExtremePoints(boxes, spec, rules, EPOptions{restarts, seed});
    auto t1 = std::chrono::steady_clock::now();
    double ms = std::chrono::duration<double, std::milli>(t1 - t0).count();

    Metrics m = computeMetrics(result, ms);
    std::string json = planToJson(result, m, boxes, seed);

    if (outPath.empty()) {
        std::printf("%s\n", json.c_str());
    } else {
        std::ofstream(outPath) << json << '\n';
    }
    std::fprintf(stderr, "%s: placed %d/%d, density %.1f%%, height %d mm, CoM offset %.0f mm, %.1f ms\n",
                 result.algorithm.c_str(), m.placed, m.offered, m.density * 100, m.height,
                 m.comOffset, m.runtimeMs);
    return 0;
}
