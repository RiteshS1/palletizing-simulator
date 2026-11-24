#include "pal/stability.hpp"

#include <algorithm>

namespace pal {

const char* toString(Violation v) {
    switch (v) {
        case Violation::None: return "ok";
        case Violation::OutOfBounds: return "out_of_bounds";
        case Violation::Overweight: return "overweight";
        case Violation::Overlap: return "overlap";
        case Violation::Unreachable: return "unreachable";
        case Violation::InsufficientSupport: return "insufficient_support";
        case Violation::CenterUnsupported: return "center_unsupported";
        case Violation::LoadBearing: return "load_bearing";
    }
    return "unknown";
}

namespace {

// 2D point in *doubled* millimetres. A box center can fall on a half millimetre
// (e.g. x = 0 + 250/2 = 125 is fine, but 0 + 251/2 = 125.5 isn't). Doubling every coordinate
// keeps everything an exact integer, so the geometry stays exact.
struct P2 {
    int64_t x, y;
};

bool operator<(const P2& a, const P2& b) { return a.x < b.x || (a.x == b.x && a.y < b.y); }
bool operator==(const P2& a, const P2& b) { return a.x == b.x && a.y == b.y; }

// Cross product of (a - o) and (b - o).
//   > 0: o -> a -> b turns left (counter-clockwise)
//   < 0: turns right
//   = 0: collinear
int64_t cross(const P2& o, const P2& a, const P2& b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

// Andrew's monotone chain convex hull, O(k log k) for k points.
// Sort points left to right, build the lower hull, then the upper hull; whenever the last
// three points make a right turn (or are collinear), the middle one is inside: pop it.
// Returns the hull in counter-clockwise order.
std::vector<P2> convexHull(std::vector<P2> pts) {
    std::sort(pts.begin(), pts.end());
    pts.erase(std::unique(pts.begin(), pts.end()), pts.end());
    if (pts.size() < 3) return pts;

    std::vector<P2> hull(2 * pts.size());
    size_t k = 0;
    for (size_t i = 0; i < pts.size(); ++i) {  // lower hull
        while (k >= 2 && cross(hull[k - 2], hull[k - 1], pts[i]) <= 0) --k;
        hull[k++] = pts[i];
    }
    for (size_t i = pts.size() - 1, lowerSize = k + 1; i > 0; --i) {  // upper hull
        while (k >= lowerSize && cross(hull[k - 2], hull[k - 1], pts[i - 1]) <= 0) --k;
        hull[k++] = pts[i - 1];
    }
    hull.resize(k - 1);  // the last point equals the first
    return hull;
}

// Point inside (or on the edge of) a counter-clockwise convex polygon:
// it must be on the left of, or on, every edge. O(h).
bool insideConvex(const std::vector<P2>& hull, const P2& p) {
    if (hull.size() < 3) return false;
    for (size_t i = 0; i < hull.size(); ++i) {
        if (cross(hull[i], hull[(i + 1) % hull.size()], p) < 0) return false;
    }
    return true;
}

// Add the 4 corners of the XY intersection of a and b (in doubled mm) to `pts`.
void addContactCorners(const AABB& a, const AABB& b, std::vector<P2>& pts) {
    int64_t x0 = 2 * std::max(a.min.x, b.min.x), x1 = 2 * std::min(a.max.x, b.max.x);
    int64_t y0 = 2 * std::max(a.min.y, b.min.y), y1 = 2 * std::min(a.max.y, b.max.y);
    pts.push_back({x0, y0});
    pts.push_back({x1, y0});
    pts.push_back({x1, y1});
    pts.push_back({x0, y1});
}

}  // namespace

CheckResult checkPlacement(const PalletSpec& pallet, const Rules& rules,
                           const std::vector<Placement>& placed, double placedWeight,
                           const Placement& candidate) {
    CheckResult result;
    const AABB c = candidate.aabb();

    // 1. Cheapest checks first: O(1) each.
    if (!contains(pallet.usableSpace(), c)) {
        result.violation = Violation::OutOfBounds;
        return result;
    }
    if (placedWeight + candidate.box.weight > pallet.maxLoad) {
        result.violation = Violation::Overweight;
        return result;
    }

    // 2. One pass over placed boxes: collisions, reachability, and who supports us.
    int64_t supportArea = 0;
    std::vector<P2> contactCorners;
    std::vector<const Placement*> supporters;

    if (c.min.z == 0) {  // standing on the deck: the whole base is supported
        supportArea = c.footprintArea();
        addContactCorners(c, c, contactCorners);
    }

    for (const Placement& p : placed) {
        const AABB q = p.aabb();
        if (intersects(c, q)) {
            result.violation = Violation::Overlap;
            return result;
        }
        int64_t shared = footprintOverlap(c, q);
        if (shared == 0) continue;  // not above or below us: irrelevant

        // A box already sitting above our spot blocks the gripper coming down from the top.
        if (q.min.z >= c.max.z) {
            result.violation = Violation::Unreachable;
            return result;
        }
        // Its top is exactly at our bottom: it's a supporter. Because placed boxes never overlap,
        // two supporters' footprints can't overlap either, so summing their areas is safe.
        if (q.max.z == c.min.z) {
            supportArea += shared;
            addContactCorners(c, q, contactCorners);
            supporters.push_back(&p);
        }
    }

    // 3. Support ratio.
    result.supportRatio = double(supportArea) / double(c.footprintArea());
    if (result.supportRatio + 1e-9 < rules.minSupportRatio) {
        result.violation = Violation::InsufficientSupport;
        return result;
    }

    // 4. Center over the support polygon (assumes uniform density: center of mass = geometric center).
    if (rules.requireCenterSupported) {
        P2 center{int64_t(c.min.x) + c.max.x, int64_t(c.min.y) + c.max.y};  // doubled coords
        if (!insideConvex(convexHull(contactCorners), center)) {
            result.violation = Violation::CenterUnsupported;
            return result;
        }
    }

    // 5. Load bearing: don't crush a lighter box.
    for (const Placement* s : supporters) {
        if (candidate.box.weight > s->box.weight * rules.loadFactor + 1e-9) {
            result.violation = Violation::LoadBearing;
            return result;
        }
    }

    return result;
}

}  // namespace pal
