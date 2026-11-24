#pragma once
// Pure functions that turn planner results into ROS 2 messages. Kept free of any node state
// so they can be unit-tested without starting ROS.

#include <Eigen/Geometry>
#include <builtin_interfaces/msg/time.hpp>
#include <geometry_msgs/msg/pose.hpp>
#include <geometry_msgs/msg/transform_stamped.hpp>
#include <string>
#include <visualization_msgs/msg/marker_array.hpp>

#include "pal/packer.hpp"
#include "pal/robot_cell.hpp"

namespace palletizer_ros {

geometry_msgs::msg::Pose toRosPose(const pal::Pose& pose);

geometry_msgs::msg::TransformStamped toTransform(const Eigen::Isometry3d& T, const std::string& parent,
                                                 const std::string& child,
                                                 const builtin_interfaces::msg::Time& stamp);

// One cube marker per carton (in the `pallet` frame, metres), coloured light-to-dark kraft by weight,
// plus a thin marker for the pallet deck. Viewable in RViz or Foxglove.
visualization_msgs::msg::MarkerArray planMarkers(const pal::PackResult& plan, const std::string& frame,
                                                 const builtin_interfaces::msg::Time& stamp);

}  // namespace palletizer_ros
