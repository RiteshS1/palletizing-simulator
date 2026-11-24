// bench: compare the packers fairly.
//
// Fair = same inputs: for every seed, BOTH algorithms get the identical box set.
// We report mean ± standard deviation over many seeds, because one lucky seed proves nothing.
//
//   bench [--seeds 50]

#include <CLI/CLI.hpp>
#include <chrono>
#include <cmath>
#include <fmt/core.h>
#include <functional>

#include "pal/generator.hpp"
#include "pal/metrics.hpp"

using namespace pal;

// Welford's online algorithm: running mean and variance in ONE pass, without storing samples,
// and numerically stable (the naive sum-of-squares formula loses precision badly).
struct Stat {
    int n = 0;
    double mean = 0, m2 = 0;
    void add(double x) {
        ++n;
        double delta = x - mean;
        mean += delta / n;
        m2 += delta * (x - mean);
    }
    double stddev() const { return n > 1 ? std::sqrt(m2 / (n - 1)) : 0.0; }
};

struct AlgoStats {
    Stat placedPct, density, fill, height, comOffset, runtime;
};

using Packer = std::function<PackResult(const std::vector<Box>&)>;

static Metrics timed(const Packer& pack, const std::vector<Box>& boxes) {
    auto t0 = std::chrono::steady_clock::now();
    PackResult r = pack(boxes);
    auto t1 = std::chrono::steady_clock::now();
    return computeMetrics(r, std::chrono::duration<double, std::milli>(t1 - t0).count());
}

static void record(AlgoStats& s, const Metrics& m) {
    s.placedPct.add(100.0 * m.placed / m.offered);
    s.density.add(100.0 * m.density);
    s.fill.add(100.0 * m.fillOfMax);
    s.height.add(m.height);
    s.comOffset.add(m.comOffset);
    s.runtime.add(m.runtimeMs);
}

static void row(const char* label, const Stat& a, const Stat& b, int decimals) {
    // fmt: Python-style format strings, type-safe at compile time (no printf %-mismatch bugs).
    fmt::print("  {:<18} {:>9.{}f} ± {:<7.{}f} {:>9.{}f} ± {:<7.{}f}\n", label, a.mean, decimals,
               a.stddev(), decimals, b.mean, decimals, b.stddev(), decimals);
}

int main(int argc, char** argv) {
    int seeds = 50;
    CLI::App app{"Compare greedy layer vs extreme points over many random box sets."};
    app.add_option("--seeds", seeds, "How many random box sets per size")->check(CLI::Range(1, 10000))->capture_default_str();
    CLI11_PARSE(app, argc, argv);

    Packer greedy = [](const std::vector<Box>& b) { return packGreedyLayer(b); };
    Packer ep = [](const std::vector<Box>& b) { return packExtremePoints(b); };

    // n = 40: usually everything fits, so the question is "how tight?" (density, height).
    // n = 70: more than fits, so the question is "how much gets on?" (placed %, fill).
    for (int n : {40, 70}) {
        AlgoStats g, e;
        int epWinsVolume = 0, ties = 0;
        for (int seed = 1; seed <= seeds; ++seed) {
            std::vector<Box> boxes = generateBoxes(n, uint32_t(seed));
            Metrics mg = timed(greedy, boxes), me = timed(ep, boxes);
            record(g, mg);
            record(e, me);
            if (me.placedVolume > mg.placedVolume) ++epWinsVolume;
            else if (me.placedVolume == mg.placedVolume) ++ties;
        }
        fmt::print("\n{} boxes per pallet, {} seeds          greedy_layer        extreme_points\n", n, seeds);
        row("placed boxes (%)", g.placedPct, e.placedPct, 1);
        row("fill of max (%)", g.fill, e.fill, 1);
        row("density (%)", g.density, e.density, 1);
        row("height (mm)", g.height, e.height, 0);
        row("CoM offset (mm)", g.comOffset, e.comOffset, 0);
        row("runtime (ms)", g.runtime, e.runtime, 2);
        fmt::print("  EP places more volume on {}/{} seeds ({} ties)\n", epWinsVolume, seeds, ties);
    }
    return 0;
}
