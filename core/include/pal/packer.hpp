#pragma once
// Packing algorithms. Each takes the offered boxes and returns a pallet plan:
// the placements IN ORDER (the order the robot places them) plus the boxes that didn't fit.

#include <string>
#include <vector>

#include "pal/pallet_state.hpp"

namespace pal {

struct PackResult {
    std::string algorithm;
    PalletState pallet;          // placements() is the step-by-step plan
    std::vector<Box> unplaced;
};

// Phase 3: sort tallest first, then fill the deck in rows (shelves), pass after pass ("layers").
// Each box drops onto whatever is below it. Simple, fast, predictable, and leaves gaps.
PackResult packGreedyLayer(const std::vector<Box>& boxes, const PalletSpec& spec = {},
                           const Rules& rules = {});

struct EPOptions {
    int randomRestarts = 8;  // extra runs with a randomly perturbed box order
    uint32_t seed = 1;       // seed for those perturbations (keeps the result deterministic)
};

// Phase 4: Extreme-Points heuristic. Keeps a set of candidate corner points; each box tries every
// point x 2 orientations, and the best-scoring valid spot wins. Run with several box orderings
// (multi-start) and keep the best plan.
PackResult packExtremePoints(const std::vector<Box>& boxes, const PalletSpec& spec = {},
                             const Rules& rules = {}, const EPOptions& options = {});

// Add `boxes` (heaviest first) onto a pallet that may already hold boxes, using extreme points.
// All-or-nothing: if any box doesn't fit, returns false and leaves `pallet` unchanged.
// Used by the WES layer, because one customer order must not be split across pallets.
bool addBoxesExtremePoints(PalletState& pallet, const std::vector<Box>& boxes);

}  // namespace pal
