# Palletizer core: the C++ planning engine.
# Builds natively (library, CLI apps, GoogleTest tests, Google Benchmark) and for the browser
# (WebAssembly via Emscripten). Dependencies come from vcpkg (see vcpkg.json) or, inside ROS 2,
# from the system packages that rosdep installs.
cmake_minimum_required(VERSION 3.25)
project(palletizer_core VERSION 2.0.0 DESCRIPTION "Mixed-case palletizing planner" LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)  # compile_commands.json for clang-tidy and editors

option(PAL_BUILD_TESTS "Build the GoogleTest suite" ON)
option(PAL_BUILD_APPS "Build the command-line apps" ON)
option(PAL_BUILD_BENCHMARKS "Build Google Benchmark micro-benchmarks" ON)

find_package(fmt CONFIG REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)
find_package(Eigen3 CONFIG REQUIRED)

# ---------- the library ----------
add_library(palletizer_core
    src/api.cpp
    src/extreme_points.cpp
    src/generator.cpp
    src/greedy_layer.cpp
    src/metrics.cpp
    src/pallet_state.cpp
    src/plan_io.cpp
    src/robot_cell.cpp
    src/stability.cpp
    src/wes.cpp)
add_library(pal::core ALIAS palletizer_core)
target_include_directories(palletizer_core PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>)
target_link_libraries(palletizer_core PUBLIC fmt::fmt nlohmann_json::nlohmann_json Eigen3::Eigen)
target_compile_features(palletizer_core PUBLIC cxx_std_20)
if(NOT MSVC)
    target_compile_options(palletizer_core PRIVATE -Wall -Wextra -Wpedantic -Wshadow -Wconversion -Wno-sign-conversion)
endif()
set_target_properties(palletizer_core PROPERTIES
    POSITION_INDEPENDENT_CODE ON  # so ROS 2 shared libraries can link it
    EXPORT_NAME core)             # installed as pal::core, same name as the in-tree alias

# ---------- WebAssembly: one ES module for the browser, then stop ----------
if(EMSCRIPTEN)
    add_executable(palletizer_wasm wasm/bindings.cpp)
    target_link_libraries(palletizer_wasm PRIVATE palletizer_core)
    set_target_properties(palletizer_wasm PROPERTIES OUTPUT_NAME palletizer SUFFIX ".js")
    target_link_options(palletizer_wasm PRIVATE
        -lembind                   # C++ <-> JS bindings
        -sMODULARIZE=1             # export a factory function...
        -sEXPORT_ES6=1             # ...as an ES module
        -sENVIRONMENT=web,worker   # runs on the page and inside a Web Worker
        -sALLOW_MEMORY_GROWTH=1)   # the heap may grow for big plans
    return()
endif()

# ---------- command-line apps ----------
if(PAL_BUILD_APPS)
    find_package(CLI11 CONFIG REQUIRED)
    foreach(app palletize wes_sim bench)
        add_executable(${app} apps/${app}.cpp)
        target_link_libraries(${app} PRIVATE pal::core CLI11::CLI11)
    endforeach()
endif()

# ---------- tests ----------
if(PAL_BUILD_TESTS)
    enable_testing()
    find_package(GTest CONFIG REQUIRED)
    add_executable(palletizer_tests
        tests/test_geometry.cpp
        tests/test_stability.cpp
        tests/test_packers.cpp
        tests/test_robot_cell.cpp
        tests/test_wes.cpp)
    target_link_libraries(palletizer_tests PRIVATE pal::core GTest::gtest_main)
    include(GoogleTest)
    gtest_discover_tests(palletizer_tests DISCOVERY_MODE PRE_TEST)  # one CTest entry per test case
endif()

# ---------- micro-benchmarks ----------
if(PAL_BUILD_BENCHMARKS)
    find_package(benchmark CONFIG REQUIRED)
    add_executable(micro_bench bench/micro_bench.cpp)
    target_link_libraries(micro_bench PRIVATE pal::core benchmark::benchmark_main)
endif()

# ---------- install + CMake package, so other projects (the ROS 2 node) can find_package() it ----------
include(GNUInstallDirs)
include(CMakePackageConfigHelpers)
install(TARGETS palletizer_core EXPORT palletizer_coreTargets
    ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR})
install(DIRECTORY include/ DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})
install(EXPORT palletizer_coreTargets NAMESPACE pal:: DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/palletizer_core)
configure_package_config_file(cmake/palletizer_coreConfig.cmake.in
    ${CMAKE_CURRENT_BINARY_DIR}/palletizer_coreConfig.cmake
    INSTALL_DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/palletizer_core)
write_basic_package_version_file(${CMAKE_CURRENT_BINARY_DIR}/palletizer_coreConfigVersion.cmake
    COMPATIBILITY SameMajorVersion)
install(FILES ${CMAKE_CURRENT_BINARY_DIR}/palletizer_coreConfig.cmake
              ${CMAKE_CURRENT_BINARY_DIR}/palletizer_coreConfigVersion.cmake
        DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/palletizer_core)
