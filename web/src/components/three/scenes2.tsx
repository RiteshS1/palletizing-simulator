"use client";

// Teaching scenes for the "Applications" chapters: perception (scan -> point cloud), vacuum
// grippers (airflow), depalletizing (unstacking) and layer patterns (column vs interlocked).
import { Html, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { PlaybackSource } from "@/lib/player";
import { kraft, type Plan, type Placement } from "@/lib/plan";
import { kraftItems } from "@/lib/usePlans";
import { dotTexture, prefersReducedMotion, seeded } from "./effects";
import { PalletStation, type StationItem } from "./PalletStation";
import { StationLabel } from "./scenes";

const MM = 0.001;
const PALLET_H = 144;
const SIGNAL = "#ff5a1f";

function Tag({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "signal" | "probe" }) {
  const cls = tone === "signal" ? "bg-signal text-ink" : tone === "probe" ? "bg-probe text-white" : "bg-ink text-paper";
  return <span className={`whitespace-nowrap rounded-xs px-2 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}

// ---------------------------------------------------------------- perception: scan -> point cloud
// Height -> colour, like a depth image (blue low ... red high).
function heightColor(t: number, out: THREE.Color) {
  const stops = [
    [0.0, 0x2b59c3],
    [0.35, 0x3d8f6c],
    [0.65, 0xe8b931],
    [1.0, 0xff5a1f],
  ] as const;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const k = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return out.set(stops[i - 1][1]).lerp(new THREE.Color(stops[i][1]), k);
    }
  }
  return out.set(stops[stops.length - 1][1]);
}

/** Sample the visible surfaces of a finished stack: tops (not covered by a box above) and the two front faces. */
function sampleSurface(placements: Placement[], spacing = 38): { pts: Float32Array; heights: Float32Array } {
  const out: number[] = [];
  const covered = (x: number, y: number, z: number) => placements.some((q) => x > q.x && x < q.x + q.sx && y > q.y && y < q.y + q.sy && z > q.z && z < q.z + q.sz);
  for (const p of placements) {
    const top = p.z + p.sz;
    for (let x = p.x + spacing / 2; x < p.x + p.sx; x += spacing)
      for (let y = p.y + spacing / 2; y < p.y + p.sy; y += spacing) if (!covered(x, y, top + 5)) out.push(x, y, top + 2);
    for (let x = p.x + spacing / 2; x < p.x + p.sx; x += spacing)
      for (let z = p.z + spacing / 2; z < top; z += spacing) if (!covered(x, p.y + p.sy + 5, z)) out.push(x, p.y + p.sy + 2, z);
    for (let y = p.y + spacing / 2; y < p.y + p.sy; y += spacing)
      for (let z = p.z + spacing / 2; z < top; z += spacing) if (!covered(p.x + p.sx + 5, y, z)) out.push(p.x + p.sx + 2, y, z);
  }
  const pts = new Float32Array(out);
  const heights = new Float32Array(out.length / 3);
  for (let i = 0; i < heights.length; i++) heights[i] = pts[i * 3 + 2];
  return { pts, heights };
}

export function ScanScene({ ep }: { ep: Plan }) {
  const t = useTranslations("scene");
  const items = useMemo(() => kraftItems([ep])[0], [ep]);
  const source = useMemo(() => ({ read: () => ({ step: items.length, t: 0 }) }), [items.length]);
  const L = ep.pallet.length;
  const W = ep.pallet.width;
  const { pts, heights } = useMemo(() => sampleSurface(ep.placements), [ep]);
  const maxH = useMemo(() => Math.max(...heights), [heights]);
  const colors = useMemo(() => {
    const c = new Float32Array(pts.length);
    const tmp = new THREE.Color();
    for (let i = 0; i < heights.length; i++) {
      heightColor(heights[i] / maxH, tmp);
      c.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    return c;
  }, [pts, heights, maxH]);
  const visible = useMemo(() => new Float32Array(pts.length), [pts]);
  const cloud = useRef<THREE.Points>(null);
  const plane = useRef<THREE.Mesh>(null);
  const [phase, setPhase] = useState<"scan" | "cloud">("scan");

  useFrame(({ clock }) => {
    // 0..4 s sweep across x; 4..7 s hold the finished cloud; loop.
    const cycle = prefersReducedMotion() ? 5 : clock.elapsedTime % 7;
    const sweep = Math.min(1, cycle / 4);
    const xs = -60 + sweep * (L + 120);
    if (plane.current) {
      plane.current.position.x = xs;
      plane.current.visible = cycle < 4;
    }
    const p = cloud.current;
    if (p) {
      const arr = p.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < pts.length; i += 3) {
        const on = pts[i] <= xs;
        arr[i] = pts[i];
        arr[i + 1] = pts[i + 1];
        arr[i + 2] = on ? pts[i + 2] : -1e6;
      }
      p.geometry.attributes.position.needsUpdate = true;
    }
    const ph = cycle < 4 ? "scan" : "cloud";
    if (ph !== phase) setPhase(ph);
  });

  return (
    <group>
      <PalletStation pallet={ep.pallet} items={items} source={source} />
      <group rotation={[-Math.PI / 2, 0, 0]} scale={MM} position={[(-L / 2) * MM, PALLET_H * MM, (W / 2) * MM]}>
        {/* overhead 3D camera */}
        <group position={[L / 2, W / 2, 2350]}>
          <mesh castShadow>
            <boxGeometry args={[420, 160, 110]} />
            <meshStandardMaterial color="#1f2023" roughness={0.4} metalness={0.6} />
          </mesh>
          {[-120, 120].map((x) => (
            <mesh key={x} position={[x, 0, -60]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[30, 30, 20, 24]} />
              <meshStandardMaterial color="#2b59c3" emissive="#2b59c3" emissiveIntensity={0.8} />
            </mesh>
          ))}
        </group>
        {/* the sweeping laser plane */}
        <mesh ref={plane} position={[0, W / 2, 1150]}>
          <boxGeometry args={[6, W + 160, 2300]} />
          <meshBasicMaterial color={SIGNAL} transparent opacity={0.28} depthWrite={false} />
        </mesh>
        <points ref={cloud} frustumCulled={false} renderOrder={12}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[visible, 3]} />
            <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.13} map={dotTexture()} vertexColors transparent depthWrite={false} sizeAttenuation />
        </points>
      </group>
      <Html position={[0, 0.02, 0.95]} center className="pointer-events-none">
        <Tag tone={phase === "scan" ? "signal" : "probe"}>{phase === "scan" ? t("scanning") : t("pointCloud")}</Tag>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------- vacuum gripper: airflow
export function SuctionScene() {
  const t = useTranslations("scene");
  const tool = useRef<THREE.Group>(null);
  const box = useRef<THREE.Group>(null);
  const flow = useRef<THREE.Points>(null);
  const [label, setLabel] = useState<"approach" | "vacuum" | "release">("approach");
  const N = 360;
  const seeds = useMemo(() => {
    const rnd = seeded(5);
    return Array.from({ length: N }, () => ({ cup: Math.floor(rnd() * 4), a: rnd() * Math.PI * 2, k: rnd() }));
  }, []);
  const positions = useMemo(() => new Float32Array(N * 3), []);
  const cups: [number, number][] = [
    [-0.11, -0.08],
    [0.11, -0.08],
    [-0.11, 0.08],
    [0.11, 0.08],
  ];

  useFrame(({ clock }) => {
    // 7 s cycle: descend, vacuum on + lift, carry, set down, release.
    const c = prefersReducedMotion() ? 2.6 : clock.elapsedTime % 7;
    const boxTop = 0.3;
    let toolY = 1.0;
    let boxY = 0;
    let on = false;
    let phase: typeof label = "approach";
    if (c < 1.6) {
      toolY = 1.0 - (c / 1.6) * (1.0 - boxTop); // descend
    } else if (c < 2.2) {
      toolY = boxTop; // seal: vacuum builds up
      on = true;
      phase = "vacuum";
    } else if (c < 4.2) {
      toolY = boxTop + ((c - 2.2) / 2) * 0.45; // lift with the carton
      boxY = toolY - boxTop;
      on = true;
      phase = "vacuum";
    } else if (c < 5.4) {
      toolY = boxTop + 0.45 - ((c - 4.2) / 1.2) * 0.45; // set it down
      boxY = toolY - boxTop;
      on = true;
      phase = "vacuum";
    } else {
      toolY = boxTop + ((c - 5.4) / 1.6) * 0.7; // release and retract
      phase = "release";
    }
    if (tool.current) tool.current.position.y = toolY;
    if (box.current) box.current.position.y = boxY;
    if (phase !== label) setLabel(phase);
    // airflow: particles spiral inward to each cup and up the hose while vacuum is on
    const p = flow.current;
    if (p) {
      const arr = p.geometry.attributes.position.array as Float32Array;
      const time = clock.elapsedTime;
      for (let i = 0; i < N; i++) {
        const s = seeds[i];
        const u = (time * 0.9 + s.k) % 1; // 0: far out on the box top, 1: inside the cup
        const [cx, cz] = cups[s.cup];
        const r = 0.07 * (1 - u);
        const a = s.a + u * 4;
        arr[i * 3] = on ? cx + Math.cos(a) * r : 0;
        arr[i * 3 + 1] = on ? toolY + 0.004 + u * 0.05 : -10;
        arr[i * 3 + 2] = on ? cz + Math.sin(a) * r : 0;
      }
      p.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh position={[0, -0.03, 0]} receiveShadow>
        <boxGeometry args={[0.9, 0.06, 0.6]} />
        <meshStandardMaterial color="#c4c7cc" roughness={0.55} metalness={0.3} />
      </mesh>
      <group ref={box}>
        <RoundedBox args={[0.42, 0.3, 0.32]} radius={0.01} smoothness={3} position={[0, 0.15, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={kraft(8, 2, 20)} roughness={0.85} />
        </RoundedBox>
      </group>
      <group ref={tool} position={[0, 1, 0]}>
        <mesh position={[0, 0.03, 0]} castShadow>
          <boxGeometry args={[0.34, 0.024, 0.24]} />
          <meshStandardMaterial color="#2a2c30" roughness={0.45} metalness={0.6} />
        </mesh>
        {cups.map(([x, z], i) => (
          <mesh key={i} position={[x, 0.012, z]} castShadow>
            <cylinderGeometry args={[0.03, 0.036, 0.024, 24]} />
            <meshStandardMaterial color="#141414" roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 0.7, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 1.3, 24]} />
          <meshStandardMaterial color={SIGNAL} roughness={0.35} metalness={0.25} />
        </mesh>
      </group>
      <points ref={flow} frustumCulled={false} renderOrder={12}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.07} map={dotTexture()} color="#7fb0ff" transparent opacity={0.9} depthWrite={false} sizeAttenuation />
      </points>
      <Html position={[0, 0.02, 0.48]} center className="pointer-events-none">
        <Tag tone={label === "vacuum" ? "probe" : label === "release" ? "signal" : "ink"}>{t(label === "vacuum" ? "vacuumOn" : label === "release" ? "release" : "approach")}</Tag>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------- depalletizing: unstack top-down
export function DepalScene({ ep }: { ep: Plan }) {
  const t = useTranslations("scene");
  const items = useMemo(() => kraftItems([ep])[0], [ep]);
  const total = items.length;
  // Removal k picks the last-placed box first (top-down). Re-uses the placing animation in reverse:
  // step = total-1-k with t running 1 -> 0 makes the box rise with the gripper and vanish at the top.
  const progress = useRef({ k: 0, ph: 0 });
  const source = useMemo<PlaybackSource>(
    () => ({
      read() {
        const { k, ph } = progress.current;
        if (k >= total) return { step: 0, t: 0 };
        return { step: total - 1 - k, t: Math.max(0.0001, 1 - ph) };
      },
    }),
    [total],
  );
  useFrame((_, dt) => {
    if (prefersReducedMotion()) return;
    const pr = progress.current;
    pr.ph += dt * 1.6;
    if (pr.ph >= 1) {
      pr.ph = 0;
      pr.k += 1;
      if (pr.k > total + 2) pr.k = 0; // pause on the empty pallet, then restack instantly
    }
  });
  return (
    <group>
      <PalletStation pallet={ep.pallet} items={items} source={source} />
      <Html position={[0, 0.02, 0.95]} center className="pointer-events-none">
        <Tag tone="signal">{t("unstacking")}</Tag>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------- layer patterns: column vs interlock
function patternItems(kind: "column" | "interlock"): StationItem[] {
  const out: StationItem[] = [];
  const h = 250;
  let step = 0;
  for (let layer = 0; layer < 5; layer++) {
    const z = layer * h;
    const rotated = kind === "interlock" && layer % 2 === 1;
    if (!rotated) {
      for (let iy = 0; iy < 3; iy++)
        for (let ix = 0; ix < 3; ix++) out.push({ step: step++, id: step, x: ix * 400, y: 50 + iy * 300, z, sx: 400, sy: 300, sz: h, weight: 8, rotated: false, color: "" });
    } else {
      for (let iy = 0; iy < 2; iy++)
        for (let ix = 0; ix < 4; ix++) out.push({ step: step++, id: step, x: ix * 300, y: 100 + iy * 400, z, sx: 300, sy: 400, sz: h, weight: 8, rotated: true, color: "" });
    }
  }
  return out.map((it) => ({ ...it, color: kraft(4 + ((it.step * 37) % 9), 2, 14) }));
}

export function PatternsScene({ source }: { source: PlaybackSource }) {
  const t = useTranslations("scene");
  const column = useMemo(() => patternItems("column"), []);
  const interlock = useMemo(() => patternItems("interlock"), []);
  const pallet = { length: 1200, width: 1000, maxHeight: 1800, maxLoad: 1000 };
  return (
    <>
      <PalletStation pallet={pallet} items={column} source={source} position={[-1.05, 0, 0]} label={<StationLabel title={t("column")} />} />
      <PalletStation pallet={pallet} items={interlock} source={source} position={[1.05, 0, 0]} label={<StationLabel title={t("interlocked")} />} />
    </>
  );
}
export const PATTERN_TOTAL = 45; // 5 layers; interlock has 9 + 8 alternating, column 9 per layer
