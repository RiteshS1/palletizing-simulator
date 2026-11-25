"use client";

// One pallet station: the wooden pallet, the cartons of a plan, the vacuum gripper, floor tape and
// teaching overlays (center of mass, extreme points, support polygon).
//
// Frames: the planner works in the PALLET frame (mm, z up). Instead of converting every coordinate,
// the `frame` group below IS that frame: scaled mm -> m and rotated -90° about x, so the planner's
// numbers are used unchanged inside it. A scene graph's parent transform applies to all children.
import { Html, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { PlaybackSource } from "@/lib/player";
import { supportPolygon, type PalletSpec, type Placement } from "@/lib/plan";
import { Burst, type BurstHandle } from "./effects";
import { cardboardTexture, labelTexture, woodTexture } from "./textures";

const MM = 0.001;
const PALLET_H = 144; // mm, wooden pallet under the deck
const DROP = 420; // mm the box travels while being lowered
const PROBE = "#2b59c3";
const SIGNAL = "#ff5a1f";
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export interface StationItem extends Placement {
  color: string;
}

export interface Overlays {
  com?: boolean;
  candidates?: boolean;
  support?: boolean;
}

interface Props {
  pallet: PalletSpec;
  items: StationItem[];
  source: PlaybackSource;
  position?: [number, number, number];
  overlays?: Overlays;
  label?: ReactNode;
  wrappedAfterStep?: number; // orders view: show stretch wrap once the pallet has shipped
  interactive?: boolean; // hover a carton to lift it and see its details
  formatTip?: (item: StationItem) => ReactNode;
}

export function PalletStation({ pallet, items, source, position = [0, 0, 0], overlays = {}, label, wrappedAfterStep, interactive, formatTip }: Props) {
  const L = pallet.length;
  const W = pallet.width;
  return (
    <group position={position}>
      <FloorTape L={L} W={W} />
      <group rotation={[-Math.PI / 2, 0, 0]} scale={MM} position={[(-L / 2) * MM, PALLET_H * MM, (W / 2) * MM]}>
        <WoodPallet L={L} W={W} />
        <Cartons items={items} source={source} overlays={overlays} interactive={interactive} formatTip={formatTip} pallet={pallet} wrappedAfterStep={wrappedAfterStep} />
      </group>
      {label && (
        <Html position={[0, 0.02, (W / 2) * MM + 0.42]} center transform={false} zIndexRange={[20, 0]} className="pointer-events-none">
          {label}
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------- pallet + floor
function WoodPallet({ L, W }: { L: number; W: number }) {
  const tex = useMemo(() => {
    const t = woodTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(1, 1);
    return t;
  }, []);
  const boards = useMemo(() => {
    const b: { p: [number, number, number]; s: [number, number, number]; dark?: boolean }[] = [];
    const n = 7, bw = 125, gap = (W - n * bw) / (n - 1);
    for (let i = 0; i < n; i++) b.push({ p: [L / 2, i * (bw + gap) + bw / 2, -11], s: [L, bw, 22] });
    for (const x of [50, L / 2, L - 50]) b.push({ p: [x, W / 2, -33], s: [100, W, 22], dark: true });
    for (const x of [72, L / 2, L - 72]) for (const y of [50, W / 2, W - 50]) b.push({ p: [x, y, -83], s: [145, 100, 78], dark: true });
    for (const y of [50, W / 2, W - 50]) b.push({ p: [L / 2, y, -133], s: [L, 100, 22] });
    return b;
  }, [L, W]);
  return (
    <group>
      {boards.map((b, i) => (
        <RoundedBox key={i} args={b.s} radius={3} smoothness={2} position={b.p} castShadow receiveShadow>
          <meshStandardMaterial map={tex} color={b.dark ? "#b4956a" : "#e2c79c"} roughness={0.92} />
        </RoundedBox>
      ))}
    </group>
  );
}

function FloorTape({ L, W }: { L: number; W: number }) {
  const m = 0.2, t = 0.05;
  const w = L * MM + 2 * m, d = W * MM + 2 * m;
  const strips: [number, number, number, number][] = [
    [w, t, 0, -d / 2],
    [w, t, 0, d / 2],
    [t, d, -w / 2, 0],
    [t, d, w / 2, 0],
  ];
  return (
    <group>
      {strips.map(([sx, sz, x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.002, z]} receiveShadow>
          <planeGeometry args={[sx, sz]} />
          <meshStandardMaterial color={SIGNAL} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- cartons
function Cartons({
  items,
  source,
  overlays,
  interactive,
  formatTip,
  pallet,
  wrappedAfterStep,
}: {
  items: StationItem[];
  source: PlaybackSource;
  overlays: Overlays;
  interactive?: boolean;
  formatTip?: (item: StationItem) => ReactNode;
  pallet: PalletSpec;
  wrappedAfterStep?: number;
}) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const outline = useRef<THREE.LineSegments>(null);
  const gripper = useRef<THREE.Group>(null);
  const plate = useRef<THREE.Mesh>(null);
  const wrap = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ step: number; moving: boolean }>({ step: 0, moving: false });
  const dust = useRef<BurstHandle>(null);
  const landed = useRef(-1); // last step that already puffed its dust
  const hoverLift = useRef<number[]>(items.map(() => 0));

  const cardboard = useMemo(() => cardboardTexture(), []);
  const label = useMemo(() => labelTexture(), []);
  const unitEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), []);

  useFrame((_, dt) => {
    const { step, t } = source.read();
    // `as` keeps the declared type: TypeScript doesn't track assignments made inside callbacks.
    let active = null as StationItem | null;
    let last = null as StationItem | null;
    let height = 0;
    items.forEach((it, i) => {
      const g = refs.current[i];
      if (!g) return;
      const lift = (hoverLift.current[i] += ((hovered === i ? 60 : 0) - hoverLift.current[i]) * Math.min(1, dt * 10));
      const restZ = it.z + it.sz / 2;
      if (it.step < step) {
        g.visible = true;
        g.position.z = restZ + lift;
        height = Math.max(height, it.z + it.sz);
        if (it.step === step - 1) last = it;
      } else if (it.step === step && t > 0) {
        g.visible = true;
        g.position.z = restZ + (t < 0.7 ? 1 - easeOut(t / 0.7) : 0) * DROP;
        active = it;
      } else {
        g.visible = false;
      }
    });

    // Touch-down: when the lowering phase ends (t = 0.7) the carton meets its support: puff of dust.
    if (active && t >= 0.7 && landed.current !== active.step) {
      landed.current = active.step;
      dust.current?.emit(active.x + active.sx / 2, active.y + active.sy / 2, active.z, { n: 46, ring: [active.sx, active.sy], spread: 230, up: 170 });
    }
    if (!active && step === 0) landed.current = -1;

    const focusItem: StationItem | null = active ?? last;
    const o = outline.current;
    if (o) {
      o.visible = !!focusItem;
      if (focusItem) {
        const gi = items.indexOf(focusItem);
        const g = refs.current[gi];
        o.position.set(focusItem.x + focusItem.sx / 2, focusItem.y + focusItem.sy / 2, g ? g.position.z : focusItem.z + focusItem.sz / 2);
        o.scale.set(focusItem.sx + 6, focusItem.sy + 6, focusItem.sz + 6);
      }
    }

    const gr = gripper.current;
    if (gr) {
      gr.visible = !!active;
      if (active) {
        const a = active as StationItem;
        const g = refs.current[items.indexOf(a)];
        const lift = t < 0.7 ? 0 : ((t - 0.7) / 0.3) * 320;
        gr.position.set(a.x + a.sx / 2, a.y + a.sy / 2, (g ? g.position.z : a.z) + a.sz / 2 + lift);
        plate.current?.scale.set(Math.min(a.sx * 0.72, 420), Math.min(a.sy * 0.72, 320), 1);
      }
    }

    if (wrap.current) {
      const shipped = wrappedAfterStep !== undefined && wrappedAfterStep >= 0 && step >= wrappedAfterStep && height > 0;
      wrap.current.visible = shipped;
      if (shipped) {
        wrap.current.scale.set(pallet.length + 18, pallet.width + 18, height + 40);
        wrap.current.position.set(pallet.length / 2, pallet.width / 2, (height + 40) / 2 - 30);
      }
    }

    const f = { step: focusItem ? focusItem.step : -1, moving: !!active };
    if (f.step !== focus.step || f.moving !== focus.moving) setFocus(f);
  });

  const focusItem = items.find((it) => it.step === focus.step) ?? null;

  return (
    <group>
      {items.map((it, i) => {
        const along = it.sx >= it.sy;
        return (
          <group
            key={`${it.step}-${it.id}`}
            ref={(g) => {
              refs.current[i] = g;
            }}
            position={[it.x + it.sx / 2, it.y + it.sy / 2, it.z + it.sz / 2]}
            visible={false}
            onPointerOver={interactive ? (e) => (e.stopPropagation(), setHovered(i)) : undefined}
            onPointerOut={interactive ? () => setHovered((h) => (h === i ? null : h)) : undefined}
          >
            <RoundedBox args={[it.sx - 2, it.sy - 2, it.sz - 2]} radius={9} smoothness={3} castShadow receiveShadow>
              <meshStandardMaterial map={cardboard} color={it.color} roughness={0.86} metalness={0} />
            </RoundedBox>
            {/* packing tape along the lid, folded over the two ends */}
            <mesh position={[0, 0, it.sz / 2]} castShadow>
              <boxGeometry args={[along ? it.sx + 2 : 56, along ? 56 : it.sy + 2, 1.5]} />
              <meshStandardMaterial color="#dcc59b" roughness={0.32} metalness={0.05} transparent opacity={0.92} />
            </mesh>
            {/* shipping label on the +x face */}
            {it.sz >= 180 && it.sy >= 220 && (
              <mesh position={[it.sx / 2 + 0.6, 0, -it.sz * 0.08]} rotation={[Math.PI / 2, Math.PI / 2, 0]}>
                <planeGeometry args={[Math.min(170, it.sy * 0.55), Math.min(106, it.sz * 0.42)]} />
                <meshStandardMaterial map={label} roughness={0.7} />
              </mesh>
            )}
            {interactive && hovered === i && formatTip && (
              <Html position={[0, 0, it.sz / 2 + 80]} center zIndexRange={[30, 0]} className="pointer-events-none">
                {formatTip(it)}
              </Html>
            )}
          </group>
        );
      })}

      <lineSegments ref={outline} geometry={unitEdges} visible={false}>
        <lineBasicMaterial color={SIGNAL} linewidth={2} />
      </lineSegments>

      <VacuumGripper groupRef={gripper} plateRef={plate} />
      <Burst handle={dust} size={0.09} />

      <mesh ref={wrap} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial color="#f4f8fb" transparent opacity={0.34} roughness={0.15} transmission={0} clearcoat={1} depthWrite={false} />
      </mesh>

      {overlays.com && <CenterOfMass items={items} source={source} pallet={pallet} />}
      {overlays.candidates && focusItem?.candidates && <CandidatePoints item={focusItem} />}
      {overlays.support && focusItem && <SupportOverlay items={items} target={focusItem} />}
    </group>
  );
}

// ---------------------------------------------------------------- gripper
function VacuumGripper({ groupRef, plateRef }: { groupRef: React.RefObject<THREE.Group | null>; plateRef: React.RefObject<THREE.Mesh | null> }) {
  const cups: [number, number][] = [
    [-0.32, -0.32],
    [0.32, -0.32],
    [-0.32, 0.32],
    [0.32, 0.32],
  ];
  return (
    <group ref={groupRef} visible={false}>
      {/* suction plate, scaled to the box footprint each frame */}
      <mesh ref={plateRef} position={[0, 0, 34]} castShadow>
        <boxGeometry args={[1, 1, 24]} />
        <meshStandardMaterial color="#2a2c30" roughness={0.45} metalness={0.6} />
      </mesh>
      {cups.map(([cx, cy], i) => (
        <mesh key={i} position={[cx * 260, cy * 200, 12]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[34, 42, 24, 24]} />
          <meshStandardMaterial color="#1b1c1f" roughness={0.8} />
        </mesh>
      ))}
      {/* wrist + mast in the robot's signal orange */}
      <mesh position={[0, 0, 90]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[70, 70, 90, 32]} />
        <meshStandardMaterial color={SIGNAL} roughness={0.35} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0, 900]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[46, 46, 1500, 32]} />
        <meshStandardMaterial color={SIGNAL} roughness={0.35} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0, 150]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[52, 52, 18, 32]} />
        <meshStandardMaterial color="#d9d9d4" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* vacuum hose */}
      <mesh position={[0, 0, 0]}>
        <tubeGeometry args={[new THREE.CatmullRomCurve3([new THREE.Vector3(60, 0, 60), new THREE.Vector3(150, 40, 260), new THREE.Vector3(80, 60, 700)]), 32, 11, 10, false]} />
        <meshStandardMaterial color="#1f2023" roughness={0.6} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- overlays
function CenterOfMass({ items, source, pallet }: { items: StationItem[]; source: PlaybackSource; pallet: PalletSpec }) {
  const ball = useRef<THREE.Mesh>(null);
  const line = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const { step } = source.read();
    let w = 0, x = 0, y = 0, z = 0;
    for (const it of items) {
      if (it.step >= step) continue;
      w += it.weight;
      x += it.weight * (it.x + it.sx / 2);
      y += it.weight * (it.y + it.sy / 2);
      z += it.weight * (it.z + it.sz / 2);
    }
    const show = w > 0;
    if (ball.current && line.current) {
      ball.current.visible = line.current.visible = show;
      if (show) {
        ball.current.position.set(x / w, y / w, z / w);
        line.current.position.set(x / w, y / w, z / w / 2);
        line.current.scale.set(1, z / w, 1);
      }
    }
  });
  return (
    <group>
      <mesh ref={ball} renderOrder={10}>
        <sphereGeometry args={[34, 24, 16]} />
        <meshBasicMaterial color={PROBE} depthTest={false} transparent opacity={0.95} />
      </mesh>
      <mesh ref={line} rotation={[Math.PI / 2, 0, 0]} renderOrder={10}>
        <cylinderGeometry args={[5, 5, 1, 8]} />
        <meshBasicMaterial color={PROBE} depthTest={false} transparent opacity={0.8} />
      </mesh>
      <mesh position={[pallet.length / 2, pallet.width / 2, 2]}>
        <ringGeometry args={[40, 54, 40]} />
        <meshBasicMaterial color={PROBE} />
      </mesh>
    </group>
  );
}

function CandidatePoints({ item }: { item: StationItem }) {
  const pts = item.candidates ?? [];
  return (
    <group>
      {pts.map(([x, y, z], i) => {
        const chosen = x === item.x && y === item.y && z === item.z;
        return (
          <mesh key={i} position={[x, y, z + 4]} renderOrder={11}>
            <sphereGeometry args={[chosen ? 30 : 18, 16, 12]} />
            <meshBasicMaterial color={chosen ? SIGNAL : PROBE} depthTest={false} transparent opacity={chosen ? 1 : 0.85} />
          </mesh>
        );
      })}
    </group>
  );
}

function SupportOverlay({ items, target }: { items: StationItem[]; target: StationItem }) {
  const shape = useMemo(() => {
    const { hull } = supportPolygon(items, target);
    if (hull.length < 3) return null;
    const s = new THREE.Shape();
    hull.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
    s.closePath();
    return s;
  }, [items, target]);
  if (!shape) return null;
  return (
    <group position={[0, 0, target.z + 3]}>
      <mesh renderOrder={9}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={PROBE} transparent opacity={0.28} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[target.x + target.sx / 2, target.y + target.sy / 2, 1]} renderOrder={10}>
        <circleGeometry args={[22, 24]} />
        <meshBasicMaterial color={SIGNAL} depthTest={false} />
      </mesh>
    </group>
  );
}
