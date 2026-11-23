#pragma once
// A tiny test framework (~30 lines) so we need no external dependency.
//
//   TEST(my_test) { CHECK(1 + 1 == 2); }
//
// How it works: TEST(name) declares a function and a static object whose constructor runs
// before main() and appends the function to a global registry. main() then runs them all.

#include <cstdio>
#include <functional>
#include <string>
#include <vector>

namespace testing {

struct TestCase {
    std::string name;
    std::function<void()> fn;
};

// A function-local static is created on first use, which avoids the "static initialization
// order fiasco" when tests in several .cpp files register themselves.
inline std::vector<TestCase>& registry() {
    static std::vector<TestCase> tests;
    return tests;
}

inline int& failures() {
    static int count = 0;
    return count;
}

struct Registrar {
    Registrar(const char* name, std::function<void()> fn) { registry().push_back({name, fn}); }
};

}  // namespace testing

#define TEST(name)                                                    \
    static void name();                                               \
    static testing::Registrar registrar_##name(#name, name);          \
    static void name()

#define CHECK(cond)                                                              \
    do {                                                                         \
        if (!(cond)) {                                                           \
            std::fprintf(stderr, "    FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond); \
            ++testing::failures();                                               \
        }                                                                        \
    } while (0)
