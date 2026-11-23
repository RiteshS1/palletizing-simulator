#include "testing.hpp"

int main() {
    auto& tests = testing::registry();
    for (const auto& t : tests) {
        int before = testing::failures();
        t.fn();
        std::printf("  %s %s\n", testing::failures() == before ? "ok  " : "FAIL", t.name.c_str());
    }
    std::printf("\n%zu tests, %d failed checks\n", tests.size(), testing::failures());
    return testing::failures() == 0 ? 0 : 1;
}
