# AGENTS.md

Instructions for any AI coding agent working in this repo.

## Project
**PalletLab**: a learning platform for robotics with C++ around a palletizing planner.
- `core/`: C++20 engine (geometry, stacking rules, greedy + extreme-points packers, WES, Eigen robot poses, JSON API, WASM bindings)
- `ros2/`: ROS 2 Jazzy packages (`palletizer_interfaces`, `palletizer_ros`)
- `web/`: Next.js 16 site: landing, docs (MDX in `web/src/content/docs/{en,ja}`), simulator, AI assistant (`/api/chat`)
- `idea/`: the idea, the phased roadmap (`steps.md`) and concept notes (`concepts.md`)

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

# Website (in web/; read node_modules/next/dist/docs before changing Next.js code, see web/AGENTS.md)
npm run engine | dev | lint | typecheck | test | build | test:e2e
```
CI: `.github/workflows/ci.yml`: core (Linux + macOS), sanitizers, ROS 2 (Docker) → web (engine,
artifact check, lint, types, Vitest, build, Playwright).
Deploy: Vercel Git integration (project root directory `web`) on every push; production on `main`.
**After changing `core/`, run `npm run engine` in `web/` and commit `web/public/data` + `web/public/wasm`**
(Vercel has no C++ toolchain; CI fails if the committed plans are stale).

## Web conventions
- Every UI string lives in `web/messages/{en,ja}.json`; every docs chapter exists in both
  `content/docs/en` and `content/docs/ja` (a Vitest test enforces parity). Register chapters in `src/lib/docs.ts`.
- Constants shared by server and client go in plain modules (`src/lib/*`), never in `"use client"` files.
- 3D: the pallet frame is a scaled, rotated group (`PalletStation`); per-frame animation reads the
  `Player` store in `useFrame` instead of re-rendering React.
- AI keys (`GROQ_API_KEY`, `GEMINI_API_KEY`) live only in `.env.local` / Vercel env vars, never in code or git.
- Orange (`signal`) surfaces use ink text (white on orange fails WCAG AA).

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
- Never name any specific company, employer or job application anywhere in the repo or the site.
  The only allowed wording about inspiration: "inspired by the work of industry leaders in Japanese
  warehouse robotics".

## Workflow
- Work phase by phase following `idea/steps.md`. When a phase is done: tests pass, tick its box,
  and add what was learned to `idea/concepts.md`.
- Committing and pushing to `main` is pre-authorized once all checks pass locally.
