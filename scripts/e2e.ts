// End-to-end check of the demo path, in-process, against its own data file (the dev server is untouched).
// Run: npx tsx --conditions=react-server scripts/e2e.ts
// The simulator answers for every phone (autopilot), so no volunteers or API calls are needed.
import { config } from "dotenv";

config({ path: ".env.local" });
config();
process.env.SECONDKEY_DATA_FILE ??= ".data/e2e.json";
process.env.STORAGE = "local";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};
const since = (t0: number) => `${((Date.now() - t0) / 1000).toFixed(0)} s`;

async function main() {
  const { db } = await import("../lib/db");
  const { resetScenario } = await import("../lib/engine/reset");
  const { runTick } = await import("../lib/engine/tick");
  const { approveZone } = await import("../lib/engine/zones");
  const { decideHold } = await import("../lib/engine/holds");
  const { setMeta } = await import("../lib/engine/log");
  const { towerDown } = await import("../lib/engine/sim");
  const { buildBoard } = await import("../lib/engine/board");
  const { hid } = await import("../lib/scenarios/common");

  const tickFor = async (ms: number, until?: () => Promise<boolean>) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      await runTick();
      if (until && (await until())) return true;
      await sleep(1000);
    }
    return false;
  };
  const statusOf = async (id: string) => {
    const rows = (await db().where("household_status", { household_id: id })).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    return rows[0];
  };

  // 1. Reset and approve Culver City to Near-Crisis (Stage 1, edge-first).
  await resetScenario("westside");
  await setMeta({ autopilot_devices: true });
  let t0 = Date.now();
  const res = await approveZone("LA-CC", {
    state: "warning", directive_text: "", move_text: "", evac_point: "Westchester Recreation Center, 7000 West Manchester Avenue",
    approved_by: "E2E Supervisor", reason: "Model envelope reaches the north-west edge",
  });
  check(res.campaign?.kind === "warning", "approve Warning starts Stage 1");
  const rang = await tickFor(60_000, async () => (await db().where("calls", { campaign_id: res.campaign!.id })).some((c) => c.started_at));
  check(rang, `zone approved to first ring under 60 s (${since(t0)})`);
  const first = (await db().where("calls", { campaign_id: res.campaign!.id })).sort((a, b) => a.order_index - b.order_index).slice(0, 6);
  check(first.every((c, i, a) => i === 0 || c.ring_index >= a[i - 1].ring_index), `edge-first order: rings ${first.map((c) => c.ring_index).join(",")}`);

  // 2. Let Stage 1 play out (Walter Hale needs a retry and then his linked contact, Phone 1).
  await tickFor(150_000, async () => (await statusOf(hid(7)))?.via === "linked_contact");
  const janet = (await db().where("help_requests", { household_id: hid(2) }))[0];
  check(Boolean(janet && janet.priority === 2), `Phone 2 (wheelchair, no car) is a priority-2 registry row (${janet?.reason ?? "missing"})`);
  const p1 = (await db().all("help_requests")).filter((r) => r.priority === 1);
  check(p1.length >= 1, `life-safety caller surfaced at priority 1 (${p1.map((r) => r.name).join(", ")})`);
  const hale = await statusOf(hid(7));
  check(hale?.via === "linked_contact" && hale.status === "leaving", `Walter Hale accounted for via linked contact (${hale?.status}/${hale?.via}) at ${since(t0)}`);
  const lucia = await statusOf(hid(1));
  check(lucia?.status === "leaving", `Phone 1 (Spanish) recorded leaving (${lucia?.status})`);

  // 3. Order with the wrong (countywide) polygon: the hold, the dose, the Long Beach "no", Edit polygon.
  await setMeta({ wrong_polygon: true });
  t0 = Date.now();
  const order = await approveZone("LA-CC", { state: "order", directive_text: "", move_text: "", evac_point: null, approved_by: "E2E Duty Officer", reason: "Envelope reached the edge" });
  const holdId = order.hold!.id;
  check(order.hold?.polygon_label.startsWith("Countywide") === true && order.hold.population_est > 9_000_000, `hold opens on the wrong polygon: wakes ${order.hold?.population_est.toLocaleString()}`);
  check(order.hold!.sentinels.some((s) => s.household_id === hid(5)), "the judge's Long Beach phone is one of the sentinels");
  await tickFor(60_000, async () => ((await db().get("holds", holdId))?.tally.no ?? 0) >= 1);
  const h1 = (await db().get("holds", holdId))!;
  check(h1.tally.no >= 1, `Long Beach says "nothing here": tally ${JSON.stringify(h1.tally)} at ${since(t0)}`);
  const edited = await decideHold(holdId, { decision: "edit", actor: "E2E Duty Officer", reason: "Long Beach sees nothing: wrong polygon" });
  check(edited.polygon_label === "Culver City and Palms" && edited.population_est === 41_000, `Edit polygon: wakes ${edited.population_est.toLocaleString()} across ${edited.area_sq_mi} sq mi`);
  const quorum = await tickFor(70_000, async () => (await db().get("holds", holdId))?.read === "confirmed");
  check(quorum, `quorum read "confirmed" at ${since(t0)} (target under 90 s)`);
  const sent = await decideHold(holdId, { decision: "send", actor: "E2E Duty Officer", reason: "Two edge sentinels see smoke to the west" });
  check(sent.status === "sent", "Send (simulated)");
  const zone = await db().get("zones", "LA-CC");
  check(zone?.state === "order", `zone is now ${zone?.state}`);

  // 4. Canary 15 s after the send; Stage 3 relay.
  t0 = Date.now();
  await tickFor(60_000, async () => (await db().where("canaries", { hold_id: holdId })).some((c) => c.result !== "pending"));
  const canaries = await db().where("canaries", { hold_id: holdId });
  check(canaries.some((c) => c.result === "no" && c.flag === "clear"), `canary clear: ${canaries.map((c) => `${c.result}/${c.flag}`).join(", ")} at ${since(t0)}`);
  const stage3 = (await db().where("campaigns", { zone_id: "LA-CC", kind: "order" }))[0];
  check(Boolean(stage3), "Stage 3 order relay started");

  // 5. Tower down: the Palms block goes silent; pattern watch should see the silence cluster.
  const n = await towerDown();
  await tickFor(8000, async () => (await db().all("clusters")).some((c) => c.kind === "silence"));
  const silence = (await db().all("clusters")).filter((c) => c.kind === "silence");
  check(n >= 8, `tower down silenced ${n} households`);
  check(silence.length > 0, `silence cluster detected (${silence.map((c) => c.count).join(",") || "none"})`);

  const board = await buildBoard();
  check(board.ledger.some((l) => l.action.startsWith("send")), "ledger has the send");
  console.log("\nLedger (newest first):");
  for (const l of board.ledger.slice(0, 18)) console.log(`  ${l.created_at.slice(11, 19)}  ${l.actor} | ${l.action} | ${l.target ?? ""} | ${l.reason ?? ""}`);
  console.log(`\nMetrics: ${JSON.stringify(board.metrics)}`);
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
