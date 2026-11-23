# Concepts

The "textbook" for this project. Each phase adds its ideas here, each in three parts:
**plain words**, **the precise version**, and **interview angle** (how you'd explain it, edge
cases, complexity).

---

## Phase 0: The domain

### Palletizing
**Plain words:** Stacking cartons onto a pallet so they can be shipped as one unit.

**Precise:** *Single-SKU* palletizing stacks identical boxes in a repeating pattern, which can be
pre-computed once. *Mixed-case* palletizing gets boxes of different sizes and weights, often in an
order the planner doesn't fully control (they arrive on a conveyor). Each pallet then needs fresh
planning, which is the hard and interesting version, and the one we build.

**Interview angle:** Mixed-case palletizing is a 3D bin-packing problem with extra physical
constraints (support, load bearing, reachability). Being "online" (boxes arrive one by one, with
limited lookahead) versus "offline" (all boxes known up front) changes which algorithms you can use.

### The robot cell
A typical cell has: an **infeed conveyor** bringing boxes, a **vision system** that measures each
box (size and pose), an **industrial arm** with a gripper (vacuum or fork), and one or more
**pallet stations**. The planner's output for each box is a **place pose**: position plus yaw.
The motion planner then computes the arm's path to get there without collisions.

We place boxes **top-down**: the gripper approaches from above. So a box can only go where nothing
is above it yet, and where the gripper won't hit neighbouring boxes on the way down.

### WES vs WMS vs WCS
| Layer | Question it answers | Time scale |
|---|---|---|
| **WMS** (Warehouse Management System) | What stock do we have, which orders exist? | hours/days |
| **WES** (Warehouse Execution System) | Which order runs now, on which station/pallet? | minutes |
| **WCS** (Warehouse Control System) | Drive this conveyor, tell this robot to pick | seconds |

Our Phase 7 order queue is a tiny **WES**: it decides which pallet each order goes to.

---

## Phase 1: Geometry core

### Coordinate frames
**Plain words:** Every position needs a reference point. Ours is the back-left corner of the
pallet's top deck, with x along the long side, y along the short side, z up.

**Precise:** A *frame* is an origin plus axes. Robots juggle many: world, robot base, tool (gripper),
camera, pallet. Converting a pose between frames is a rigid transform (rotation + translation).
Our planner works entirely in the **pallet frame**; the robot later transforms placements into its
base frame. three.js uses **y-up**, so the viewer swaps axes (Phase 6).

**Interview angle:** "Which frame is that pose in?" is the most common source of robotics bugs.
Always name the frame in variable names or docs.

### Axis-Aligned Bounding Boxes (AABB)
**Plain words:** A box whose edges are parallel to the axes, described by two corners: `min` and `max`.

**Precise:** Two AABBs intersect **iff** their intervals overlap on *every* axis. One axis with a gap
is enough to separate them (this is the Separating Axis Theorem specialised to boxes).
Interval overlap length is `max(0, min(a1, b1) - max(a0, b0))`. See `core/include/geometry.hpp`.

**Half-open intervals** `[min, max)`: a box from 0 to 100 and a box from 100 to 200 *touch* but do
not overlap. That's exactly right for stacking face to face, and it removes off-by-one confusion.

**Interview angle:** Intersection test is O(1). Checking a new box against all n placed boxes is
O(n), so a full plan is O(n²) checks. For thousands of objects you'd add a spatial index
(uniform grid, octree, BVH); for ~50 boxes per pallet, a plain loop is faster and simpler.

### Integer millimetres instead of floats
**Plain words:** Store sizes as whole millimetres so "is box A's top exactly at box B's bottom?"
is always answered correctly.

**Precise:** Floating point can't represent most decimals exactly (`0.1 + 0.2 != 0.3`). Stacking
logic depends on exact equality of heights, so floats would need epsilon comparisons everywhere,
and epsilons cause their own bugs. A 1 mm grid is finer than any real carton tolerance.

### Overflow: why volumes are `int64_t`
`1200 × 1000 × 1800 = 2,160,000,000`, but a 32-bit `int` maxes out at `2,147,483,647`.
Signed overflow in C++ is **undefined behaviour**, not just a wrong number. So areas and volumes
are computed as `int64_t`, casting the *first* factor (`int64_t(x) * y * z`) so the whole
multiplication happens in 64-bit. There's a test for this.

### Yaw-only rotation
Cartons have a "this side up". Allowing only rotation about z gives **2 orientations**
(w×d or d×w) instead of 6. Fewer options means a smaller search space but slightly worse packing:
a real trade-off between product safety and density.

### Reproducible randomness
**Plain words:** The same seed always gives the same boxes, so comparisons between algorithms are
fair and bugs can be replayed.

**Precise:** `std::mt19937` (Mersenne Twister) has a fully specified output sequence. The standard
*distributions* (`std::uniform_int_distribution`, ...) do **not**: libc++ and libstdc++ may
produce different values from the same engine. So `generator.cpp` maps raw numbers itself.
`rng() % range` has a tiny *modulo bias*; it's negligible here, but worth knowing (the unbiased fix
is rejection sampling).

### A test framework in 30 lines
`core/tests/testing.hpp` uses **static registration**: `TEST(x)` creates a global object whose
constructor runs before `main()` and pushes `x` into a registry. The registry is a
**function-local static** to dodge the *static initialization order fiasco* (globals across
files have no guaranteed construction order, but a function-local static is built on first use).

---

## Phase 2: Stacking rules

### Fail-fast check ordering
`checkPlacement()` runs the cheap O(1) checks (bounds, weight) first, then one O(n) pass over
placed boxes, then the support maths. The first failure returns immediately. Most candidates are
rejected early, and that matters because a packer calls this thousands of times per pallet.

### Support ratio
Supported area = sum of footprint overlaps with boxes whose **top z equals our bottom z**
(or the whole base if we're on the deck). Supporters can't overlap each other (they'd collide),
so summing is safe. Ratio = supported / base area. Default minimum: 75%.

### Support polygon and center of mass
**Plain words:** A table with legs only on one side falls over. An object is statically stable
when its center of mass, projected straight down, lands inside the area its contacts span.

**Precise:** The *support polygon* is the **convex hull** of all contact regions. Stable iff the
CoM's projection lies inside it (assuming uniform box density, CoM = geometric center).
Note: a bridge across two pillars has 50% area support but is perfectly stable, because the
center is inside the hull. The area rule and the polygon rule measure different things.

**Neat fact:** any line through a rectangle's center splits it into two equal halves. So if
more than 50% of the base is supported, the center is *always* inside the hull. With our 75%
threshold the polygon rule never fires; it matters once you relax the ratio (try 0.4).

### Convex hull: Andrew's monotone chain
Sort points by (x, y); sweep left to right building the lower hull, then right to left for the
upper hull. While the last three points don't turn left (cross product ≤ 0), pop the middle one.
**O(k log k)** (dominated by the sort). Each point is pushed and popped at most once per pass.

### Cross product as an orientation test
`cross(o, a, b) = (a-o) × (b-o)`: positive means a left (counter-clockwise) turn, negative a
right turn, zero collinear. It's the building block of almost all 2D computational geometry:
hulls, point-in-polygon, segment intersection.

### Doubled coordinates
Box centers can land on half millimetres. Multiplying every coordinate by 2 keeps them integers,
so the hull and the inside test stay exact (no float epsilon).

### Top-down reachability
A robot placing from above can't slide a box under an overhang. Rule: reject a spot if any placed
box overlaps its footprint and sits at or above its top. (Real systems also model gripper size and
approach clearance.)

### Load bearing
Simple pairwise version: weight ≤ supporter weight × loadFactor. Real systems track the
**cumulative** load each box carries, propagated down the "who rests on whom" graph (a DAG),
against each box's crush strength.

### Running sums for center of mass
CoM = Σ(wᵢ·cᵢ) / Σwᵢ. Keeping the three weighted sums updated on each placement makes the query O(1)
instead of O(n). This is the same idea as prefix sums: maintain an aggregate instead of recomputing.

---

## Phase 3: Greedy layer packing

### Greedy algorithms
Make the locally best choice now and never revisit it. Fast and simple, but blind to how a
choice hurts future choices. Greedy is *optimal* only for problems with special structure
(e.g. activity selection, Huffman coding, Dijkstra); for bin packing it's only a heuristic.

### Bin packing is NP-hard
Deciding whether n items fit into k bins is NP-complete (a reduction from PARTITION: "can these
numbers be split into two equal-sum halves?" is exactly "do they fit into 2 bins of size sum/2?").
So no known algorithm is both exact and polynomial; real systems use heuristics plus good
engineering. 3D packing with stability rules is harder still.

### First-Fit-Decreasing (FFD)
Sort items largest first, put each into the first bin (here: row) with room. For 1D bin packing,
FFD uses at most 11/9·OPT + 6/9 bins, a classic approximation result. Our greedy is FFD on rows.
Sorting is O(n log n); the passes add O(n²) rule checks.

### Comparators and strict weak ordering
`std::sort` needs `cmp(a, b)` = "a goes before b", and it must be a *strict weak ordering*
(`cmp(a, a)` is false, transitive, ...). Using `>=` instead of `>` breaks this and is undefined
behaviour (can crash). An id tie-break makes the order fully deterministic.

### Lesson from the benchmark
Greedy chooses a spot first, then asks the rules. EP asks the rules about every candidate and picks
the best valid one. Relaxing load bearing and support raised greedy's fill from 38% to 58%, but EP
only from 64% to 71%: **search makes an algorithm robust to constraints.**

---

## Phase 4: Extreme-Points heuristic

### Extreme points
After placing a box, the useful spots for the next box are the corners it creates: to its right,
behind it and on top of it. Each is also **projected**: slid back along the other axes until it
hits a box or wall, so points sit snug in the stack's corners (Crainic, Perboli & Tadei, 2008).
Points inside a placed box are pruned. At most ~9 new points per box.

### Candidate generation + scoring
"Generate candidates, filter by constraints, rank by score" is the core pattern of practical
planners (grasp planning, motion planning, scheduling). Our score is a lexicographic tuple:
(lowest z, most contact area, nearest back, nearest left). `std::tuple` compares lexicographically.

### Ordered set vs hash set
`std::set` (red-black tree): O(log n) insert, sorted iteration, deterministic.
`std::unordered_set` (hash table): O(1) average, but iteration order depends on the hash
implementation: ties would be broken differently on different platforms.

### Complexity
Per box: P points × 2 orientations × O(n) rule check, with P = O(n), so O(n²) per box and
**O(n³)** per run, times R restarts. For n = 40, R = 12: a few milliseconds.

### Multi-start / randomized restarts
Run the same heuristic with different box orders (4 fixed orderings + 8 "heavy-first with
noise") and keep the best. A cheap way to escape one bad greedy decision; it's the idea behind
GRASP and random-restart hill climbing. The noise is seeded, so the result stays reproducible.

---

## Phase 5: Metrics, JSON, benchmark, CI

### Metrics
- **density** = placed volume / (deck area × stack height): how little air is inside the stack
- **fill of max** = placed volume / (deck area × max height): how full the pallet is
- **CoM offset**: horizontal distance of the center of mass from the pallet center (lower = safer)

### Fair benchmarking
Same inputs for both algorithms (same seeds), many seeds, report **mean ± std**. Use
`std::chrono::steady_clock` (monotonic) for timing, never the wall clock.

### Welford's algorithm
Running mean and variance in one pass without storing samples, and numerically stable:
`delta = x − mean; mean += delta/n; m2 += delta·(x − mean); var = m2/(n−1)`.

### JSON writer and a stack
Commas are the only hard part of writing JSON. Containers nest, so we keep a stack with one
"has an element yet?" flag per open container: push on `{`/`[`, pop on `}`/`]`.

### stdout vs stderr
Data goes to stdout, human messages to stderr, so `palletize > plan.json` gives clean JSON.

### Property tests and test oracles
Property test: assert something true for *every* input (no overlaps, every id exactly once,
replaying the plan passes every rule) over hundreds of random seeds. The checks use an independent
brute-force **oracle** (pairwise O(n²) intersection) so a packer bug can't hide behind itself.

### CI with GitHub Actions
`.github/workflows/ci.yml`: on push/PR, a **matrix** of Ubuntu + macOS runners builds and tests.
Two standard libraries (libstdc++ and libc++) also prove the seeded generator is portable.
