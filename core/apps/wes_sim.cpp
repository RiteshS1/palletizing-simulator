// wes_sim: simulate a shift of customer orders flowing onto pallets.
//
//   wes_sim --orders 24 --seed 7 [--policy waves|order] [--out wes.json]

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>

#include "api.hpp"

using namespace pal;

int main(int argc, char** argv) {
    WesRequest req;
    std::string outPath;
    for (int i = 1; i < argc; ++i) {
        if (!std::strcmp(argv[i], "--orders") && i + 1 < argc) req.orders = std::atoi(argv[++i]);
        else if (!std::strcmp(argv[i], "--seed") && i + 1 < argc) req.seed = uint32_t(std::strtoul(argv[++i], nullptr, 10));
        else if (!std::strcmp(argv[i], "--policy") && i + 1 < argc) req.policy = argv[++i];
        else if (!std::strcmp(argv[i], "--out") && i + 1 < argc) outPath = argv[++i];
        else {
            std::fprintf(stderr, "usage: wes_sim [--orders 24] [--seed 7] [--policy waves|order] [--out wes.json]\n");
            return 2;
        }
    }
    RunOutput out = runWesSim(req);
    if (outPath.empty()) std::printf("%s\n", out.json.c_str());
    else std::ofstream(outPath) << out.json << '\n';
    std::fprintf(stderr, "%s\n", out.summary.c_str());
    return 0;
}
