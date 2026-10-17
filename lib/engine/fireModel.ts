import "server-only";
import type { Proposal } from "@/lib/types";

// Toy fire-spread envelope (owned by the data-products lane): seeded perimeter + NWS hourly wind
// (live with a seeded fallback) -> 1 h / 3 h / 6 h ellipses -> proposals for intersecting zones.

export async function runFireModel(opts: { advanceHours?: number } = {}): Promise<Proposal[]> {
  void opts;
  return [];
}
