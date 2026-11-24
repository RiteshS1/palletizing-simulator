// The documentation table of contents. Titles live in messages/*.json (docs.pages.<slug>);
// content lives in src/content/docs/<locale>/<slug>.mdx. `scene` picks the live 3D island.
export type SceneKind = "hero" | "plan-ep" | "plan-greedy" | "compare" | "orders" | "frames" | "aabb" | "support";

export type DocGroup = "start" | "robotics" | "engineering" | "algorithms";

export interface DocEntry {
  slug: string;
  group: DocGroup;
  scene: SceneKind;
  simulator?: "greedy" | "extreme-points" | "compare" | "orders";
}

export const DOCS: DocEntry[] = [
  { slug: "overview", group: "start", scene: "hero", simulator: "extreme-points" },
  { slug: "palletizing-simulator", group: "start", scene: "plan-ep", simulator: "extreme-points" },
  { slug: "using-the-simulator", group: "start", scene: "compare", simulator: "compare" },
  { slug: "understanding-robotics", group: "robotics", scene: "frames" },
  { slug: "ros2-and-moveit", group: "robotics", scene: "frames" },
  { slug: "iot-in-the-warehouse", group: "robotics", scene: "orders", simulator: "orders" },
  { slug: "real-world-complexity", group: "robotics", scene: "support" },
  { slug: "why-cpp", group: "engineering", scene: "aabb" },
  { slug: "industry-standards", group: "engineering", scene: "plan-ep" },
  { slug: "webassembly", group: "engineering", scene: "plan-ep", simulator: "extreme-points" },
  { slug: "testing-and-ci", group: "engineering", scene: "plan-greedy" },
  { slug: "architecture", group: "engineering", scene: "frames" },
  { slug: "geometry", group: "algorithms", scene: "aabb" },
  { slug: "stacking-rules", group: "algorithms", scene: "support" },
  { slug: "greedy-layer", group: "algorithms", scene: "plan-greedy", simulator: "greedy" },
  { slug: "extreme-points", group: "algorithms", scene: "plan-ep", simulator: "extreme-points" },
  { slug: "side-by-side", group: "algorithms", scene: "compare", simulator: "compare" },
  { slug: "orders", group: "algorithms", scene: "orders", simulator: "orders" },
  { slug: "complexity", group: "algorithms", scene: "plan-ep" },
];

export const DOC_GROUPS: DocGroup[] = ["start", "robotics", "engineering", "algorithms"];

export function getDoc(slug: string): DocEntry | undefined {
  return DOCS.find((d) => d.slug === slug);
}

export function neighbours(slug: string): { prev?: DocEntry; next?: DocEntry } {
  const i = DOCS.findIndex((d) => d.slug === slug);
  return { prev: i > 0 ? DOCS[i - 1] : undefined, next: i >= 0 && i < DOCS.length - 1 ? DOCS[i + 1] : undefined };
}
