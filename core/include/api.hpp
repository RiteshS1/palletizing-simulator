#pragma once
// The two things a front-end can ask the engine to do, each returning JSON.
// Both the command-line apps and the WebAssembly build call these, so the browser and the CLI
// run exactly the same code path: same inputs give byte-for-byte the same plan.

#include <cstdint>
#include <string>

namespace pal {

struct PackRequest {
    std::string algo = "ep";  // "greedy" or "ep"
    int n = 40;
    uint32_t seed = 42;
    double minSupport = 0.75;
    int restarts = 8;
};

struct WesRequest {
    int orders = 24;
    uint32_t seed = 7;
    std::string policy = "waves";  // "waves" or "order" (order by order)
};

struct RunOutput {
    std::string json;     // the full plan
    std::string summary;  // one human-readable line
};

RunOutput runPack(const PackRequest& req);
RunOutput runWesSim(const WesRequest& req);

}  // namespace pal
