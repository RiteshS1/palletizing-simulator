// Types for the JSON the C++ engine writes (core/src/plan_io.cpp, core/src/api.cpp) plus small
// helpers the viewer needs. Units: millimetres and kilograms in the pallet frame (z up).

export type Vec3Tuple = [number, number, number];

export interface PoseJson {
  position: Vec3Tuple; // metres, robot base frame
  orientation: [number, number, number, number]; // quaternion x, y, z, w
}

export interface PalletSpec {
  length: number;
  width: number;
  maxHeight: number;
  maxLoad: number;
}

export interface Placement {
  step: number;
  id: number;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  weight: number;
  rotated: boolean;
  placePose?: PoseJson;
  approachPose?: PoseJson;
  candidates?: Vec3Tuple[]; // extreme points considered before this placement
  orderId?: number;
  time?: number;
}

export interface PlanMetrics {
  offered: number;
  placed: number;
  placedVolume: number;
  density: number;
  fillOfMax: number;
  height: number;
  totalWeight: number;
  comOffset: number;
  comHeight: number;
  runtimeMs: number;
}

export interface Plan {
  algorithm: "greedy_layer" | "extreme_points";
  seed: number;
  pallet: PalletSpec;
  boxes: { id: number; w: number; d: number; h: number; weight: number }[];
  placements: Placement[];
  unplaced: number[];
  metrics: PlanMetrics;
}

export interface WesOrder {
  id: number;
  destination: string;
  priority: number;
  release: number;
  deadline: number;
  boxes: number;
  processed: number;
  pallet: number;
  start: number;
  finish: number;
  late: boolean;
  firstStep: number;
  lastStep: number;
  status: "done" | "rejected";
}

export interface WesPallet {
  id: number;
  destination: string;
  closedAfterStep: number;
  closeReason: string;
  placements: Placement[];
  metrics: { placed: number; fillOfMax: number; height: number; totalWeight: number; comOffset: number };
}

export interface WesPlan {
  kind: "wes";
  seed: number;
  pallet: PalletSpec;
  config: { policy: string; cycleTimeS: number; waveVolume: number; stations: number };
  orders: WesOrder[];
  pallets: WesPallet[];
  metrics: {
    orders: number;
    rejected: number;
    pallets: number;
    boxes: number;
    avgFill: number;
    lateOrders: number;
    makespanS: number;
    boxesPerHour: number;
    runtimeMs: number;
  };
}

export const ALGO_KEY = { greedy_layer: "greedy", extreme_points: "ep" } as const;

// ---------- colour ----------
const KRAFT_LIGHT = [0xe6, 0xcb, 0xa2];
const KRAFT_DARK = [0x8f, 0x5e, 0x30];

// Heavier = darker cardboard, so weight is readable as material.
export function kraft(weight: number, min: number, max: number): string {
  const t = max > min ? (weight - min) / (max - min) : 0.5;
  const c = KRAFT_LIGHT.map((l, i) => Math.round(l + (KRAFT_DARK[i] - l) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export const ORDER_COLORS = ["#3f6fb0", "#a25b8f", "#3d8f6c", "#c26a3f", "#6266b5", "#8a9440", "#3a8ca3", "#b04f71"];
export const orderColor = (orderId: number) => ORDER_COLORS[orderId % ORDER_COLORS.length];

// ---------- live statistics after `step` placements ----------
export interface LiveStats {
  placed: number;
  weight: number;
  height: number;
  com: { x: number; y: number; z: number } | null;
  comOffset: number;
}

export function liveStats(placements: Placement[], step: number, pallet: PalletSpec): LiveStats {
  let weight = 0, wx = 0, wy = 0, wz = 0, placed = 0, height = 0;
  for (const p of placements) {
    if (p.step >= step) continue;
    placed++;
    weight += p.weight;
    wx += p.weight * (p.x + p.sx / 2);
    wy += p.weight * (p.y + p.sy / 2);
    wz += p.weight * (p.z + p.sz / 2);
    height = Math.max(height, p.z + p.sz);
  }
  const com = weight > 0 ? { x: wx / weight, y: wy / weight, z: wz / weight } : null;
  return {
    placed,
    weight,
    height,
    com,
    comOffset: com ? Math.hypot(com.x - pallet.length / 2, com.y - pallet.width / 2) : 0,
  };
}

// ---------- support polygon (same maths as core/src/stability.cpp) ----------
type P2 = [number, number];
const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

// Andrew's monotone chain, O(k log k). Returns the hull counter-clockwise.
export function convexHull(points: P2[]): P2[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const lower: P2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: P2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// Contact areas under placement `target` (boxes whose top is exactly at its bottom, or the deck),
// and their convex hull: the support polygon.
export function supportPolygon(placements: Placement[], target: Placement): { contacts: [P2, P2][]; hull: P2[] } {
  const contacts: [P2, P2][] = [];
  const x0 = target.x, x1 = target.x + target.sx, y0 = target.y, y1 = target.y + target.sy;
  if (target.z === 0) {
    contacts.push([[x0, y0], [x1, y1]]);
  } else {
    for (const p of placements) {
      if (p === target || p.z + p.sz !== target.z) continue;
      const cx0 = Math.max(x0, p.x), cx1 = Math.min(x1, p.x + p.sx);
      const cy0 = Math.max(y0, p.y), cy1 = Math.min(y1, p.y + p.sy);
      if (cx1 > cx0 && cy1 > cy0) contacts.push([[cx0, cy0], [cx1, cy1]]);
    }
  }
  const corners: P2[] = contacts.flatMap(([a, b]) => [a, [b[0], a[1]], b, [a[0], b[1]]] as P2[]);
  return { contacts, hull: convexHull(corners) };
}

export function formatClock(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}
