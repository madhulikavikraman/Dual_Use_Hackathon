// Proof for the live Norte Fire scenario (no AI calls): reset pulls the live CAL FIRE status and NWS alerts into the
// feed, and a Warning for Talega starts edge-first calls with the Cal OES directive and 911.
// Run: npx tsx --conditions=react-server scripts/norte-check.ts   (uses its own data file)
import { config } from "dotenv";

config({ path: ".env.local" });
config();
process.env.SECONDKEY_DATA_FILE ??= ".data/norte-check.json";
process.env.STORAGE = "local";

async function main() {
  const { db } = await import("../lib/db");
  const { resetScenario } = await import("../lib/engine/reset");
  const { approveZone } = await import("../lib/engine/zones");
  const { runTick } = await import("../lib/engine/tick");

  const res = await resetScenario("norte");
  console.log("reset:", JSON.stringify(res));
  const feed = await db().all("alerts_feed");
  for (const f of feed) console.log(`feed: [${f.severity}] ${f.title}`);
  const zones = await db().all("zones");
  console.log("zones:", zones.map((z) => `${z.id}:${z.state}`).join(" "));
  const hh = await db().all("households");
  const unzoned = hh.filter((h) => h.role === "resident" && !h.zone_id).map((h) => h.name);
  console.log(`households: ${hh.length}; residents outside every zone: ${unzoned.length ? unzoned.join(", ") : "none"}`);

  const out = await approveZone("NOR-TA", { state: "warning", approved_by: "Duty officer (check)", reason: "Model envelope reaches the west edge" });
  await runTick();
  const calls = (await db().all("calls")).filter((c) => c.vars?.zone_id === "NOR-TA");
  const c = calls[0];
  console.log(`approve: zone ${out.zone.state}; campaign ${out.campaign?.kind}; ${calls.length} calls; emergency_number ${c?.vars.emergency_number}`);
  console.log(`directive: ${c?.vars.directive_text}`);
  console.log(`route: ${c?.vars.move_text} | shelter: ${c?.vars.evac_point}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
