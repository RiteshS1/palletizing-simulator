"use client";

import dynamic from "next/dynamic";
import type { SceneKind } from "@/lib/docs";

// three.js needs the browser (WebGL), so the island is loaded only on the client.
const Island = dynamic(() => import("./Island"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-xs bg-paper-2 ring-1 ring-line" />,
});

export function IslandLoader({ scene }: { scene: SceneKind }) {
  return <Island scene={scene} />;
}
