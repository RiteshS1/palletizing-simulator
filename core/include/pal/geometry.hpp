#pragma once
// Basic 3D geometry on an integer millimetre grid.
//
// Why integers? Packing constantly asks "does box A's top equal box B's bottom?".
// With floats, 0.1 + 0.2 != 0.3, so stacked boxes would randomly "not touch".
// Integer millimetres make every comparison exact.

#include <algorithm>
#include <cstdint>

namespace pal {

struct Vec3 {
    int x = 0;
    int y = 0;
    int z = 0;
};

inline bool operator==(const Vec3& a, const Vec3& b) {
    return a.x == b.x && a.y == b.y && a.z == b.z;
}

// Axis-Aligned Bounding Box, half-open: it covers [min, max) on every axis.
// Half-open means two boxes that merely touch (a.max.x == b.min.x) do NOT overlap,
// which is exactly what we want when stacking boxes face to face.
struct AABB {
    Vec3 min;
    Vec3 max;

    int sizeX() const { return max.x - min.x; }
    int sizeY() const { return max.y - min.y; }
    int sizeZ() const { return max.z - min.z; }

    // 64-bit on purpose: 1200 * 1000 * 1800 = 2.16e9, which overflows a 32-bit int (max ~2.147e9).
    int64_t footprintArea() const { return int64_t(sizeX()) * sizeY(); }
    int64_t volume() const { return footprintArea() * sizeZ(); }
};

// Length of the overlap of intervals [a0, a1) and [b0, b1); 0 if they don't overlap.
inline int overlap1D(int a0, int a1, int b0, int b1) {
    return std::max(0, std::min(a1, b1) - std::max(a0, b0));
}

// Two AABBs intersect iff their intervals overlap on ALL three axes (the separating axis
// theorem for boxes: one axis with a gap is enough to separate them). O(1).
inline bool intersects(const AABB& a, const AABB& b) {
    return overlap1D(a.min.x, a.max.x, b.min.x, b.max.x) > 0 &&
           overlap1D(a.min.y, a.max.y, b.min.y, b.max.y) > 0 &&
           overlap1D(a.min.z, a.max.z, b.min.z, b.max.z) > 0;
}

// Area of the overlap of the two boxes' footprints (their shadows on the XY plane).
// Used later for the support rule: how much of a box's bottom rests on another box's top.
inline int64_t footprintOverlap(const AABB& a, const AABB& b) {
    return int64_t(overlap1D(a.min.x, a.max.x, b.min.x, b.max.x)) *
           overlap1D(a.min.y, a.max.y, b.min.y, b.max.y);
}

// True if `inner` lies completely inside `outer`.
inline bool contains(const AABB& outer, const AABB& inner) {
    return inner.min.x >= outer.min.x && inner.max.x <= outer.max.x &&
           inner.min.y >= outer.min.y && inner.max.y <= outer.max.y &&
           inner.min.z >= outer.min.z && inner.max.z <= outer.max.z;
}

}  // namespace pal
