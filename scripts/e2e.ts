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
  // Collections line: a collector asks for help moving her grab list at Warning; it is P4 and never counts as a person.
  const salvage = (await db().where("help_requests", { household_id: hid(95) })).find((r) => r.kind === "salvage");
  check(Boolean(salvage && salvage.priority === 4), `collections line: salvage request is a P4 row of its own (${salvage?.reason ?? "missing"})`);

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

  // 6. Live location with consent. On autopilot Phone 2 (wheelchair, no car) said yes to the link in Stage 1.
  const { pingShare, stopShare, viewByToken } = await import("../lib/engine/locate");
  const { helperUpdate, helperView, sendHelper } = await import("../lib/engine/responders");
  const { refreshLocation } = await import("../lib/engine/registry");
  const { onRetellCallAnalyzed } = await import("../lib/engine/retellEvents");
  const { HttpError } = await import("../lib/http");
  const statusOfErr = async (p: Promise<unknown>) => {
    try {
      await p;
      return 200;
    } catch (e) {
      return e instanceof HttpError ? e.status : -1;
    }
  };
  const shares2 = await db().where("location_shares", { household_id: hid(2) });
  const share = shares2[0];
  check(Boolean(share?.consent_quote && share.call_id && /^[A-Za-z0-9_-]{32}$/.test(share.token)),
    `consent -> share row: quote "${share?.consent_quote}", call ${share?.call_id?.slice(0, 8)}, ${share?.consent_source}, 192-bit token`);
  check(shares2.length === 1, `asked once: one share for Phone 2 across Stage 1 and Stage 3 (${shares2.length})`);
  await tickFor(20_000, async () => ((await db().get("location_shares", share.id))?.ping_count ?? 0) >= 2);
  const gpsFixes = (await db().where("locations", { household_id: hid(2) })).filter((f) => f.source === "gps_link");
  const row2 = (await db().where("help_requests", { household_id: hid(2) })).find((r) => (r.kind ?? "people") === "people")!;
  check(gpsFixes.length >= 2 && gpsFixes.every((f) => f.consent && f.help_request_id === row2.id), `pings -> ${gpsFixes.length} locations rows, source gps_link, consent true`);
  check(row2.last_source === "gps_link" && row2.last_consent && (row2.last_accuracy_m ?? 99) <= 20,
    `registry row now live GPS (${row2.last_source}, ${row2.last_accuracy_m} m)`);
  await refreshLocation(hid(2), { lat: 34.03, lng: -118.41, accuracy_m: 50, source: "stated", stated_text: "Venice and Sepulveda", consent: true });
  const afterStated = (await db().get("help_requests", row2.id))!;
  check(afterStated.last_source === "gps_link" && afterStated.last_lat === row2.last_lat, `a later stated fix does not override a fresh GPS fix (${afterStated.last_source})`);
  await sleep(2100);
  const fixNow = () => ({ lat: row2.last_lat! + 0.0001, lng: row2.last_lng!, accuracy_m: 7, heading: null, speed: 0, captured_at: new Date().toISOString() });
  const real = await pingShare(share.token, fixNow());
  check(real.status === "live", `a phone's fix on the link is accepted (status ${real.status}, ${real.ping_count} fixes)`);
  check((await statusOfErr(pingShare(share.token, fixNow()))) === 429, "a second fix within 2 s is rate-limited (429)");
  check((await statusOfErr(pingShare(share.token, { ...fixNow(), lat: 123 }))) === 422, "an impossible coordinate is rejected (422)");

  const sentHelper = await sendHelper(row2.id, { helper_id: "qrt-1", actor: "E2E Dispatcher", reason: "Wheelchair, no car: needs the van" });
  const disp = (await db().where("dispatches", { help_request_id: row2.id }))[0];
  const assigned = await db().get("help_requests", row2.id);
  check(assigned?.status === "assigned" && disp?.status === "assigned" && /^[A-Za-z0-9_-]{32}$/.test(disp.token) && sentHelper.dispatch.link.includes(`/helper/${disp.token}`),
    `Send helper -> dispatch "${disp?.helper_label}" assigned, registry row ${assigned?.status}, helper token`);
  const hv = await helperView(disp.token);
  check(hv.location?.source === "gps_link" && (await viewByToken(share.token)).helper_assigned, "helper page sees the live GPS fix; the person's page says a responder has it");
  await helperUpdate(disp.token, { status: "en_route" });
  await helperUpdate(disp.token, { status: "reached", note: "with the family at the door" });
  const shareDone = await db().get("location_shares", share.id);
  const rowDone = await db().get("help_requests", row2.id);
  check(shareDone?.status === "closed" && rowDone?.status === "reached", `helper "Person reached" -> row ${rowDone?.status}, live location stopped (${shareDone?.status})`);
  check((await statusOfErr(pingShare(share.token, fixNow()))) === 410, "a fix to the stopped link is rejected (410)");

  // Retell post-call analysis heard a yes the agent never acted on: one share, never two.
  const c1 = (await db().where("calls", { household_id: hid(1) })).find((c) => c.purpose === "resident" && c.answered_at)!;
  const analyzed = { transcript: null, call_analysis: { custom_analysis_data: { primary_intent: "leaving", live_location_consent: true, live_location_quote: "Sí, mándelo." } } };
  await onRetellCallAnalyzed(c1.id, analyzed);
  await onRetellCallAnalyzed(c1.id, analyzed);
  const s1 = await db().where("location_shares", { household_id: hid(1) });
  check(s1.length === 1 && s1[0].consent_source === "post_call" && s1[0].call_id === c1.id && s1[0].consent_quote === "Sí, mándelo.",
    `post-call consent -> one share (${s1.length}, ${s1[0]?.consent_source})`);
  await stopShare(s1[0].token);
  check((await db().get("location_shares", s1[0].id))?.status === "stopped" && (await statusOfErr(pingShare(s1[0].token, fixNow()))) === 410,
    "Stop sharing on the link -> stopped; later fixes rejected (410)");

  // No exact GPS for a person in the public feed or the CSV export; no name in the live-location feed cards.
  const { helpFeed } = await import("../lib/feeds");
  const { registryCsv } = await import("../lib/csvExport");
  const gpsRows = (await db().all("help_requests")).filter((r) => r.last_source === "gps_link");
  const gpsFeats = helpFeed(await db().all("help_requests"), Date.now()).filter((f) => gpsRows.some((r) => r.id === f.properties.help_id));
  const leaks = gpsFeats.filter((f) => {
    const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
    return gpsRows.some((r) => r.id === f.properties.help_id && Math.abs(lng - r.last_lng!) < 1e-6 && Math.abs(lat - r.last_lat!) < 1e-6);
  });
  check(gpsFeats.length > 0 && leaks.length === 0 && gpsFeats.every((f) => String(f.properties.precision).includes("response team only")),
    `public help feed: ${gpsFeats.length} live-GPS rows, all at the hex cell (${leaks.length} exact)`);
  const csv = await registryCsv();
  check(gpsRows.every((r) => !csv.includes(String(r.last_lat))), "registry CSV carries no exact live-GPS point");
  const liveCards = (await db().all("alerts_feed")).filter((f) => /live location|helper/i.test(f.title));
  const names = (await db().all("households")).map((h) => h.name);
  check(liveCards.length > 0 && liveCards.every((f) => !names.some((n) => `${f.title} ${f.detail ?? ""}`.includes(n))), `live-location feed cards carry no names (${liveCards.length})`);

  const board = await buildBoard();
  check(board.ledger.some((l) => l.action.startsWith("send")), "ledger has the send");
  check(board.ledger.some((l) => l.action.startsWith("live location: consent recorded")) && board.ledger.some((l) => l.action.startsWith("send helper")),
    "ledger has the consent and the helper sent (with a name)");
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
