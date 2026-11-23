// palletize: generate a box set, pack it, print the plan as JSON.
//
//   palletize --algo ep --n 40 --seed 42 --out plan.json
//
// JSON goes to stdout (or --out); a one-line summary goes to stderr, so piping the JSON into
// another program never mixes in human-readable text.

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>

#include "api.hpp"

using namespace pal;

static void usage() {
    std::fprintf(stderr,
                 "usage: palletize [--algo greedy|ep] [--n 40] [--seed 42] [--support 0.75]\n"
                 "                 [--restarts 8] [--out file.json]\n");
    std::exit(2);
}

int main(int argc, char** argv) {
    PackRequest req;
    std::string outPath;
    for (int i = 1; i < argc; ++i) {
        auto next = [&]() -> const char* { if (i + 1 >= argc) usage(); return argv[++i]; };
        if (!std::strcmp(argv[i], "--algo")) req.algo = next();
        else if (!std::strcmp(argv[i], "--n")) req.n = std::atoi(next());
        else if (!std::strcmp(argv[i], "--seed")) req.seed = uint32_t(std::strtoul(next(), nullptr, 10));
        else if (!std::strcmp(argv[i], "--support")) req.minSupport = std::atof(next());
        else if (!std::strcmp(argv[i], "--restarts")) req.restarts = std::atoi(next());
        else if (!std::strcmp(argv[i], "--out")) outPath = next();
        else usage();
    }
    if (req.algo != "greedy" && req.algo != "ep") usage();

    RunOutput out = runPack(req);
    if (outPath.empty()) std::printf("%s\n", out.json.c_str());
    else std::ofstream(outPath) << out.json << '\n';
    std::fprintf(stderr, "%s\n", out.summary.c_str());
    return 0;
}
