#include "pal/robot_cell.hpp"

#include <numbers>

namespace pal {

using Eigen::AngleAxisd;
using Eigen::Isometry3d;
using Eigen::Vector3d;

Isometry3d RobotCell::defaultBasePallet() {
    // Rotate 90° about z, then place the pallet's origin (back-left corner of the deck).
    // With that yaw, pallet +x (1.2 m side) runs along base +y and pallet +y runs along base -x,
    // so the pallet spans x ∈ [0.6, 1.6] m and y ∈ [-0.6, 0.6] m in front of the robot.
    Isometry3d T = Isometry3d::Identity();
    T.translate(Vector3d(1.6, -0.6, 0.144));
    T.rotate(AngleAxisd(std::numbers::pi / 2, Vector3d::UnitZ()));
    return T;
}

Isometry3d toolInPallet(const Placement& p) {
    const AABB a = p.aabb();
    const Vector3d topCentre(0.5 * (a.min.x + a.max.x) * 1e-3,  // mm -> m
                             0.5 * (a.min.y + a.max.y) * 1e-3, a.max.z * 1e-3);
    // Rotation order matters (rotations don't commute): first flip the tool upside down
    // (180° about x, so its z axis points at the box), then yaw it with the box.
    const double yaw = p.rotated ? std::numbers::pi / 2 : 0.0;
    Isometry3d T = Isometry3d::Identity();
    T.translate(topCentre);
    T.rotate(AngleAxisd(yaw, Vector3d::UnitZ()) * AngleAxisd(std::numbers::pi, Vector3d::UnitX()));
    return T;
}

Pose toPose(const Isometry3d& T) {
    Pose pose;
    pose.position = T.translation();
    pose.orientation = Eigen::Quaterniond(T.rotation()).normalized();
    return pose;
}

PlacePoses placePoses(const RobotCell& cell, const Placement& p) {
    const Isometry3d place = cell.basePallet * toolInPallet(p);
    // Pre-multiplying by a translation moves along the BASE frame's z (straight up in the world),
    // whatever way the tool is pointing.
    const Isometry3d approach = Eigen::Translation3d(0, 0, cell.approachHeightM) * place;
    return {toPose(place), toPose(approach)};
}

}  // namespace pal
