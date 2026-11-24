// Shared by server pages and client components. (A value exported from a "use client" file is only
// a reference proxy on the server, so constants like this must live in a plain module.)
export type SimMode = "greedy" | "extreme-points" | "compare" | "orders";
export const SIM_MODES: SimMode[] = ["greedy", "extreme-points", "compare", "orders"];
