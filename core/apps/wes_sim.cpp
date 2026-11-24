// wes_sim: simulate a shift of customer orders flowing onto pallets.
//
//   wes_sim --orders 24 --seed 7 --policy waves --out wes.json

#include <CLI/CLI.hpp>
#include <fmt/core.h>
#include <fstream>

#include "pal/api.hpp"

int main(int argc, char** argv) {
    pal::WesRequest req;
    std::string outPath;

    CLI::App app{"Simulate a shift of orders going onto pallets (warehouse execution system)."};
    app.add_option("--orders", req.orders, "Number of customer orders")->check(CLI::Range(1, 500))->capture_default_str();
    app.add_option("--seed", req.seed, "Random seed")->capture_default_str();
    app.add_option("--policy", req.policy, "waves (batched) or order (one by one)")->check(CLI::IsMember({"waves", "order"}))->capture_default_str();
    app.add_option("-o,--out", outPath, "Write the JSON to this file instead of stdout");
    CLI11_PARSE(app, argc, argv);

    const pal::RunOutput out = pal::runWesSim(req);
    if (outPath.empty()) fmt::print("{}\n", out.json);
    else std::ofstream(outPath) << out.json << '\n';
    fmt::print(stderr, "{}\n", out.summary);
    return 0;
}
