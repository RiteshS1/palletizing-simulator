Frames published by `palletizer_planner`:

    world ──(identity)──▶ robot_base ──(T_base_pallet)──▶ pallet

`pallet_markers` are in the `pallet` frame; service poses are in `robot_base`. In Foxglove, add a
3D panel, set the display frame to `world`, and enable the `/pallet_markers` and `/tf_static` topics.
