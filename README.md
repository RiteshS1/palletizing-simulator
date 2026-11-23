# Palletizing Simulator

Stack mixed boxes onto a pallet: a C++ packing engine that follows height, weight and stability
rules, and a three.js viewer that replays the plan box by box.

- **Algorithms**: greedy layer baseline vs. Extreme-Points heuristic, compared on fill rate
- **Rules**: bounds, no overlap, support ratio, load bearing, max load, upright only
- **WES layer**: an order queue that assigns orders to pallets

See [`idea/idea.md`](idea/idea.md) for the design and [`idea/steps.md`](idea/steps.md) for progress.

## Quick start
```bash
make -C core test    # unit + property tests
make -C core bench   # compare the two algorithms
make -C core run     # write example plans as JSON
```

## Results (50 random seeds, 40 boxes each, default rules)
| | Greedy layer | Extreme points |
|---|---|---|
| Boxes placed | 55% | 90% |
| Pallet fill | 37% | 64% |
| Center-of-mass offset | 193 mm | 73 mm |
| Runtime | 0.05 ms | 3.3 ms |
