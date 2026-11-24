"""Integration test: launch the real node and call /plan_pallet like any ROS 2 client would."""
import unittest

import launch
import launch_ros.actions
import launch_testing.actions
import pytest
import rclpy
from palletizer_interfaces.srv import PlanPallet


@pytest.mark.launch_test
def generate_test_description():
    node = launch_ros.actions.Node(package="palletizer_ros", executable="planner_node", output="screen")
    return launch.LaunchDescription([node, launch_testing.actions.ReadyToTest()])


class TestPlanService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        rclpy.init()
        cls.node = rclpy.create_node("plan_service_test")

    @classmethod
    def tearDownClass(cls):
        cls.node.destroy_node()
        rclpy.shutdown()

    def call(self, **fields):
        client = self.node.create_client(PlanPallet, "plan_pallet")
        self.assertTrue(client.wait_for_service(timeout_sec=30.0), "service never appeared")
        future = client.call_async(PlanPallet.Request(**fields))
        rclpy.spin_until_future_complete(self.node, future, timeout_sec=30.0)
        self.assertIsNotNone(future.result())
        return future.result()

    def test_extreme_points_seed_42_matches_the_engine(self):
        res = self.call(algorithm="ep", box_count=40, seed=42, min_support=0.75)
        self.assertTrue(res.success)
        self.assertEqual(res.offered, 40)
        self.assertEqual(res.placed, 38)  # the same plan the CLI and the browser produce
        self.assertEqual(len(res.place_poses), 38)
        for place, approach in zip(res.place_poses, res.approach_poses):
            self.assertAlmostEqual(approach.position.z - place.position.z, 0.30, places=6)

    def test_rejects_unknown_algorithm(self):
        res = self.call(algorithm="magic", box_count=10, seed=1, min_support=0.75)
        self.assertFalse(res.success)
