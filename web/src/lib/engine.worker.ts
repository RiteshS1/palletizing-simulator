/// <reference lib="webworker" />
// Runs the C++ engine (compiled to WebAssembly) off the main thread, so planning never
// freezes the UI. Messages: { id, kind: "ping" | "pack" | "wes", args } -> { id, ok, json | error }.

interface Engine {
  pack(algo: string, n: number, seed: number, minSupport: number): string;
  wes(orders: number, seed: number): string;
}

let enginePromise: Promise<Engine> | null = null;

function loadEngine(): Promise<Engine> {
  enginePromise ??= (async () => {
    // A runtime URL (not a bundler import): the file is produced by `make wasm`/build-engine.sh.
    const url = new URL("/wasm/palletizer.js", self.location.origin).href;
    const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url);
    return (await mod.default()) as Engine;
  })();
  return enginePromise;
}

self.onmessage = async (e: MessageEvent<{ id: number; kind: "ping" | "pack" | "wes"; args: unknown[] }>) => {
  const { id, kind, args } = e.data;
  try {
    const engine = await loadEngine();
    let json = "";
    if (kind === "pack") json = engine.pack(...(args as [string, number, number, number]));
    else if (kind === "wes") json = engine.wes(...(args as [number, number]));
    self.postMessage({ id, ok: true, json });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
