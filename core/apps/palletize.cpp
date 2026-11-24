// palletize: generate a box set, pack it, print the plan as JSON.
//
//   palletize --algo ep --boxes 40 --seed 42 --out plan.json
//
// JSON goes to stdout (or --out); the one-line summary goes to stderr, so piping the JSON into
// another program never mixes in human-readable text.

#include <CLI/CLI.hpp>
#include <fmt/core.h>
#include <fstream>

#include "pal/api.hpp"

int main(int argc, char** argv) {
    pal::PackRequest req;
    std::string outPath;

    // CLI11: declarative options with validation and auto-generated --help.
    CLI::App app{"Pack a random set of cartons onto a pallet and print the plan as JSON."};
    app.add_option("--algo", req.algo, "Packing algorithm")->check(CLI::IsMember({"greedy", "ep"}))->capture_default_str();
    app.add_option("-n,--boxes", req.n, "Number of boxes")->check(CLI::Range(1, 1000))->capture_default_str();
    app.add_option("--seed", req.seed, "Random seed (same seed, same boxes)")->capture_default_str();
    app.add_option("--support", req.minSupport, "Minimum supported fraction of a box's base")->check(CLI::Range(0.0, 1.0))->capture_default_str();
    app.add_option("--restarts", req.restarts, "Extra randomized runs for extreme points")->check(CLI::Range(0, 200))->capture_default_str();
    app.add_option("-o,--out", outPath, "Write the JSON to this file instead of stdout");
    CLI11_PARSE(app, argc, argv);

    const pal::RunOutput out = pal::runPack(req);
    if (outPath.empty()) fmt::print("{}\n", out.json);
    else std::ofstream(outPath) << out.json << '\n';
    fmt::print(stderr, "{}\n", out.summary);
    return 0;
}
