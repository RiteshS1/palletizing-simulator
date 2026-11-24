#pragma once
// A pallet being built: the placements so far, plus running totals.
// Packing algorithms ask `check()` to test a candidate and call `tryPlace()` to commit it.

#include <vector>

#include "pal/stability.hpp"

namespace pal {

struct Point3d {
    double x = 0, y = 0, z = 0;
};

class PalletState {
public:
    explicit PalletState(PalletSpec spec = {}, Rules rules = {}) : spec_(spec), rules_(rules) {}

    CheckResult check(const Placement& p) const {
        return checkPlacement(spec_, rules_, placements_, totalWeight_, p);
    }

    // Place the box if it passes every rule. Returns the check result either way.
    CheckResult tryPlace(const Placement& p);

    const std::vector<Placement>& placements() const { return placements_; }
    const PalletSpec& spec() const { return spec_; }
    const Rules& rules() const { return rules_; }
    double totalWeight() const { return totalWeight_; }
    int stackHeight() const { return stackHeight_; }

    // Center of mass of everything on the pallet (pallet frame, mm).
    // Kept as running weighted sums, so each query is O(1) instead of O(n).
    Point3d centerOfMass() const;

private:
    PalletSpec spec_;
    Rules rules_;
    std::vector<Placement> placements_;
    double totalWeight_ = 0.0;
    int stackHeight_ = 0;
    double sumWX_ = 0.0, sumWY_ = 0.0, sumWZ_ = 0.0;  // sum of weight * center coordinate
};

}  // namespace pal
