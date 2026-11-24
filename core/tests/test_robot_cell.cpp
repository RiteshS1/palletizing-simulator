// Poses for the robot: pallet frame (mm) -> robot base frame (m), with Eigen.
#include <gtest/gtest.h>

#include "pal/robot_cell.hpp"

using namespace pal;

TEST(RobotCell, ToolPointsDownOntoTheTopFace) {
    const Placement p{Box{0, 400, 300, 200, 5.0}, Vec3{0, 0, 0}, false};
    const Eigen::Isometry3d T = toolInPallet(p);
    EXPECT_TRUE(T.translation().isApprox(Eigen::Vector3d(0.2, 0.15, 0.2)));  // top centre, metres
    const Eigen::Vector3d toolZ = T.rotation() * Eigen::Vector3d::UnitZ();
    EXPECT_TRUE(toolZ.isApprox(-Eigen::Vector3d::UnitZ()));  // tool z axis points straight down
}

TEST(RobotCell, ChainsIntoTheRobotBaseFrame) {
    const RobotCell cell;
    const Placement p{Box{0, 400, 300, 200, 5.0}, Vec3{0, 0, 0}, false};
    const PlacePoses poses = placePoses(cell, p);
    // Pallet yawed 90°: pallet (x, y) -> base (-y, x), then shifted by (1.6, -0.6, 0.144).
    EXPECT_TRUE(poses.place.position.isApprox(Eigen::Vector3d(1.6 - 0.15, -0.6 + 0.2, 0.144 + 0.2)));
    EXPECT_NEAR(poses.place.orientation.norm(), 1.0, 1e-12);  // a rotation is a UNIT quaternion
    // Approach is straight above the place pose, by exactly the approach height.
    const Eigen::Vector3d up = poses.approach.position - poses.place.position;
    EXPECT_TRUE(up.isApprox(Eigen::Vector3d(0, 0, cell.approachHeightM)));
    EXPECT_TRUE(poses.approach.orientation.isApprox(poses.place.orientation));
}

TEST(RobotCell, RotatedBoxYawsTheTool) {
    const Box b{0, 400, 300, 200, 5.0};
    const Eigen::Isometry3d a = toolInPallet(Placement{b, Vec3{0, 0, 0}, false});
    const Eigen::Isometry3d r = toolInPallet(Placement{b, Vec3{0, 0, 0}, true});
    const Eigen::Vector3d xa = a.rotation() * Eigen::Vector3d::UnitX();
    const Eigen::Vector3d xr = r.rotation() * Eigen::Vector3d::UnitX();
    EXPECT_NEAR(xa.dot(xr), 0.0, 1e-12);  // tool x axes are 90° apart
}
