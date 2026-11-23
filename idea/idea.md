# Idea: 3D Palletizing Simulator

## The problem
A robot arm stands next to a conveyor. Cartons of different sizes and weights arrive, and the
robot has to stack them onto a pallet. The pallet then gets wrapped and shipped.

Deciding *where* each carton goes is a planning problem:
- Pack **densely**, because air costs money: fewer pallets, fewer trucks.
- Keep the stack **stable**, so it doesn't topple during wrapping or transport.
- Respect **physical rules**: don't crush light boxes under heavy ones, stay under the height and
  weight limits, and only use placements a robot can actually reach from above.

This is a 3D variant of **bin packing**, which is NP-hard. Real systems therefore use heuristics:
fast rules that give good (not provably optimal) answers in milliseconds.

## What we build
1. **Packing core (C++17)**: geometry, constraint checks, and two algorithms:
   - a **greedy layer** baseline (simple and predictable),
   - an **Extreme-Points** heuristic (smarter placement, usually denser).
2. **Benchmark**: run both algorithms on the same random box sets and compare fill rate, height,
   stability and runtime.
3. **3D viewer (three.js)**: replay a plan box by box in the browser, like watching the robot work.
4. **WES layer**: a small order queue that decides which pallet each customer order goes to.
5. **WebAssembly**: the same C++ core compiled to run live in the page.

## Rules a placement must satisfy
| Rule | Meaning | Default |
|---|---|---|
| Bounds | Box fully inside the pallet footprint, under the max height | 1200 × 1000 mm, 1800 mm high |
| No overlap | Boxes never intersect (touching faces is fine) | n/a |
| Support | At least X% of the box's base rests on the pallet or on box tops at exactly that height | 75% |
| Center over support | The box's center must lie inside the convex hull of its contact areas | on |
| Reachable from above | Nothing may already sit above the spot (top-down gripper) | on |
| Load bearing | A box may not rest on a box lighter than itself (scaled by a factor) | factor 1.0 |
| Max load | Total weight on the pallet | 1000 kg |
| Upright only | Boxes may only rotate about the vertical axis ("this side up") | 2 orientations |

## Success metrics
- **Volume utilization**: placed box volume ÷ (pallet area × used height).
- **Boxes placed**: out of the boxes offered.
- **Stack height** and **center-of-mass offset** from the pallet center.
- **Runtime** per pallet.

## Non-goals (for now)
- Real robot kinematics and motion planning (we assume a top-down gripper that can reach anywhere).
- Physics simulation. We use rule-based static stability, not a physics engine.
- Optimal solvers (MILP/CP). Possibly later, as a stretch comparison.
