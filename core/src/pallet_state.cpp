#include "pallet_state.hpp"

#include <algorithm>

namespace pal {

CheckResult PalletState::tryPlace(const Placement& p) {
    CheckResult r = check(p);
    if (!r.ok()) return r;

    placements_.push_back(p);
    const AABB a = p.aabb();
    const double w = p.box.weight;
    totalWeight_ += w;
    stackHeight_ = std::max(stackHeight_, a.max.z);
    sumWX_ += w * (a.min.x + a.max.x) / 2.0;
    sumWY_ += w * (a.min.y + a.max.y) / 2.0;
    sumWZ_ += w * (a.min.z + a.max.z) / 2.0;
    return r;
}

Point3d PalletState::centerOfMass() const {
    if (totalWeight_ <= 0.0) return {spec_.length / 2.0, spec_.width / 2.0, 0.0};
    return {sumWX_ / totalWeight_, sumWY_ / totalWeight_, sumWZ_ / totalWeight_};
}

}  // namespace pal
