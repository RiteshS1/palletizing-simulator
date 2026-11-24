#pragma once
// From "where does the box go on the pallet" to "where must the robot's tool be".
//
// The packers think in the PALLET frame (integer mm, z up, origin at the deck's back-left corner).
// A robot controller, ROS and MoveIt think in the ROBOT BASE frame, in metres (ROS REP 103),
// with orientations as quaternions. This file is the bridge, built on Eigen: the standard C++
// linear-algebra library in robotics (ROS, MoveIt, Drake and PCL all use it).
//
// Why not use Eigen everywhere? Packing needs EXACT comparisons ("is this top exactly at that
// bottom?"), which integers give and floating-point doesn't. Poses are the opposite: rotations
// are naturally floating-point. So integers for packing, Eigen for poses.

#include <Eigen/Geometry>

#include "pal/box.hpp"

namespace pal {

struct Pose {
    Eigen::Vector3d position = Eigen::Vector3d::Zero();               // metres
    Eigen::Quaterniond orientation = Eigen::Quaterniond::Identity();  // (x, y, z, w)
};

struct RobotCell {
    // T_base_pallet: the pallet frame expressed in the robot base frame.
    // Default: the pallet stands in front of the robot (+x), centred on its y axis, turned 90°
    // so the long side runs across, with its deck 144 mm above the floor.
    Eigen::Isometry3d basePallet = defaultBasePallet();
    double approachHeightM = 0.30;  // hover this far above the place pose before descending

    static Eigen::Isometry3d defaultBasePallet();
};

struct PlacePoses {
    Pose place;     // suction plate touching the top of the box, box at its final position
    Pose approach;  // straight above `place`: the robot comes down vertically from here
};

// Tool pose in the PALLET frame (metres): plate centred on the box's top face, tool z axis
// pointing down (a top-down gripper), yawed by 90° if the box is rotated.
Eigen::Isometry3d toolInPallet(const Placement& p);

// Same, chained into the robot base frame: T_base_tool = T_base_pallet * T_pallet_tool.
PlacePoses placePoses(const RobotCell& cell, const Placement& p);

Pose toPose(const Eigen::Isometry3d& T);

}  // namespace pal
