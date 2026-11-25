"use client";

// The live 3D panel next to each docs page ("island": the only interactive part of an otherwise
// static page, loaded lazily on the client).
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { Studio } from "@/components/three/Studio";
import { AabbScene, CompareStations, FramesScene, OrderStations, PlanStation, SupportScene } from "@/components/three/scenes";
import { DepalScene, PATTERN_TOTAL, PatternsScene, ScanScene, SuctionScene } from "@/components/three/scenes2";
import type { SceneKind } from "@/lib/docs";
import { usePlayer, type Player } from "@/lib/player";
import { usePlans } from "@/lib/usePlans";

const CAMERAS: Record<SceneKind, { camera: [number, number, number]; target: [number, number, number] }> = {
  hero: { camera: [3.1, 2.5, 3.6], target: [0, 0.8, 0] },
  "plan-ep": { camera: [3.1, 2.5, 3.6], target: [0, 0.8, 0] },
  "plan-greedy": { camera: [3.1, 2.5, 3.6], target: [0, 0.75, 0] },
  compare: { camera: [3.2, 2.6, 4.2], target: [0, 0.8, 0] },
  orders: { camera: [5.2, 4.6, 6.4], target: [0, 0.6, 0] },
  frames: { camera: [2.4, 2.4, 3.4], target: [0, 0.6, 0] },
  aabb: { camera: [2.0, 1.6, 3.0], target: [0, 0.3, 0] },
  support: { camera: [1.9, 1.8, 3.1], target: [0, 0.45, 0] },
  scan: { camera: [3.4, 2.9, 4.0], target: [0, 1.0, 0] },
  suction: { camera: [1.75, 1.35, 2.25], target: [0, 0.5, 0] },
  depal: { camera: [3.1, 2.5, 3.6], target: [0, 0.8, 0] },
  patterns: { camera: [1.6, 3.6, 6.6], target: [0, 0.7, 0] },
};

// Replay the plan, pause on the finished pallet, then start over.
function useLoop(player: Player, step: number, total: number, playing: boolean) {
  useEffect(() => {
    if (step < total || playing) return;
    const id = setTimeout(() => player.play(), 2600);
    return () => clearTimeout(id);
  }, [player, step, total, playing]);
}

export default function Island({ scene }: { scene: SceneKind }) {
  const t = useTranslations("docs");
  const plans = usePlans();
  const total = useMemo(() => {
    if (!plans) return 0;
    if (scene === "plan-greedy") return plans.greedy.placements.length;
    if (scene === "compare") return Math.max(plans.greedy.placements.length, plans.ep.placements.length);
    if (scene === "orders") return plans.wes.metrics.boxes;
    if (scene === "patterns") return PATTERN_TOTAL;
    return plans.ep.placements.length;
  }, [plans, scene]);
  const { player, snapshot } = usePlayer(total, { autoplay: true, speed: scene === "orders" ? 8 : 3 });
  useLoop(player, snapshot.step, total, snapshot.playing);

  const cam = CAMERAS[scene];
  return (
    <figure className="relative h-full w-full overflow-hidden rounded-xs bg-paper-2 ring-1 ring-line">
      {plans && (
        <Studio camera={cam.camera} target={cam.target} quality="low" env={scene === "orders" ? "warehouse" : "studio"} background="#ecebe6">
          {(scene === "hero" || scene === "plan-ep") && <PlanStation plan={plans.ep} source={player} overlays={{ com: true, candidates: scene === "plan-ep" }} />}
          {scene === "plan-greedy" && <PlanStation plan={plans.greedy} source={player} overlays={{ com: true }} />}
          {scene === "compare" && <CompareStations greedy={plans.greedy} ep={plans.ep} source={player} />}
          {scene === "orders" && <OrderStations wes={plans.wes} source={player} compact />}
          {scene === "frames" && <FramesScene ep={plans.ep} />}
          {scene === "aabb" && <AabbScene />}
          {scene === "support" && <SupportScene />}
          {scene === "scan" && <ScanScene ep={plans.ep} />}
          {scene === "suction" && <SuctionScene />}
          {scene === "depal" && <DepalScene ep={plans.ep} />}
          {scene === "patterns" && <PatternsScene source={player} />}
        </Studio>
      )}
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 text-[12px] text-mute">
        <span className="rounded-xs bg-paper/85 px-2 py-1 font-medium text-ink-2">{t("island")}</span>
        <span className="hidden rounded-xs bg-paper/85 px-2 py-1 sm:inline">{t("islandHint")}</span>
      </figcaption>
    </figure>
  );
}
