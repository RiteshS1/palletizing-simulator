"use client";

import { useEffect, useState } from "react";
import { kraft, loadJson, orderColor, type Plan, type WesPlan } from "./plan";
import type { StationItem } from "@/components/three/PalletStation";

export interface Plans {
  greedy: Plan;
  ep: Plan;
  wes: WesPlan;
}

// Fetched once per page load and shared by every component that asks.
let cached: Promise<Plans> | null = null;
export function fetchPlans(): Promise<Plans> {
  cached ??= Promise.all([
    loadJson<Plan>("/data/plan_greedy.json"),
    loadJson<Plan>("/data/plan_ep.json"),
    loadJson<WesPlan>("/data/wes.json"),
  ]).then(([greedy, ep, wes]) => ({ greedy, ep, wes }));
  return cached;
}

export function usePlans(): Plans | null {
  const [plans, setPlans] = useState<Plans | null>(null);
  useEffect(() => {
    let alive = true;
    fetchPlans().then((p) => alive && setPlans(p)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return plans;
}

/** Colour every placement of one or more plans on a shared weight scale (heavier = darker). */
export function kraftItems(plans: Plan[]): StationItem[][] {
  const weights = plans.flatMap((p) => p.boxes.map((b) => b.weight));
  const min = Math.min(...weights), max = Math.max(...weights);
  return plans.map((p) => p.placements.map((pl) => ({ ...pl, color: kraft(pl.weight, min, max) })));
}

export function orderItems(wes: WesPlan): StationItem[][] {
  return wes.pallets.map((p) => p.placements.map((pl) => ({ ...pl, color: orderColor(pl.orderId ?? 0) })));
}
