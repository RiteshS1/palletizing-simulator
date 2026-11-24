#!/usr/bin/env bash
# Build the C++ engine and produce everything the web app needs:
#   web/public/data/plan_greedy.json, plan_ep.json   example plans (40 boxes, seed 42)
#   web/public/data/wes.json                         an order shift (24 orders, seed 7)
#   web/public/wasm/palletizer.{js,wasm}             the engine as WebAssembly (needs Emscripten)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/web/public"
export VCPKG_ROOT="${VCPKG_ROOT:-$HOME/vcpkg}"

cd "$ROOT/core"
cmake --preset release > /dev/null
cmake --build --preset release --target palletize wes_sim

mkdir -p "$OUT/data"
./build/release/palletize --algo greedy --seed 42 -o "$OUT/data/plan_greedy.json"
./build/release/palletize --algo ep --seed 42 -o "$OUT/data/plan_ep.json"
./build/release/wes_sim --orders 24 --seed 7 -o "$OUT/data/wes.json"

# Locate Emscripten: emsdk (CI) sets EMSDK; Homebrew installs it under libexec.
if [[ -z "${EMSCRIPTEN_ROOT:-}" ]]; then
  if [[ -n "${EMSDK:-}" ]]; then EMSCRIPTEN_ROOT="$EMSDK/upstream/emscripten"
  elif command -v brew > /dev/null && [[ -d "$(brew --prefix emscripten 2> /dev/null)/libexec" ]]; then
    EMSCRIPTEN_ROOT="$(brew --prefix emscripten)/libexec"
  fi
fi
if [[ -n "${EMSCRIPTEN_ROOT:-}" && -f "$EMSCRIPTEN_ROOT/cmake/Modules/Platform/Emscripten.cmake" ]]; then
  export EMSCRIPTEN_ROOT
  cmake --preset wasm > /dev/null
  cmake --build --preset wasm
  mkdir -p "$OUT/wasm"
  cp build/wasm/palletizer.js build/wasm/palletizer.wasm "$OUT/wasm/"
  echo "engine: native plans + WebAssembly written to web/public"
else
  echo "engine: native plans written; Emscripten not found, skipped the WebAssembly build" >&2
fi
