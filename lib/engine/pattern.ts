import "server-only";

// Pattern watch (owned by the data-products lane): reports -> hex clusters -> corroboration -> proposals,
// silence clusters, the hoax mirror. Signatures are fixed; the tick and /api/demo/sim call these.

/** Recompute clusters from recent reports and silences; write proposals and feed cards. Returns changes made. */
export async function runPatternWatch(): Promise<number> {
  return 0;
}

/** Earthquake beat (PRD 12): a seeded USGS-style M5.9 event and ~20 reports in two Mid-City hex cells. */
export async function seedEarthquake(): Promise<void> {}

/** Hoax flood: ~200 inbound-style reports in one zone with zero sentinel reads. */
export async function seedHoaxFlood(): Promise<void> {}
