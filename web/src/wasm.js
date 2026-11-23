// Loads the C++ engine compiled to WebAssembly (Phase 8), if it was built.
//
// `make -C core wasm` writes public/wasm/palletizer.js (+ .wasm). That file is an ES module whose
// default export is a factory: calling it downloads and instantiates the .wasm and resolves to the
// module, whose functions were exported from C++ with embind.
// If the build isn't there, everything still works from the pre-generated JSON plans.

let enginePromise = null;

export function loadEngine() {
  if (!enginePromise) {
    const url = new URL('wasm/palletizer.js', document.baseURI).href;
    enginePromise = import(/* @vite-ignore */ url)
      .then((mod) => mod.default())
      .catch(() => null);
  }
  return enginePromise;
}
