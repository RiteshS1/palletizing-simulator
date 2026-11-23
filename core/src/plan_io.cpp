#include "plan_io.hpp"

#include "json.hpp"

namespace pal {

// Output shape (all lengths in mm, pallet frame, z up):
// {
//   "algorithm": "...", "seed": 42,
//   "pallet":  {length, width, maxHeight, maxLoad},
//   "rules":   {minSupportRatio, loadFactor, requireCenterSupported},
//   "boxes":   [{id, w, d, h, weight}, ...]                       // everything offered
//   "placements": [{step, id, x, y, z, sx, sy, sz, weight, rotated}, ...]  // in robot order
//   "unplaced": [id, ...],
//   "metrics": {...}
// }
std::string planToJson(const PackResult& r, const Metrics& m, const std::vector<Box>& offered,
                       uint32_t seed) {
    const PalletSpec& s = r.pallet.spec();
    const Rules& rules = r.pallet.rules();
    JsonWriter j;
    j.beginObject();
    j.key("algorithm").value(r.algorithm);
    j.key("seed").value(seed);

    j.key("pallet").beginObject()
        .key("length").value(s.length)
        .key("width").value(s.width)
        .key("maxHeight").value(s.maxHeight)
        .key("maxLoad").value(s.maxLoad)
        .endObject();

    j.key("rules").beginObject()
        .key("minSupportRatio").value(rules.minSupportRatio)
        .key("loadFactor").value(rules.loadFactor)
        .key("requireCenterSupported").value(rules.requireCenterSupported)
        .endObject();

    j.key("boxes").beginArray();
    for (const Box& b : offered) {
        j.beginObject().key("id").value(b.id).key("w").value(b.w).key("d").value(b.d)
            .key("h").value(b.h).key("weight").value(b.weight).endObject();
    }
    j.endArray();

    j.key("placements").beginArray();
    int step = 0;
    for (const Placement& p : r.pallet.placements()) {
        AABB a = p.aabb();
        j.beginObject()
            .key("step").value(step++)
            .key("id").value(p.box.id)
            .key("x").value(a.min.x).key("y").value(a.min.y).key("z").value(a.min.z)
            .key("sx").value(a.sizeX()).key("sy").value(a.sizeY()).key("sz").value(a.sizeZ())
            .key("weight").value(p.box.weight)
            .key("rotated").value(p.rotated)
            .endObject();
    }
    j.endArray();

    j.key("unplaced").beginArray();
    for (const Box& b : r.unplaced) j.value(b.id);
    j.endArray();

    j.key("metrics").beginObject()
        .key("offered").value(m.offered)
        .key("placed").value(m.placed)
        .key("placedVolume").value(m.placedVolume)
        .key("density").value(m.density)
        .key("fillOfMax").value(m.fillOfMax)
        .key("height").value(m.height)
        .key("totalWeight").value(m.totalWeight)
        .key("comOffset").value(m.comOffset)
        .key("comHeight").value(m.comHeight)
        .key("runtimeMs").value(m.runtimeMs)
        .endObject();

    j.endObject();
    return j.str();
}

}  // namespace pal
