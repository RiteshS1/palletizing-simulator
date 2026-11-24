#pragma once
// Pallet specification and the usable space above it.
//
// Pallet frame: origin at the back-left corner of the pallet's TOP deck (z = 0 is where the
// first layer of boxes sits). x runs along the long side, y along the short side, z points up.

#include "pal/geometry.hpp"

namespace pal {

struct PalletSpec {
    int length = 1200;       // x extent (mm): EUR/ISO 1200 x 1000 pallet
    int width = 1000;        // y extent (mm)
    int maxHeight = 1800;    // max stack height above the deck (mm)
    double maxLoad = 1000.0; // kg

    // The box-shaped region every placed box must stay inside.
    AABB usableSpace() const { return AABB{{0, 0, 0}, {length, width, maxHeight}}; }
    int64_t deckArea() const { return int64_t(length) * width; }
};

}  // namespace pal
