"use client";

import type { Plan, WesPlan } from "./plan";

// Promise-based wrapper around the engine worker: each request gets an id, the matching reply
// resolves it. One worker for the whole page.
type Pending = { resolve: (json: string) => void; reject: (e: Error) => void };

class EngineClient {
  private worker: Worker;
  private next = 1;
  private pending = new Map<number, Pending>();
  readonly ready: Promise<boolean>;

  constructor() {
    this.worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; json?: string; error?: string }>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.json ?? "");
      else p.reject(new Error(e.data.error));
    };
    this.ready = this.call("ping", []).then(
      () => true,
      () => false,
    );
  }

  private call(kind: "ping" | "pack" | "wes", args: unknown[]): Promise<string> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, kind, args });
    });
  }

  async pack(algo: "greedy" | "ep", n: number, seed: number, minSupport: number): Promise<Plan> {
    return JSON.parse(await this.call("pack", [algo, n, seed, minSupport])) as Plan;
  }

  async wes(orders: number, seed: number): Promise<WesPlan> {
    return JSON.parse(await this.call("wes", [orders, seed])) as WesPlan;
  }
}

let client: EngineClient | null = null;
export function getEngine(): EngineClient {
  client ??= new EngineClient();
  return client;
}
