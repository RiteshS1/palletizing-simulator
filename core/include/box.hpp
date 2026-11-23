#pragma once
// A carton (Box) and where it ends up on the pallet (Placement).

#include "geometry.hpp"

namespace pal {

struct Box {
    int id = 0;
    int w = 0;            // size along x when not rotated (mm)
    int d = 0;            // size along y when not rotated (mm)
    int h = 0;            // height, always along z: boxes stay upright (mm)
    double weight = 0.0;  // kg

    int64_t volume() const { return int64_t(w) * d * h; }
    int64_t baseArea() const { return int64_t(w) * d; }
};

// Boxes may only spin about the vertical axis (yaw), so there are just 2 orientations:
// rotated = false -> (w, d, h), rotated = true -> (d, w, h).
// Real cartons are labelled "this side up"; tipping them can crush contents.
inline Vec3 orientedSize(const Box& b, bool rotated) {
    return rotated ? Vec3{b.d, b.w, b.h} : Vec3{b.w, b.d, b.h};
}

// A box placed in the pallet frame. `pos` is the box's min corner (back-left-bottom).
struct Placement {
    Box box;
    Vec3 pos;
    bool rotated = false;

    AABB aabb() const {
        Vec3 s = orientedSize(box, rotated);
        return AABB{pos, Vec3{pos.x + s.x, pos.y + s.y, pos.z + s.z}};
    }
};

}  // namespace pal
