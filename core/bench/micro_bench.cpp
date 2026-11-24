// Google Benchmark micro-benchmarks: how long do the hot operations take, and how do they scale?
//   ./build/release/micro_bench
// ->Complexity() asks the library to fit a Big-O curve to the measured times.
#include <benchmark/benchmark.h>

#include "pal/generator.hpp"
#include "pal/packer.hpp"

using namespace pal;

// One rule check against a pallet that already holds `n` boxes: expected O(n).
static void BM_CheckPlacement(benchmark::State& state) {
    const PackResult plan = packExtremePoints(generateBoxes(static_cast<int>(state.range(0)), 42));
    const Placement candidate{Box{999, 300, 300, 200, 1.0}, Vec3{0, 0, plan.pallet.stackHeight()}, false};
    for (auto _ : state) benchmark::DoNotOptimize(plan.pallet.check(candidate));
    state.SetComplexityN(static_cast<int64_t>(plan.pallet.placements().size()));
}
BENCHMARK(BM_CheckPlacement)->RangeMultiplier(2)->Range(8, 64)->Complexity(benchmark::oN);

// A whole extreme-points plan (12 multi-start runs) for n boxes.
static void BM_ExtremePoints(benchmark::State& state) {
    const auto boxes = generateBoxes(static_cast<int>(state.range(0)), 42);
    for (auto _ : state) benchmark::DoNotOptimize(packExtremePoints(boxes));
    state.SetComplexityN(state.range(0));
}
BENCHMARK(BM_ExtremePoints)->RangeMultiplier(2)->Range(10, 80)->Unit(benchmark::kMillisecond)->Complexity();

static void BM_GreedyLayer(benchmark::State& state) {
    const auto boxes = generateBoxes(static_cast<int>(state.range(0)), 42);
    for (auto _ : state) benchmark::DoNotOptimize(packGreedyLayer(boxes));
    state.SetComplexityN(state.range(0));
}
BENCHMARK(BM_GreedyLayer)->RangeMultiplier(2)->Range(10, 80)->Unit(benchmark::kMicrosecond)->Complexity();
