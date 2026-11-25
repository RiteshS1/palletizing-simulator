"use client";

// Composed scenes used by the docs islands, the landing page and the simulator.
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { staticSource, type PlaybackSource } from "@/lib/player";
import { convexHull, type Plan, type WesPlan } from "@/lib/plan";
import { kraftItems, orderItems } from "@/lib/usePlans";
import { PalletStation, type Overlays, type StationItem } from "./PalletStation";

const MM = 0.001;

export function StationLabel({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="whitespace-nowrap rounded-xs bg-paper/90 px-2 py-1 text-center shadow-sm ring-1 ring-ink/10">
      <div className="font-display text-[13px] font-semibold leading-tight text-ink">{title}</div>
      {sub && <div className="text-[11px] leading-tight text-mute">{sub}</div>}
    </div>
  );
}

export function PlanStation({ plan, source, overlays, interactive, items }: { plan: Plan; source: PlaybackSource; overlays?: Overlays; interactive?: boolean; items?: StationItem[] }) {
  const t = useTranslations("sim");
  const its = useMemo(() => items ?? kraftItems([plan])[0], [plan, items]);
  return (
    <PalletStation
      pallet={plan.pallet}
      items={its}
      source={source}
      overlays={overlays}
      interactive={interactive}
      formatTip={(it) => (
        <div className="whitespace-nowrap rounded-xs bg-ink px-2.5 py-1.5 text-[12px] leading-snug text-paper shadow-lg">
          <div className="font-semibold">{t("box", { id: it.id })}</div>
          <div>
            {it.sx} × {it.sy} × {it.sz} mm · {it.weight.toFixed(1)} kg
          </div>
        </div>
      )}
    />
  );
}

export function CompareStations({ greedy, ep, source, overlays }: { greedy: Plan; ep: Plan; source: PlaybackSource; overlays?: Overlays }) {
  const t = useTranslations("home");
  const [gi, ei] = useMemo(() => kraftItems([greedy, ep]), [greedy, ep]);
  return (
    <>
      <group position={[-0.9, 0, 0]}>
        <PalletStation pallet={greedy.pallet} items={gi} source={source} overlays={overlays} label={<StationLabel title={t("greedy")} sub={`${greedy.metrics.placed}/${greedy.metrics.offered}`} />} />
      </group>
      <group position={[0.9, 0, 0]}>
        <PalletStation pallet={ep.pallet} items={ei} source={source} overlays={overlays} label={<StationLabel title={t("ep")} sub={`${ep.metrics.placed}/${ep.metrics.offered}`} />} />
      </group>
    </>
  );
}

export function OrderStations({ wes, source, compact }: { wes: WesPlan; source: PlaybackSource; compact?: boolean }) {
  const t = useTranslations("sim");
  const items = useMemo(() => orderItems(wes), [wes]);
  const n = wes.pallets.length;
  const cols = Math.min(compact ? 4 : 5, Math.max(1, Math.ceil(Math.sqrt(n * 1.6))));
  const rows = Math.ceil(n / cols);
  return (
    <>
      {wes.pallets.map((p, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        return (
          <PalletStation
            key={p.id}
            pallet={wes.pallet}
            items={items[i]}
            source={source}
            position={[(c - (cols - 1) / 2) * 1.75, 0, (r - (rows - 1) / 2) * 1.75]}
            wrappedAfterStep={p.closedAfterStep}
            label={<StationLabel title={t("pallet", { n: p.id + 1 })} sub={p.destination} />}
          />
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------- frames (TF) demo
// The robot base frame follows ROS conventions: x forward, y left, z up, metres. A root group
// rotated -90° about x maps ROS z-up into three.js y-up, so everything inside uses ROS numbers.
function Axes({ size = 0.25, label, color = "#141414" }: { size?: number; label: string; color?: string }) {
  return (
    <group>
      <Line points={[[0, 0, 0], [size, 0, 0]]} color="#d9430c" lineWidth={3} />
      <Line points={[[0, 0, 0], [0, size, 0]]} color="#3d8f6c" lineWidth={3} />
      <Line points={[[0, 0, 0], [0, 0, size]]} color="#2b59c3" lineWidth={3} />
      <Html position={[0, 0, size + 0.06]} center className="pointer-events-none">
        <span className="whitespace-nowrap rounded-xs bg-paper/90 px-1.5 py-0.5 font-mono text-[11px] ring-1 ring-ink/10" style={{ color }}>
          {label}
        </span>
      </Html>
    </group>
  );
}

export function FramesScene({ ep }: { ep: Plan }) {
  const t = useTranslations("scene");
  const items = useMemo(() => kraftItems([ep])[0], [ep]);
  const tool = useRef<THREE.Group>(null);
  const [step, setStep] = useState(ep.placements.length);
  const source = useMemo<PlaybackSource>(() => ({ read: () => ({ step, t: 0 }) }), [step]);
  const clock = useRef(0);
  const palletPose = { position: [1.6, -0.6, 0.144] as const, yaw: Math.PI / 2 };

  useFrame((_, dt) => {
    clock.current += dt;
    const i = Math.floor(clock.current / 1.1) % ep.placements.length;
    if (i + 1 !== step) setStep(i + 1);
    const pose = ep.placements[i].placePose;
    if (pose && tool.current) {
      tool.current.position.set(...pose.position);
      tool.current.quaternion.set(...pose.orientation);
    }
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[-1.1, 0, 0]}>
      <Axes label={`${t("world")} / ${t("robotBase")}`} size={0.35} />
      <mesh position={[0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 0.36, 40]} />
        <meshStandardMaterial color="#ff5a1f" roughness={0.35} metalness={0.25} />
      </mesh>
      <group position={[palletPose.position[0], palletPose.position[1], 0]} rotation={[0, 0, palletPose.yaw]}>
        {/* pallet frame origin at the deck's back-left corner; station geometry is in three.js coords */}
        <group position={[0, 0, 0.144]}>
          <Axes label={t("pallet")} />
        </group>
        <group rotation={[Math.PI / 2, 0, 0]} position={[(ep.pallet.length / 2) * MM, (ep.pallet.width / 2) * MM, 0]}>
          <PalletStation pallet={ep.pallet} items={items} source={source} />
        </group>
      </group>
      <group ref={tool}>
        <Axes label={t("tool")} size={0.18} color="#d9430c" />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- AABB demo
export function AabbScene() {
  const t = useTranslations("scene");
  const moving = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const [state, setState] = useState<"overlap" | "touch" | "free">("free");
  useFrame(({ clock }) => {
    // Box A spans x ∈ [-0.3, 0.3]. Box B (0.4 wide) slides across it.
    const x = Math.sin(clock.elapsedTime * 0.7) * 0.85;
    if (moving.current) moving.current.position.x = x;
    const overlap = Math.max(0, Math.min(0.3, x + 0.2) - Math.max(-0.3, x - 0.2));
    const s = overlap > 0.002 ? "overlap" : overlap > -0.002 && Math.abs(Math.abs(x) - 0.5) < 0.03 ? "touch" : "free";
    if (mat.current) mat.current.color.set(s === "overlap" ? "#d9430c" : "#c9a678");
    if (s !== state) setState(s);
  });
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.5, 0.5]} />
        <meshStandardMaterial color="#e2c79c" roughness={0.85} />
      </mesh>
      <mesh ref={moving} position={[0.8, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial ref={mat} color="#c9a678" roughness={0.85} transparent opacity={0.9} />
      </mesh>
      <Html position={[0, 0.02, 0.5]} center className="pointer-events-none">
        <span className={`rounded-xs px-2 py-1 text-xs font-semibold ${state === "overlap" ? "bg-signal text-ink" : "bg-ink text-paper"}`}>
          {state === "overlap" ? t("overlap") : t("noOverlap")}
        </span>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------- support polygon demo
export function SupportScene() {
  const t = useTranslations("scene");
  const top = useRef<THREE.Group>(null);
  const hullRef = useRef<THREE.Mesh>(null);
  const [tips, setTips] = useState(false);
  const geo = useMemo(() => new THREE.BufferGeometry(), []);
  useFrame(({ clock }) => {
    // Two pillars at x ∈ [-0.5,-0.3] and [0.3,0.5]; a 0.8-wide box slides over them.
    const x = Math.sin(clock.elapsedTime * 0.45) * 0.55;
    if (top.current) top.current.position.x = x;
    const pillars = [[-0.5, -0.3], [0.3, 0.5]];
    const pts: [number, number][] = [];
    for (const [a, b] of pillars) {
      const lo = Math.max(a, x - 0.4), hi = Math.min(b, x + 0.4);
      if (hi > lo) pts.push([lo, -0.25], [hi, -0.25], [hi, 0.25], [lo, 0.25]);
    }
    const hull = convexHull(pts);
    const minX = hull.length ? Math.min(...hull.map((p) => p[0])) : 0;
    const maxX = hull.length ? Math.max(...hull.map((p) => p[0])) : 0;
    const out = hull.length < 3 || x < minX || x > maxX;
    if (out !== tips) setTips(out);
    if (hull.length >= 3) {
      const s = new THREE.Shape();
      hull.forEach(([hx, hz], i) => (i === 0 ? s.moveTo(hx, hz) : s.lineTo(hx, hz)));
      const g = new THREE.ShapeGeometry(s);
      geo.setAttribute("position", g.getAttribute("position"));
      geo.setIndex(g.getIndex());
      geo.computeBoundingSphere();
      g.dispose();
    }
    if (hullRef.current) hullRef.current.visible = hull.length >= 3;
  });
  return (
    <group>
      {[-0.4, 0.4].map((px) => (
        <mesh key={px} position={[px, 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.2, 0.5, 0.5]} />
          <meshStandardMaterial color="#b4956a" roughness={0.85} />
        </mesh>
      ))}
      <mesh ref={hullRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.505, 0]} geometry={geo} renderOrder={5}>
        <meshBasicMaterial color="#2b59c3" transparent opacity={0.35} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
      <group ref={top} position={[0, 0.7, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.8, 0.4, 0.5]} />
          <meshStandardMaterial color={tips ? "#d9430c" : "#e2c79c"} roughness={0.85} transparent opacity={0.88} />
        </mesh>
        <mesh position={[0, -0.19, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
          <circleGeometry args={[0.035, 24]} />
          <meshBasicMaterial color="#ff5a1f" depthTest={false} />
        </mesh>
        <Line points={[[0, 0, 0], [0, -0.2, 0]]} color="#ff5a1f" lineWidth={2} />
      </group>
      <Html position={[0, 0.02, 0.5]} center className="pointer-events-none">
        <span className={`rounded-xs px-2 py-1 text-xs font-semibold ${tips ? "bg-signal text-ink" : "bg-probe text-white"}`}>{t("support")}</span>
      </Html>
    </group>
  );
}

export { staticSource };
