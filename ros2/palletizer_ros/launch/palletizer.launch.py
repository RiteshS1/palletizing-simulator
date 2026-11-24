"""Start the planner. Optionally start foxglove_bridge so the plan can be viewed in Foxglove's
web app (ws://localhost:8765): `ros2 launch palletizer_ros palletizer.launch.py foxglove:=true`."""
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    foxglove = LaunchConfiguration("foxglove")
    return LaunchDescription([
        DeclareLaunchArgument("foxglove", default_value="false",
                              description="Also start foxglove_bridge on port 8765"),
        Node(package="palletizer_ros", executable="planner_node", name="palletizer_planner", output="screen"),
        Node(package="foxglove_bridge", executable="foxglove_bridge", name="foxglove_bridge",
             parameters=[{"port": 8765}], condition=IfCondition(foxglove)),
    ])
