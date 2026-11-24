# ROS 2 Jazzy workspace with the palletizer packages built and ready to test or run.
#   docker build -f docker/ros.Dockerfile -t palletizer-ros .
FROM ros:jazzy

SHELL ["/bin/bash", "-c"]
RUN apt-get update \
 && apt-get install -y --no-install-recommends ninja-build ros-jazzy-foxglove-bridge \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /ws
COPY core src/palletizer/core
COPY ros2 src/palletizer/ros2

# rosdep reads every package.xml and installs the system dependencies (fmt, Eigen, nlohmann-json, ...)
RUN apt-get update \
 && rosdep install --from-paths src --ignore-src -y --rosdistro jazzy \
 && rm -rf /var/lib/apt/lists/*

# colcon builds the plain-CMake core library and the ament packages in dependency order.
RUN source /opt/ros/jazzy/setup.bash \
 && colcon build --event-handlers console_direct- \
      --cmake-args -DCMAKE_BUILD_TYPE=Release -DPAL_BUILD_APPS=OFF -DPAL_BUILD_TESTS=OFF -DPAL_BUILD_BENCHMARKS=OFF

RUN echo 'source /opt/ros/jazzy/setup.bash && source /ws/install/setup.bash' >> /root/.bashrc
CMD ["bash", "-lc", "source /ws/install/setup.bash && ros2 launch palletizer_ros palletizer.launch.py foxglove:=true"]
