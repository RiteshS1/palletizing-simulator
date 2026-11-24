# AGENTS.md

Instructions for any AI coding agent working in this repo.

## Project
A 3D palletizing simulator built as a **learning project** (robotics + data structures & algorithms).
- `core/`: C++17 packing engine (geometry, constraints, greedy and Extreme-Points packers, WES layer)
- `web/`: three.js + Vite viewer that replays plans step by step; `web/src/wasm.js` loads the
  engine compiled to WebAssembly; `web/e2e/` holds the Playwright tests
- `core/src/api.cpp`: the JSON entry points shared by the CLI apps and `core/wasm/bindings.cpp`
- `idea/`: the idea (`idea.md`), the phased roadmap (`steps.md`) and concept notes (`concepts.md`)

## Commands
```bash
# C++ engine (CMake presets + vcpkg; export VCPKG_ROOT=~/vcpkg)
cd core
cmake --preset release && cmake --build --preset release && ctest --preset release
cmake --preset debug-asan && cmake --build --preset debug-asan && ctest --preset debug-asan  # Linux (ASan hangs on macOS 26)
./build/release/bench --seeds 50        # greedy vs extreme points
./build/release/micro_bench             # Google Benchmark micro-benchmarks
./build/release/palletize --algo ep -n 40 --seed 42 [-o plan.json]
./build/release/wes_sim --orders 24 --seed 7 [--policy waves|order]

scripts/build-engine.sh                 # plans + WASM into web/public (needs Emscripten for WASM)
scripts/ros.sh build|test|run|call      # ROS 2 Jazzy workspace in Docker (colcon)
```
CI/CD: `.github/workflows/ci.yml` (core on Linux + macOS, sanitizers, ROS 2 in Docker, web e2e, deploy).

## Conventions
- **Units**: lengths in integer **millimetres** (`int`), weight in **kg** (`double`).
  Volumes and areas use `int64_t` (a pallet volume overflows 32-bit `int`).
- **Frame**: pallet frame, origin at the back-left corner of the pallet's top deck,
  x along the 1200 mm side, y along the 1000 mm side, **z up**. The viewer converts to three.js y-up.
- **Boxes stay upright**: only yaw rotation (swap w and d). Never tip a box onto its side.
- **AABBs are half-open** `[min, max)`: touching faces do NOT count as overlap.
- **Determinism**: all randomness comes from a seeded `std::mt19937`. Same seed, same output.
- C++20, CMake + CMakePresets, dependencies from vcpkg (`core/vcpkg.json`): fmt, nlohmann/json,
  Eigen (poses only; packing stays integer), CLI11, GoogleTest, Google Benchmark. No Boost.
- Namespace `pal`. Public headers in `core/include/pal/`, implementations in `core/src/`, apps in
  `core/apps/`, GoogleTest tests in `core/tests/`, micro-benchmarks in `core/bench/`.
- ROS 2 packages in `ros2/` (`palletizer_interfaces`, `palletizer_ros`); `core/` is also a colcon
  package (`package.xml`, build_type cmake) and installs `pal::core` for `find_package`.
- Comment the *why* on algorithmic code, not the obvious *what*.

## Content rules
- Do **not** mention any specific company, employer or job application anywhere in the repo or the site.
  This is a general-purpose portfolio and learning project.

## Workflow
- Work phase by phase following `idea/steps.md`. When a phase is done: tests pass, tick its box,
  and add what was learned to `idea/concepts.md`.
- Don't commit unless the user asks.
