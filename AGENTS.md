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
make -C core            # build library, apps and tests
make -C core test       # run unit tests (must pass before a phase is called done)
make -C core bench      # greedy vs extreme-points over 50 seeds
make -C core run        # write build/plan_greedy.json and build/plan_ep.json (seed 42)
make -C core clean
make -C core plans      # write the viewer's data into web/public/data/
make -C core wasm       # compile the engine to WebAssembly (needs Emscripten em++)
./core/build/bin/palletize --algo greedy|ep --n 40 --seed 42 [--out plan.json]
./core/build/bin/wes_sim --orders 24 --seed 7 [--policy waves|order] [--out wes.json]

cd web && npm install
npm run dev             # regenerates data + WASM, then starts Vite on :5173
npm run build           # production build into web/dist
npm run test:e2e        # Playwright end-to-end tests (desktop + mobile) against the build
```
CI/CD: `.github/workflows/ci.yml` runs core tests (Ubuntu + macOS), then e2e, then deploys
`web/dist` to GitHub Pages on pushes to main.

## Conventions
- **Units**: lengths in integer **millimetres** (`int`), weight in **kg** (`double`).
  Volumes and areas use `int64_t` (a pallet volume overflows 32-bit `int`).
- **Frame**: pallet frame, origin at the back-left corner of the pallet's top deck,
  x along the 1200 mm side, y along the 1000 mm side, **z up**. The viewer converts to three.js y-up.
- **Boxes stay upright**: only yaw rotation (swap w and d). Never tip a box onto its side.
- **AABBs are half-open** `[min, max)`: touching faces do NOT count as overlap.
- **Determinism**: all randomness comes from a seeded `std::mt19937`. Same seed, same output.
- No third-party C++ dependencies. Standard library only, plain Makefile (no CMake).
- Namespace `pal`. Headers in `core/include/`, implementations in `core/src/`,
  executables in `core/apps/`, tests in `core/tests/` (use the `TEST`/`CHECK` macros in `testing.hpp`).
- Comment the *why* on algorithmic code, not the obvious *what*.

## Content rules
- Do **not** mention any specific company, employer or job application anywhere in the repo or the site.
  This is a general-purpose portfolio and learning project.

## Workflow
- Work phase by phase following `idea/steps.md`. When a phase is done: tests pass, tick its box,
  and add what was learned to `idea/concepts.md`.
- Don't commit unless the user asks.
