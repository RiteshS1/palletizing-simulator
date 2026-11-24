cmake_minimum_required(VERSION 3.8)
project(palletizer_ros LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
add_compile_options(-Wall -Wextra -Wpedantic)

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(visualization_msgs REQUIRED)
find_package(builtin_interfaces REQUIRED)
find_package(tf2_ros REQUIRED)
find_package(tf2_eigen REQUIRED)
find_package(palletizer_interfaces REQUIRED)
find_package(palletizer_core REQUIRED)  # our C++ engine, built by colcon from ../../core

add_library(palletizer_conversions src/conversions.cpp)
target_include_directories(palletizer_conversions PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include> $<INSTALL_INTERFACE:include>)
target_link_libraries(palletizer_conversions PUBLIC
  pal::core
  tf2_eigen::tf2_eigen
  ${geometry_msgs_TARGETS} ${visualization_msgs_TARGETS} ${builtin_interfaces_TARGETS})

add_executable(planner_node src/planner_node.cpp)
target_link_libraries(planner_node
  palletizer_conversions
  rclcpp::rclcpp
  tf2_ros::static_transform_broadcaster_node
  ${palletizer_interfaces_TARGETS})

install(TARGETS planner_node DESTINATION lib/${PROJECT_NAME})
install(DIRECTORY launch config DESTINATION share/${PROJECT_NAME})

if(BUILD_TESTING)
  find_package(ament_cmake_gtest REQUIRED)
  ament_add_gtest(test_conversions test/test_conversions.cpp)
  target_link_libraries(test_conversions palletizer_conversions)

  find_package(launch_testing_ament_cmake REQUIRED)
  add_launch_test(test/test_plan_service.py TIMEOUT 120)
endif()

ament_package()
