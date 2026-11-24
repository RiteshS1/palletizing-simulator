// Unit tests for the message conversions (no ROS graph needed).
#include <gtest/gtest.h>

#include "pal/generator.hpp"
#include "palletizer_ros/conversions.hpp"

TEST(Conversions, PoseRoundTrip) {
    pal::Pose p;
    p.position = {1.0, -0.5, 0.25};
    p.orientation = Eigen::Quaterniond(Eigen::AngleAxisd(0.3, Eigen::Vector3d::UnitZ()));
    const auto msg = palletizer_ros::toRosPose(p);
    EXPECT_DOUBLE_EQ(msg.position.y, -0.5);
    EXPECT_NEAR(msg.orientation.w, p.orientation.w(), 1e-12);
}

TEST(Conversions, TransformKeepsFramesAndTranslation) {
    const auto t = palletizer_ros::toTransform(pal::RobotCell::defaultBasePallet(), "robot_base", "pallet", {});
    EXPECT_EQ(t.header.frame_id, "robot_base");
    EXPECT_EQ(t.child_frame_id, "pallet");
    EXPECT_NEAR(t.transform.translation.x, 1.6, 1e-12);
    EXPECT_NEAR(t.transform.translation.z, 0.144, 1e-12);
}

TEST(Conversions, OneMarkerPerCartonPlusDeck) {
    const auto plan = pal::packExtremePoints(pal::generateBoxes(20, 5));
    const auto markers = palletizer_ros::planMarkers(plan, "pallet", {});
    // DELETEALL + deck + one cube per placed carton
    EXPECT_EQ(markers.markers.size(), plan.pallet.placements().size() + 2);
    EXPECT_EQ(markers.markers.back().header.frame_id, "pallet");
}
