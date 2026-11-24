// Extreme-Points (EP) packing (the smarter heuristic).
//
// After each placement, the interesting places for the NEXT box are the corners the new box
// creates: right of it, behind it, on top of it. Those corners are "extreme points".
// Each corner is also slid back along the other axes until it hits a wall or another box
// ("projection"), so points end up snug in the corners of the existing stack.
//
// For each box: try every extreme point x both orientations, keep the valid one with the best
// score, place it, update the point set. Then repeat the whole thing with different box orders
// (multi-start) and keep the best pallet.

#include <algorithm>
#include <set>
#include <tuple>

#include "pal/packer.hpp"
#include "pal/random.hpp"

namespace pal {

namespace {

// Access x/y/z by index (0/1/2) so one projection function works for all three axes.
int& coord(Vec3& v, int axis) { return axis == 0 ? v.x : axis == 1 ? v.y : v.z; }

// Ordering for std::set: lexicographic (z, y, x). An ordered set gives deduplication AND a fixed
// iteration order; an unordered_set's order depends on the hash implementation, which could make
// tie-breaking (and therefore the plan) differ between platforms.
struct PointLess {
    bool operator()(const Vec3& a, const Vec3& b) const {
        return std::tie(a.z, a.y, a.x) < std::tie(b.z, b.y, b.x);
    }
};
using PointSet = std::set<Vec3, PointLess>;

bool pointInside(const Vec3& p, const AABB& q) {
    return p.x >= q.min.x && p.x < q.max.x && p.y >= q.min.y && p.y < q.max.y &&
           p.z >= q.min.z && p.z < q.max.z;
}

// Slide point p towards 0 along `axis` until it hits the face of a box (or the wall/deck at 0).
Vec3 project(const std::vector<Placement>& placed, Vec3 p, int axis) {
    int stop = 0;
    for (const Placement& pl : placed) {
        AABB q = pl.aabb();
        bool inLine = true;  // is q in the path of the slide (overlapping on the other two axes)?
        for (int a = 0; a < 3; ++a) {
            if (a == axis) continue;
            int v = coord(p, a);
            if (v < coord(q.min, a) || v >= coord(q.max, a)) inLine = false;
        }
        int face = coord(q.max, axis);
        if (inLine && face <= coord(p, axis)) stop = std::max(stop, face);
    }
    coord(p, axis) = stop;
    return p;
}

void updatePoints(PointSet& points, const PalletState& pallet, const Placement& placed) {
    const AABB a = placed.aabb();
    const auto& all = pallet.placements();

    // Points now covered by the new box are useless.
    for (auto it = points.begin(); it != points.end();) {
        it = pointInside(*it, a) ? points.erase(it) : std::next(it);
    }

    // The three corners the new box creates, plus each one projected along the other two axes.
    const Vec3 corners[3] = {{a.max.x, a.min.y, a.min.z},   // to the right (+x)
                             {a.min.x, a.max.y, a.min.z},   // behind (+y)
                             {a.min.x, a.min.y, a.max.z}};  // on top (+z)
    const PalletSpec& s = pallet.spec();
    for (int axis = 0; axis < 3; ++axis) {
        const Vec3& c = corners[axis];
        for (Vec3 p : {c, project(all, c, (axis + 1) % 3), project(all, c, (axis + 2) % 3)}) {
            if (p.x >= s.length || p.y >= s.width || p.z >= s.maxHeight) continue;
            bool covered = false;
            for (const Placement& q : all) covered = covered || pointInside(p, q.aabb());
            if (!covered) points.insert(p);
        }
    }
}

// How much of the box's surface touches something: supported bottom area plus side faces flush
// against a pallet edge or another box. More contact = tighter, more stable packing.
int64_t contactArea(const AABB& c, double supportRatio, const std::vector<Placement>& placed,
                    const PalletSpec& s) {
    int64_t area = int64_t(supportRatio * double(c.footprintArea()));
    const int64_t faceX = int64_t(c.sizeY()) * c.sizeZ();  // area of a face perpendicular to x
    const int64_t faceY = int64_t(c.sizeX()) * c.sizeZ();
    if (c.min.x == 0) area += faceX;
    if (c.max.x == s.length) area += faceX;
    if (c.min.y == 0) area += faceY;
    if (c.max.y == s.width) area += faceY;
    for (const Placement& p : placed) {
        AABB q = p.aabb();
        int64_t oz = overlap1D(c.min.z, c.max.z, q.min.z, q.max.z);
        if (oz == 0) continue;
        if (q.max.x == c.min.x || q.min.x == c.max.x)
            area += oz * overlap1D(c.min.y, c.max.y, q.min.y, q.max.y);
        if (q.max.y == c.min.y || q.min.y == c.max.y)
            area += oz * overlap1D(c.min.x, c.max.x, q.min.x, q.max.x);
    }
    return area;
}

// Lower is better, compared lexicographically:
//   1. lowest z (fill bottom-up: keeps the center of mass low, stack stable)
//   2. most contact (snug fit, fewer gaps)
//   3. closest to the back (y), then to the left (x)
using Score = std::tuple<int, int64_t, int, int>;

// Best valid spot for box b among the current extreme points; false if none.
bool bestPlacement(const PalletState& pallet, const PointSet& points, const Box& b, Placement& out) {
    bool found = false;
    Score bestScore;
    for (const Vec3& ep : points) {
        for (bool rot : {false, true}) {
            if (rot && b.w == b.d) continue;  // square base: rotating changes nothing
            Placement cand{b, ep, rot};
            CheckResult r = pallet.check(cand);
            if (!r.ok()) continue;
            AABB a = cand.aabb();
            Score sc{a.min.z, -contactArea(a, r.supportRatio, pallet.placements(), pallet.spec()),
                     a.min.y, a.min.x};
            if (!found || sc < bestScore) {
                found = true;
                out = cand;
                bestScore = sc;
            }
        }
    }
    return found;
}

// Rebuild the extreme points of a pallet that already has boxes on it (used by the WES layer,
// which keeps adding orders to partly built pallets).
PointSet rebuildPoints(const PalletState& pallet) {
    PointSet points{Vec3{0, 0, 0}};
    for (const Placement& p : pallet.placements()) updatePoints(points, pallet, p);
    return points;
}

PackResult runOnce(const std::vector<Box>& order, const PalletSpec& spec, const Rules& rules) {
    PalletState pallet(spec, rules);
    PointSet points{Vec3{0, 0, 0}};
    std::vector<Box> unplaced;
    std::vector<std::vector<Vec3>> candidates;

    for (const Box& b : order) {
        Placement best;
        if (!bestPlacement(pallet, points, b, best)) {
            unplaced.push_back(b);
            continue;
        }
        candidates.emplace_back(points.begin(), points.end());
        pallet.tryPlace(best);
        updatePoints(points, pallet, best);
    }
    return PackResult{"extreme_points", pallet, unplaced, std::move(candidates)};
}

int64_t placedVolume(const PalletState& p) {
    int64_t v = 0;
    for (const Placement& pl : p.placements()) v += pl.box.volume();
    return v;
}

// Better plan = more volume on the pallet; on a tie, the lower stack.
bool better(const PackResult& a, const PackResult& b) {
    int64_t va = placedVolume(a.pallet), vb = placedVolume(b.pallet);
    if (va != vb) return va > vb;
    return a.pallet.stackHeight() < b.pallet.stackHeight();
}

// Sort a copy of the boxes by `key` (descending), ties broken by id for determinism.
template <typename Key>
std::vector<Box> sortedBy(std::vector<Box> boxes, Key key) {
    std::sort(boxes.begin(), boxes.end(), [&](const Box& a, const Box& b) {
        auto ka = key(a), kb = key(b);
        if (ka != kb) return ka > kb;
        return a.id < b.id;
    });
    return boxes;
}

}  // namespace

PackResult packExtremePoints(const std::vector<Box>& boxes, const PalletSpec& spec,
                             const Rules& rules, const EPOptions& options) {
    // Multi-start: a few sensible orderings first...
    std::vector<std::vector<Box>> orders = {
        sortedBy(boxes, [](const Box& b) { return b.weight; }),  // heavy first: load bearing friendly
        sortedBy(boxes, [](const Box& b) { return b.volume(); }),
        sortedBy(boxes, [](const Box& b) { return b.baseArea(); }),
        sortedBy(boxes, [](const Box& b) { return std::make_pair(b.h, b.baseArea()); }),
    };
    // ...then "heavy first, with noise": each box's weight is scaled by a random factor in
    // [0.7, 1.3) before sorting. Small swaps in the order can unlock better plans; the noise is
    // seeded, so the result is still deterministic.
    std::mt19937 rng(options.seed);
    for (int i = 0; i < options.randomRestarts; ++i) {
        std::vector<std::pair<double, Box>> keyed;
        for (const Box& b : boxes) keyed.push_back({b.weight * uniformReal(rng, 0.7, 1.3), b});
        std::sort(keyed.begin(), keyed.end(), [](const auto& a, const auto& b) {
            if (a.first != b.first) return a.first > b.first;
            return a.second.id < b.second.id;
        });
        std::vector<Box> order;
        for (const auto& kb : keyed) order.push_back(kb.second);
        orders.push_back(order);
    }

    PackResult best = runOnce(orders[0], spec, rules);
    for (size_t i = 1; i < orders.size(); ++i) {
        PackResult r = runOnce(orders[i], spec, rules);
        if (better(r, best)) best = r;
    }
    return best;
}

bool addBoxesExtremePoints(PalletState& pallet, const std::vector<Box>& boxes) {
    // Multi-start again: try a few box orders; keep the successful one with the lowest stack
    // (a lower, flatter top leaves more room for the orders that come after).
    const std::vector<std::vector<Box>> orders = {
        sortedBy(boxes, [](const Box& b) { return b.weight; }),
        sortedBy(boxes, [](const Box& b) { return b.baseArea(); }),
        sortedBy(boxes, [](const Box& b) { return b.volume(); }),
        sortedBy(boxes, [](const Box& b) { return std::make_pair(b.h, b.baseArea()); }),
    };
    const PointSet startPoints = rebuildPoints(pallet);
    bool any = false;
    PalletState best;
    for (const auto& order : orders) {
        PalletState trial = pallet;  // work on a copy: all-or-nothing
        PointSet points = startPoints;
        bool ok = true;
        for (const Box& b : order) {
            Placement spot;
            if (!bestPlacement(trial, points, b, spot)) { ok = false; break; }
            trial.tryPlace(spot);
            updatePoints(points, trial, spot);
        }
        if (ok && (!any || trial.stackHeight() < best.stackHeight())) {
            best = trial;
            any = true;
        }
    }
    if (any) pallet = std::move(best);  // otherwise `pallet` stays untouched
    return any;
}

}  // namespace pal
