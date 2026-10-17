// A small in-process sliding-window limiter for the open, token-keyed routes (/api/locate, /api/helper).
// One server process holds the demo; on several instances each keeps its own window, which is fine as a guard.
const g = globalThis as unknown as { __vfRate?: Map<string, number[]> };
const hits = (g.__vfRate ??= new Map<string, number[]>());

/** True when `key` has made more than `max` requests in the last `windowMs`. */
export function overLimit(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 2000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return recent.length > max;
}
