#!/usr/bin/env bash
# ROS 2 helper (needs Docker; no ROS install on the host).
#   scripts/ros.sh build   build the image (colcon build inside)
#   scripts/ros.sh test    run the package tests (gtest + launch test)
#   scripts/ros.sh run     start the planner + foxglove_bridge on ws://localhost:8765
#   scripts/ros.sh call    call /plan_pallet once and print a summary
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE=palletizer-ros
case "${1:-}" in
  build) docker build -f docker/ros.Dockerfile -t "$IMAGE" . ;;
  test)
    docker run --rm "$IMAGE" bash -lc "source /ws/install/setup.bash && cd /ws \
      && colcon test --packages-select palletizer_ros --event-handlers console_direct- \
      && colcon test-result --verbose" ;;
  run) docker run --rm -it -p 8765:8765 "$IMAGE" ;;
  call)
    docker run --rm "$IMAGE" bash -lc "source /ws/install/setup.bash \
      && (ros2 run palletizer_ros planner_node > /dev/null 2>&1 &) && sleep 3 \
      && ros2 service call /plan_pallet palletizer_interfaces/srv/PlanPallet \
         \"{algorithm: ep, box_count: 40, seed: 42, min_support: 0.75}\" \
         | grep -oE 'success=[A-Za-z]+|placed=[0-9]+|offered=[0-9]+|fill_ratio=[0-9.]{6}' | tr '\\n' ' '; echo" ;;
  *) echo "usage: $0 {build|test|run|call}" >&2; exit 2 ;;
esac
