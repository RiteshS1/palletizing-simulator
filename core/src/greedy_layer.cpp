// Greedy layer packing (the baseline).
//
// Idea: like stacking books on shelves.
//  1. Sort boxes tallest first (so boxes in the same pass have similar heights and the next
//     pass gets a flatter surface to stand on), heavier first on ties (heavy goes low).
//  2. One "pass" walks the deck in rows along x. A row's depth (y size) is set by its first box.
//     Each box goes into the FIRST open row that has room (First-Fit), else opens a new row.
//  3. Each box drops straight down onto whatever is below it (gravity).
//  4. Boxes that failed a rule wait for the next pass, which starts again at the back-left
//     corner on top of the previous pass. Stop when a whole pass places nothing.
//
// Greedy = every decision is made once, locally, and never revisited. Cheap, but it can't see
// that placing box A here blocks a much better spot for box B later.

#include <algorithm>

#include "packer.hpp"

namespace pal {

namespace {

struct Row {
    int y;        // where the row starts along y
    int depth;    // row size along y (set by its first box)
    int xCursor;  // next free x in this row
};

// Height at which a box with this footprint comes to rest: the highest top beneath it. O(n).
int dropHeight(const std::vector<Placement>& placed, int x, int y, Vec3 size) {
    AABB footprint{{x, y, 0}, {x + size.x, y + size.y, 1}};
    int z = 0;
    for (const Placement& p : placed) {
        AABB q = p.aabb();
        if (footprintOverlap(q, footprint) > 0) z = std::max(z, q.max.z);
    }
    return z;
}

bool tryAt(PalletState& pallet, const Box& b, int x, int y, bool rotated) {
    Vec3 s = orientedSize(b, rotated);
    int z = dropHeight(pallet.placements(), x, y, s);
    return pallet.tryPlace(Placement{b, Vec3{x, y, z}, rotated}).ok();
}

bool placeInPass(PalletState& pallet, std::vector<Row>& rows, const Box& b) {
    const PalletSpec& spec = pallet.spec();

    // First-Fit: the first existing row with room wins.
    for (Row& r : rows) {
        for (bool rot : {false, true}) {
            Vec3 s = orientedSize(b, rot);
            if (r.xCursor + s.x > spec.length || s.y > r.depth) continue;
            if (tryAt(pallet, b, r.xCursor, r.y, rot)) {
                r.xCursor += s.x;
                return true;
            }
        }
    }

    // Open a new row behind the last one. Try the shallower orientation first so rows stay
    // thin and more of them fit.
    int y = rows.empty() ? 0 : rows.back().y + rows.back().depth;
    bool shallowFirst = b.d > b.w;  // rotated puts w along y
    for (bool rot : {shallowFirst, !shallowFirst}) {
        Vec3 s = orientedSize(b, rot);
        if (y + s.y > spec.width || s.x > spec.length) continue;
        if (tryAt(pallet, b, 0, y, rot)) {
            rows.push_back(Row{y, s.y, s.x});
            return true;
        }
    }
    return false;
}

}  // namespace

PackResult packGreedyLayer(const std::vector<Box>& boxes, const PalletSpec& spec,
                           const Rules& rules) {
    std::vector<Box> remaining = boxes;
    // Comparator: return true if a should come BEFORE b. It must be a strict weak ordering
    // (never "a before a"), or std::sort has undefined behaviour. The id tie-break makes the
    // order fully deterministic.
    std::sort(remaining.begin(), remaining.end(), [](const Box& a, const Box& b) {
        if (a.h != b.h) return a.h > b.h;
        if (a.weight != b.weight) return a.weight > b.weight;
        return a.id < b.id;
    });

    PalletState pallet(spec, rules);
    while (!remaining.empty()) {
        std::vector<Row> rows;  // each pass starts fresh rows at the back-left corner
        std::vector<Box> notPlaced;
        for (const Box& b : remaining) {
            if (!placeInPass(pallet, rows, b)) notPlaced.push_back(b);
        }
        if (notPlaced.size() == remaining.size()) break;  // a whole pass placed nothing: done
        remaining.swap(notPlaced);  // O(1): swaps internal pointers, no copying
    }
    return PackResult{"greedy_layer", pallet, remaining};
}

}  // namespace pal
