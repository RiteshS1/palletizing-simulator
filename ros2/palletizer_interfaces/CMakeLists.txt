cmake_minimum_required(VERSION 3.8)
project(palletizer_interfaces)

find_package(ament_cmake REQUIRED)
find_package(rosidl_default_generators REQUIRED)
find_package(geometry_msgs REQUIRED)

# Generates C++ and Python types for the service from the .srv file.
rosidl_generate_interfaces(${PROJECT_NAME}
  "srv/PlanPallet.srv"
  DEPENDENCIES geometry_msgs)

ament_export_dependencies(rosidl_default_runtime)
ament_package()
