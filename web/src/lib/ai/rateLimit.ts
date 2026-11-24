// Sliding-window rate limiter keyed by client IP. In-memory, so it is per server instance:
// good enough to stop casual abuse of the AI keys on a portfolio site. A shared store
// (e.g. Redis) would make it global.
const windows = new Map<string, number[]>();

export function rateLimit(key: string, limits: { perMinute: number; perHour: number }, now = Date.now()): { ok: boolean; retryAfter: number } {
  const hits = (windows.get(key) ?? []).filter((t) => now - t < 3_600_000);
  const lastMinute = hits.filter((t) => now - t < 60_000);
  if (lastMinute.length >= limits.perMinute) return { ok: false, retryAfter: Math.ceil((60_000 - (now - lastMinute[0])) / 1000) };
  if (hits.length >= limits.perHour) return { ok: false, retryAfter: Math.ceil((3_600_000 - (now - hits[0])) / 1000) };
  hits.push(now);
  windows.set(key, hits);
  if (windows.size > 5000) windows.delete(windows.keys().next().value as string); // bound memory
  return { ok: true, retryAfter: 0 };
}
