// palletizer_planner: the C++ planning engine as a ROS 2 node.
//
//   service  /plan_pallet  (palletizer_interfaces/srv/PlanPallet)  -> place poses for the robot
//   topic    /pallet_markers (visualization_msgs/MarkerArray)        -> what the plan looks like
//   TF       world -> robot_base -> pallet                            -> where things are
//
// A motion planner (e.g. MoveIt) would take `place_poses` / `approach_poses` (geometry_msgs/Pose
// in the robot_base frame) and plan collision-free arm motions to them.

#include <memory>
#include <rclcpp/rclcpp.hpp>
#include <tf2_ros/static_transform_broadcaster.h>

#include "pal/generator.hpp"
#include "pal/metrics.hpp"
#include "pal/robot_cell.hpp"
#include "palletizer_interfaces/srv/plan_pallet.hpp"
#include "palletizer_ros/conversions.hpp"

using palletizer_interfaces::srv::PlanPallet;

class PlannerNode : public rclcpp::Node {
public:
    PlannerNode() : Node("palletizer_planner") {
        // Transient-local QoS ("latched"): a visualizer that connects later still gets the last plan.
        markers_ = create_publisher<visualization_msgs::msg::MarkerArray>(
            "pallet_markers", rclcpp::QoS(1).transient_local().reliable());
        service_ = create_service<PlanPallet>(
            "plan_pallet", [this](const std::shared_ptr<PlanPallet::Request> req,
                                  std::shared_ptr<PlanPallet::Response> res) { onPlan(*req, *res); });

        // Static transforms never change, so they are sent once and latched by tf2.
        tf_static_ = std::make_shared<tf2_ros::StaticTransformBroadcaster>(this);
        const auto stamp = now();
        tf_static_->sendTransform({
            palletizer_ros::toTransform(Eigen::Isometry3d::Identity(), "world", "robot_base", stamp),
            palletizer_ros::toTransform(cell_.basePallet, "robot_base", "pallet", stamp),
        });

        // Plan once at start-up so a freshly opened visualizer shows something immediately.
        PlanPallet::Request req;
        PlanPallet::Response res;
        onPlan(req, res);
        RCLCPP_INFO(get_logger(), "ready: call /plan_pallet; first plan placed %u of %u boxes", res.placed, res.offered);
    }

private:
    void onPlan(const PlanPallet::Request& req, PlanPallet::Response& res) {
        if (req.algorithm != "ep" && req.algorithm != "greedy") {
            res.success = false;
            res.message = "algorithm must be \"ep\" or \"greedy\"";
            return;
        }
        if (req.box_count == 0 || req.box_count > 500 || req.min_support < 0.0 || req.min_support > 1.0) {
            res.success = false;
            res.message = "box_count must be 1..500 and min_support 0..1";
            return;
        }

        const auto boxes = pal::generateBoxes(static_cast<int>(req.box_count), req.seed);
        pal::Rules rules;
        rules.minSupportRatio = req.min_support;
        const pal::PackResult plan = req.algorithm == "greedy"
                                         ? pal::packGreedyLayer(boxes, {}, rules)
                                         : pal::packExtremePoints(boxes, {}, rules, pal::EPOptions{8, req.seed});
        const pal::Metrics m = pal::computeMetrics(plan, 0.0);

        for (const auto& p : plan.pallet.placements()) {
            const pal::PlacePoses poses = pal::placePoses(cell_, p);
            res.place_poses.push_back(palletizer_ros::toRosPose(poses.place));
            res.approach_poses.push_back(palletizer_ros::toRosPose(poses.approach));
            const pal::AABB a = p.aabb();
            geometry_msgs::msg::Vector3 size;
            size.x = a.sizeX() * 1e-3;
            size.y = a.sizeY() * 1e-3;
            size.z = a.sizeZ() * 1e-3;
            res.box_sizes.push_back(size);
            res.box_weights.push_back(p.box.weight);
        }
        res.placed = static_cast<uint32_t>(m.placed);
        res.offered = static_cast<uint32_t>(m.offered);
        res.fill_ratio = m.fillOfMax;
        res.com_offset_m = m.comOffset * 1e-3;
        res.success = true;
        res.message = plan.algorithm;

        markers_->publish(palletizer_ros::planMarkers(plan, "pallet", now()));
        RCLCPP_INFO(get_logger(), "%s: placed %u/%u, fill %.1f%%", plan.algorithm.c_str(), res.placed,
                    res.offered, 100.0 * res.fill_ratio);
    }

    pal::RobotCell cell_;
    rclcpp::Publisher<visualization_msgs::msg::MarkerArray>::SharedPtr markers_;
    rclcpp::Service<PlanPallet>::SharedPtr service_;
    std::shared_ptr<tf2_ros::StaticTransformBroadcaster> tf_static_;
};

int main(int argc, char** argv) {
    rclcpp::init(argc, argv);
    rclcpp::spin(std::make_shared<PlannerNode>());
    rclcpp::shutdown();
    return 0;
}
