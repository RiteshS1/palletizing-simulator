#include "metrics.hpp"

#include <cmath>

namespace pal {

Metrics computeMetrics(const PackResult& r, double runtimeMs) {
    const PalletState& p = r.pallet;
    const PalletSpec& s = p.spec();
    Metrics m;
    m.placed = int(p.placements().size());
    m.offered = m.placed + int(r.unplaced.size());
    for (const Placement& pl : p.placements()) m.placedVolume += pl.box.volume();
    m.height = p.stackHeight();
    if (m.height > 0) m.density = double(m.placedVolume) / double(s.deckArea() * m.height);
    m.fillOfMax = double(m.placedVolume) / double(s.usableSpace().volume());
    m.totalWeight = p.totalWeight();

    Point3d com = p.centerOfMass();
    m.comOffset = std::hypot(com.x - s.length / 2.0, com.y - s.width / 2.0);
    m.comHeight = com.z;
    m.runtimeMs = runtimeMs;
    return m;
}

}  // namespace pal
