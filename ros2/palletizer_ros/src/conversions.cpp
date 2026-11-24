#include "palletizer_ros/conversions.hpp"

#include <algorithm>
#include <tf2_eigen/tf2_eigen.hpp>

namespace palletizer_ros {

geometry_msgs::msg::Pose toRosPose(const pal::Pose& pose) {
    geometry_msgs::msg::Pose msg;
    msg.position.x = pose.position.x();
    msg.position.y = pose.position.y();
    msg.position.z = pose.position.z();
    msg.orientation.x = pose.orientation.x();
    msg.orientation.y = pose.orientation.y();
    msg.orientation.z = pose.orientation.z();
    msg.orientation.w = pose.orientation.w();
    return msg;
}

geometry_msgs::msg::TransformStamped toTransform(const Eigen::Isometry3d& T, const std::string& parent,
                                                 const std::string& child,
                                                 const builtin_interfaces::msg::Time& stamp) {
    // tf2_eigen: the standard bridge between Eigen types and ROS geometry messages.
    geometry_msgs::msg::TransformStamped t = tf2::eigenToTransform(T);
    t.header.frame_id = parent;
    t.header.stamp = stamp;
    t.child_frame_id = child;
    return t;
}

visualization_msgs::msg::MarkerArray planMarkers(const pal::PackResult& plan, const std::string& frame,
                                                 const builtin_interfaces::msg::Time& stamp) {
    visualization_msgs::msg::MarkerArray out;

    visualization_msgs::msg::Marker clear;  // wipe markers from a previous plan
    clear.action = visualization_msgs::msg::Marker::DELETEALL;
    out.markers.push_back(clear);

    const auto& spec = plan.pallet.spec();
    visualization_msgs::msg::Marker deck;
    deck.header.frame_id = frame;
    deck.header.stamp = stamp;
    deck.ns = "pallet";
    deck.id = 0;
    deck.type = visualization_msgs::msg::Marker::CUBE;
    deck.pose.position.x = spec.length * 0.5e-3;
    deck.pose.position.y = spec.width * 0.5e-3;
    deck.pose.position.z = -0.072;  // the 144 mm wooden pallet sits under the deck (z = 0)
    deck.pose.orientation.w = 1.0;
    deck.scale.x = spec.length * 1e-3;
    deck.scale.y = spec.width * 1e-3;
    deck.scale.z = 0.144;
    deck.color.r = 0.74f;
    deck.color.g = 0.62f;
    deck.color.b = 0.45f;
    deck.color.a = 1.0f;
    out.markers.push_back(deck);

    double lo = 1e9, hi = 0;
    for (const auto& p : plan.pallet.placements()) {
        lo = std::min(lo, p.box.weight);
        hi = std::max(hi, p.box.weight);
    }

    int id = 0;
    for (const auto& p : plan.pallet.placements()) {
        const pal::AABB a = p.aabb();
        visualization_msgs::msg::Marker m;
        m.header.frame_id = frame;
        m.header.stamp = stamp;
        m.ns = "cartons";
        m.id = id++;
        m.type = visualization_msgs::msg::Marker::CUBE;
        m.pose.position.x = 0.5e-3 * (a.min.x + a.max.x);
        m.pose.position.y = 0.5e-3 * (a.min.y + a.max.y);
        m.pose.position.z = 0.5e-3 * (a.min.z + a.max.z);
        m.pose.orientation.w = 1.0;
        m.scale.x = a.sizeX() * 1e-3 * 0.98;  // a hair smaller so neighbouring boxes read as separate
        m.scale.y = a.sizeY() * 1e-3 * 0.98;
        m.scale.z = a.sizeZ() * 1e-3 * 0.98;
        const float t = hi > lo ? static_cast<float>((p.box.weight - lo) / (hi - lo)) : 0.5f;
        m.color.r = 0.89f - 0.34f * t;  // light kraft -> dark kraft
        m.color.g = 0.78f - 0.43f * t;
        m.color.b = 0.62f - 0.45f * t;
        m.color.a = 1.0f;
        out.markers.push_back(m);
    }
    return out;
}

}  // namespace palletizer_ros
