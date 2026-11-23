# Build Steps

Each phase: **build** → **learn** (notes go into [`concepts.md`](concepts.md)) → **verify**.
Tick the box when a phase is done.

- [x] **Phase 0: Docs and scaffolding**
  - Build: `idea/`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `.gitignore`, Makefile skeleton
  - Learn: what palletizing is, the robot cell, WES vs WMS vs WCS
  - Verify: `make -C core test` runs (even with zero tests)

- [x] **Phase 1: Geometry core**
  - Build: `Vec3`, `AABB`, `Box`, `Placement`, `PalletSpec`, seeded box generator, test runner
  - Learn: coordinate frames, AABB intersection, integer millimetres, 64-bit volumes,
    yaw-only rotation, reproducible randomness
  - Verify: overlap/containment/generator tests pass

- [x] **Phase 2: Rules and constraints** (`stability.cpp`, `pallet_state.cpp`)
  - Build: `checkPlacement()` covering bounds, max load, overlap, top-down reachability,
    support ratio, center-over-support-polygon, load bearing; `PalletState` with running center of mass
  - Learn: support polygon, convex hull (monotone chain), cross product, static stability,
    center of mass, top-down approach, fail-fast check ordering
  - Verify: 11 hand-built stacks that should pass and fail

- [x] **Phase 3: Greedy baseline** (`greedy_layer.cpp`)
  - Build: sort boxes, then fill layers row by row (shelf algorithm)
  - Learn: greedy algorithms, comparators, First-Fit-Decreasing, NP-hardness, O(n log n)
  - Verify: every placement passes the Phase 2 rules

- [x] **Phase 4: Extreme-Points heuristic** (`extreme_points.cpp`)
  - Build: candidate corner points, try 2 orientations per point, score, place, update points
  - Learn: candidate generation, scoring functions, pruning, complexity, randomized restarts
  - Verify: valid placements; fill rate beats greedy on average

- [x] **Phase 5: Metrics, JSON and benchmark**
  - Build: `metrics.cpp`, JSON writer, `palletize` CLI, `bench` app, GitHub Actions CI
  - Learn: utilization metrics, fair benchmarking (same seeds, mean/std), serialization
  - Verify: `make bench` prints a comparison table

- [x] **Phase 6: three.js viewer** (`web/`)
  - Build: pallet and boxes, orbit camera, play/pause/step slider, algorithm toggle, metrics panel
  - Learn: scene graph, z-up to y-up frame conversion, animation loop, replaying a plan
  - Verify: viewer metrics match the CLI output

- [x] **Phase 7: WES order layer** (`wes.cpp`, `wes_sim`)
  - Build: two policies (order-by-order with a priority queue, and batched waves), order-to-pallet
    assignment, pallet open/close, multi-pallet "Orders" view with stretch-wrapped shipped pallets
  - Learn: heaps, hash maps, First-Fit/Best-Fit, online vs offline packing, wave batching,
    latency vs efficiency, event-driven simulation
  - Verify: each order assigned exactly once; no pallet breaks a limit

- [x] **Phase 8: WebAssembly**
  - Build: `make wasm` with Emscripten + embind; "generate live" button in the viewer
  - Learn: WASM, embind, one C++ core shared by CLI and browser
  - Verify: browser output identical to CLI output for the same seed

## Testing and tooling track (runs alongside the phases)
| Layer | Tool | Arrives in |
|---|---|---|
| Unit tests | own `TEST`/`CHECK` runner (`core/tests/`) | Phase 1 (done) |
| Property / invariant tests | same runner, 100s of random seeds, assert every rule holds | Phase 3–4, 7 (done) |
| Benchmark / regression | `bench` app, fixed seeds | Phase 5 (done) |
| CI | GitHub Actions: build + test on every push/PR (`.github/workflows/ci.yml`) | Phase 5 (done) |
| End-to-end (e2e) | Playwright (`web/e2e/`): desktop + mobile, incl. WASM == CLI check | Phase 6–8 (done) |
| CD | Same workflow deploys the viewer to GitHub Pages after all tests pass on main | Phase 6–8 (done) |
