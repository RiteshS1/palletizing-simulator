#pragma once
// The physical rules every placement must obey. Both packing algorithms ask the same question,
// "is this placement allowed?", and this file is the single place that answers it.

#include <vector>

#include "pal/box.hpp"
#include "pal/pallet.hpp"

namespace pal {

struct Rules {
    // Fraction of the box's base that must rest on the deck or on box tops at exactly its height.
    double minSupportRatio = 0.75;

    // Load bearing: a box may rest on a supporter only if
    //   box.weight <= supporter.weight * loadFactor.
    // 1.0 means "never put a heavier box on a lighter one".
    double loadFactor = 1.0;

    // The box's center (projected down) must lie inside the support polygon
    // (convex hull of all contact areas). Otherwise it would tip over.
    bool requireCenterSupported = true;
};

// Why a placement was rejected. Checks run in this order and the first failure is reported.
enum class Violation {
    None,
    OutOfBounds,         // sticks out of the pallet footprint or above max height
    Overweight,          // pallet would exceed max load
    Overlap,             // intersects an already placed box
    Unreachable,         // something is already above this spot: a top-down gripper can't get in
    InsufficientSupport, // less than minSupportRatio of the base is supported
    CenterUnsupported,   // center of the box lies outside its support polygon
    LoadBearing,         // resting on a box that is too light
};

const char* toString(Violation v);

struct CheckResult {
    Violation violation = Violation::None;
    double supportRatio = 0.0;  // 0..1, filled in once the support step is reached
    bool ok() const { return violation == Violation::None; }
};

// Check `candidate` against the pallet and the boxes already on it.
// O(n) in the number of placed boxes: one pass over them.
CheckResult checkPlacement(const PalletSpec& pallet, const Rules& rules,
                           const std::vector<Placement>& placed, double placedWeight,
                           const Placement& candidate);

}  // namespace pal
