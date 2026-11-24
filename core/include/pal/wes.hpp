#pragma once
// A tiny Warehouse Execution System (WES): decides WHEN each order is worked on and WHICH pallet
// it goes on. Two policies, to show the classic trade-off between latency and efficiency:
//
//  OrderByOrder (online): pop the most urgent order from a priority queue and add it to an open
//    pallet for its destination right away. Low latency, but each order is packed without knowing
//    the next one, so pallets end up ragged and half empty.
//
//  Waves (batched): hold orders per destination until there's about a pallet's worth (or a deadline
//    is getting close), then plan the whole batch together with the offline packer. Pallets come
//    out far fuller; the price is that orders wait.
//
// Business rules for both:
//  - a pallet only carries orders for ONE destination (one truck stop)
//  - an order is never split across pallets (the customer receives it together)
//  - one robot: boxes are placed one at a time, `cycleTimeS` each

#include <cstdint>
#include <string>
#include <vector>

#include "pal/packer.hpp"

namespace pal {

struct Order {
    int id = 0;
    std::string destination;
    int priority = 2;       // 1 = most urgent, 3 = least
    double release = 0.0;   // seconds since shift start when the order becomes available
    double deadline = 0.0;  // seconds since shift start
    std::vector<Box> boxes;
};

enum class WesPolicy { OrderByOrder, Waves };

struct WesConfig {
    PalletSpec pallet;
    Rules rules;
    WesPolicy policy = WesPolicy::Waves;
    double cycleTimeS = 6.0;  // robot pick-and-place time per box

    // OrderByOrder
    int stations = 4;         // pallets that can be open at once (pallet positions in the cell)
    double closeFill = 0.55;  // ship a pallet once it is this full (fraction of max volume)
    bool bestFit = true;      // Best-Fit (fullest pallet that fits) vs First-Fit

    // Waves
    double waveVolume = 0.75;      // start a wave once waiting boxes add up to this much of a pallet
    double urgencyBufferS = 120.0; // start early if an order would otherwise miss its deadline
};

struct StepRecord {
    int step = 0;     // global placement index across all pallets
    int orderId = 0;
    double time = 0;  // when the robot finished placing this box
    Placement placement;
};

struct PalletRecord {
    int id = 0;
    std::string destination;
    PalletState state;
    std::vector<StepRecord> steps;
    bool open = true;
    int closedAfterStep = -1;  // shipped once this many global steps have happened
    std::string closeReason;   // "full", "station_needed", "end_of_shift", "wave_complete"
};

struct OrderRecord {
    Order order;
    int processed = -1;  // position in the processing sequence
    int pallet = -1;
    double start = 0, finish = 0;
    bool late = false;
    bool rejected = false;  // doesn't fit even on an empty pallet
    int firstStep = -1, lastStep = -1;
};

struct WesResult {
    std::vector<PalletRecord> pallets;
    std::vector<OrderRecord> orders;  // same order as the input
    int totalSteps = 0;
    double makespan = 0;  // seconds until the last box was placed
};

// Reproducible random orders for 3 destinations.
std::vector<Order> generateOrders(int n, uint32_t seed);

WesResult runWes(const std::vector<Order>& orders, const WesConfig& config = {});

}  // namespace pal
