// Heat check-in line, end to end, in-process, against its own data file (the dev server is untouched).
// Run: npx tsx --conditions=react-server scripts/heat-check.ts
// The network is switched OFF for the run (fetch throws), so reset must fall back to the labeled demo heat wave.
// The simulator answers for every phone (autopilot): no volunteers or API calls are needed. A final, non-fatal step
// turns the network back on and prints the live Open-Meteo and NWS readings, if they can be reached.
import { config } from "dotenv";

config({ path: ".env.local" });
config();
process.env.SECONDKEY_DATA_FILE ??= ".data/heat-check.json";
process.env.STORAGE = "local";

const realFetch = globalThis.fetch;
let networkOff = true;
globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
  if (networkOff) throw new TypeError("fetch failed (network off for this check)");
  return realFetch(...args);
}) as typeof fetch;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};

async function main() {
  const { db } = await import("../lib/db");
  const { resetScenario } = await import("../lib/engine/reset");
  const { runTick } = await import("../lib/engine/tick");
  const { decideProposal } = await import("../lib/engine/zones");
  const { decideHold } = await import("../lib/engine/holds");
  const { getMeta, setMeta } = await import("../lib/engine/log");
  const { buildRuns } = await import("../lib/engine/registry");
  const { sendHelper } = await import("../lib/engine/responders");
  const { runHeatCheck } = await import("../lib/engine/weather");
  const { HEAT_SAY } = await import("../lib/engine/sim");
  const { heatRisk } = await import("../lib/engine/campaigns");
  const { hid } = await import("../lib/scenarios/common");
  const { SIMULATED_HEAT } = await import("../lib/scenarios/heat");
  const { heatLevelFor } = await import("../lib/scenarios/heatLadder");
  const { zoneDefaults } = await import("../lib/scenarios");
  const { renderPrompt, retellPromptTemplate } = await import("../lib/agent/prompt");

  const tickFor = async (ms: number, until: () => Promise<boolean>) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      await runTick();
      if (await until()) return true;
      await sleep(1000);
    }
    return false;
  };
  const byName = async (name: string) => (await db().where("households", { scenario: "heat" })).find((h) => h.name === name)!;
  const helpOf = async (id: string) => (await db().where("help_requests", { household_id: id })).find((r) => (r.kind ?? "people") === "people");

  // 0. The threshold table (a demo setting).
  check(heatLevelFor(89) === "monitor" && heatLevelFor(90) === "watch" && heatLevelFor(100) === "warning" && heatLevelFor(108) === "order",
    "threshold table: 89 monitor, 90 watch, 100 Heat Advisory, 108 Extreme Heat Warning");

  // 1. Reset with the network off: the labeled demo heat wave, quickly.
  const t0 = Date.now();
  const res = await resetScenario("heat");
  const ms = Date.now() - t0;
  const meta = await getMeta();
  check(res.zones === 6 && res.devices === 6 && meta.mode === "heat", `reset heat: ${res.zones} zones, ${res.households} people, ${res.devices} devices, mode ${meta.mode}`);
  check(ms < 5000, `reset with the network off took ${ms} ms (no waiting on the network)`);
  const zones = (await db().all("zones")).filter((z) => z.scenario === "heat");
  check(zones.every((z) => z.weather?.basis === "simulated" && z.weather.live === null && z.weather.simulated && !z.weather.nws_checked),
    "every zone falls back to the demo heat wave; no live reading, NWS not reached (nothing assumed)");
  check(zones.every((z) => /network off/.test(z.weather?.live_error ?? "")), `the live error is kept on the zone (${zones[0].weather?.live_error})`);
  const feedRows = await db().all("alerts_feed");
  check(feedRows.some((f) => /Live weather unavailable/.test(f.title) && /demo heat wave/i.test(f.title) && !/simulated/i.test(f.title)), "feed says live weather is unavailable and the demo heat wave is in use");
  const seniors = (await db().where("households", { scenario: "heat" })).filter((h) => h.role === "resident" && h.heat_profile);
  const langs = new Set(seniors.map((h) => h.language));
  check(["Spanish", "Armenian", "Tagalog", "Korean"].every((l) => langs.has(l)), `roster languages include Spanish, Armenian, Tagalog, Korean (${[...langs].join(", ")})`);

  // 2. Proposals come from the thresholds (a model proposes; nobody has approved anything yet).
  const open = (await db().where("proposals", { status: "open" })).filter((p) => p.model === "heat_threshold");
  let fromTable = true;
  for (const z of zones) {
    const expected = heatLevelFor(SIMULATED_HEAT[z.id].feels_like_high_f);
    const p = open.find((x) => x.zone_id === z.id);
    if (expected === "monitor" ? Boolean(p) : p?.proposed_state !== expected) fromTable = false;
  }
  check(fromTable && open.length === 5, `proposals match the table: ${open.map((p) => `${p.zone_id} ${p.proposed_state}`).join(", ")} (North Hollywood below the thresholds: none)`);
  check(open.every((p) => /DEMO heat wave/.test(p.reason) && /Demo table/.test(p.reason) && !/simulated/i.test(p.reason)), `proposal reasons say DEMO heat wave and name the demo table ("${open[0]?.reason}")`);
  check(zones.every((z) => z.state === "monitor"), "no zone moved without a human");
  const rs = zones.find((z) => z.id === "SFV-RS")!;
  const d = zoneDefaults(rs, "warning", "heat");
  check(/heat check for Reseda/.test(d.directive_text) && /In the demo heat wave/.test(d.directive_text) && !/simulated/i.test(d.directive_text) && /103 degrees/.test(d.directive_text) && /Call 211/.test(d.directive_text),
    `approved-message default: "${d.directive_text}"`);
  const { heatDirective } = await import("../lib/directives");
  const ehw = heatDirective("order", "Woodland Hills", { ...zones.find((z) => z.id === "SFV-WH")!.weather!, nws: [{ event: "Extreme Heat Warning", headline: null, expires: null }], nws_checked: true });
  check(/has issued an Extreme Heat Warning for this area/.test(ehw), `"an" before a vowel: "${ehw.match(/The National Weather Service[^.]*\./)?.[0]}"`);
  check(/cooling center \(demo\)/.test(d.move_text) && /ride/.test(d.move_text), `route text offers a ride to a demo cooling center: "${d.move_text}"`);

  // 3. The prompt (both transports) and the simulator's lines.
  const rendered = renderPrompt({ mode: "heat", emergency_number: "911", purpose: "resident" });
  check(/# Heat mode/.test(rendered) && /Hang up and call 911 now/.test(rendered) && /dizziness/.test(rendered) && /confusion/.test(rendered) && /Can you stay cool right now\?/.test(rendered),
    "prompt: heat script, CDC heat-stroke signs, 911 line, the two questions");
  check(retellPromptTemplate().includes("{{mode}}"), "Retell template carries {{mode}} (the same heat section on the phone network)");
  const codes = ["en-US", "es-US", "ko-KR", "zh-CN", "hi-IN", "fr-FR", "hy-AM", "fil-PH"];
  check(codes.every((c) => HEAT_SAY[c] && Object.values(HEAT_SAY[c]).every((s) => s.trim().length > 1) && Object.keys(HEAT_SAY[c]).length === 9),
    `simulator heat lines in all ${codes.length} languages`);

  // 4. A named human approves Reseda's Heat Advisory: every registered senior is called, live-alone / no-AC first.
  await setMeta({ autopilot_devices: true });
  const pRS = open.find((p) => p.zone_id === "SFV-RS")!;
  const approved = await decideProposal(pRS.id, { decision: "approve", actor: "Heat Supervisor (test)", reason: "Feels like 103 today; seniors without AC" });
  const campaign = approved.result?.campaign;
  check(campaign?.kind === "warning" && campaign.mode === "heat", `approve Heat Advisory starts calls (${campaign?.kind}, mode ${campaign?.mode})`);
  const calls = (await db().where("calls", { campaign_id: campaign!.id })).sort((a, b) => a.order_index - b.order_index);
  const hh = new Map((await db().where("households", { scenario: "heat" })).map((h) => [h.id, h]));
  const risk = calls.map((c) => heatRisk(hh.get(c.household_id!)!));
  const firstSafe = risk.indexOf(false);
  check(firstSafe > 0 && risk.slice(firstSafe).every((r) => !r) && calls[0].planned_at <= calls[calls.length - 1].planned_at,
    `call order: ${risk.filter(Boolean).length} who live alone or lack AC first, then ${risk.filter((r) => !r).length} others`);
  check(calls.every((c) => c.vars.mode === "heat" && /heat check for Reseda/.test(c.vars.directive_text)), "every call carries the approved heat message and mode heat");

  // 5. Woodland Hills: Extreme Heat Warning through the 90 s hold (dose, sentinels), sent by a named human.
  const pWH = open.find((p) => p.zone_id === "SFV-WH")!;
  const wh = await decideProposal(pWH.id, { decision: "approve", actor: "Heat Duty Officer (test)", reason: "Feels like 110: extreme heat" });
  const hold = wh.result?.hold;
  check(Boolean(hold && /extreme heat alert for Woodland Hills/.test(hold.alert_text) && hold.population_est === 30_000),
    `Extreme Heat Warning opens the hold: wakes ${hold?.population_est.toLocaleString()}; "${hold?.alert_text.slice(0, 70)}..."`);
  const confirmed = await tickFor(60_000, async () => (await db().get("holds", hold!.id))?.read === "confirmed");
  check(confirmed, `edge sentinels confirm the heat (read ${(await db().get("holds", hold!.id))?.read})`);
  await decideHold(hold!.id, { decision: "send", actor: "Heat Duty Officer (test)", reason: "Two sentinels confirm" });
  const whZone = await db().get("zones", "SFV-WH");
  const orderCampaign = (await db().where("campaigns", { zone_id: "SFV-WH", kind: "order" }))[0];
  check(whZone?.state === "order" && Boolean(orderCampaign), "sent: Woodland Hills at Extreme Heat Warning; calls to everyone started");

  // 6. Let both play out.
  const harold = hid(2);
  const rosario = await byName("Rosario Santos");
  const gloria = await byName("Gloria Washington");
  const carmen = await byName("Carmen Morales");
  const ruth = await byName("Ruth Klein");
  // Canoga Park (Heat Advisory): Armen Petrosyan lives alone with no air conditioning, has no linked contact and no
  // access and functional needs, and does not answer. Below Extreme Heat, he must still become a door knock.
  const armen = await byName("Armen Petrosyan");
  const pCP = open.find((p) => p.zone_id === "SFV-CP")!;
  await decideProposal(pCP.id, { decision: "approve", actor: "Heat Supervisor (test)", reason: "Feels like 105 today" });
  const done = async () => {
    const [h2, r1, g3, c3, k3] = await Promise.all([helpOf(harold), helpOf(rosario.id), helpOf(gloria.id), helpOf(carmen.id), helpOf(ruth.id)]);
    return Boolean(h2 && r1 && g3 && c3 && k3 && (await helpOf(armen.id)) && (await db().where("location_shares", { household_id: harold })).length);
  };
  const t1 = Date.now();
  await tickFor(240_000, done);
  console.log(`      (calls played out in ${((Date.now() - t1) / 1000).toFixed(0)} s)`);

  const row2 = await helpOf(harold);
  check(row2?.priority === 2 && /Needs help leaving/.test(row2.reason ?? "") && row2.needs.includes("no_car"), `needs a ride: Phone 2 is registry P2 (${row2?.reason})`);
  const rowR = await helpOf(rosario.id);
  const rosarioCall = (await db().where("calls", { household_id: rosario.id })).find((c) => c.answered_at);
  check(rowR?.priority === 1 && /Hang up and call 911 now/.test(rosarioCall?.transcript ?? ""), `unwell (Tagalog, heat-stroke signs): "hang up and call 911 now" and P1 (${rowR?.reason})`);
  const rowG = await helpOf(gloria.id);
  check(rowG?.priority === 3 && /^Check-in visit/.test(rowG.reason ?? "") && !/distress|Call back/.test(rowG.reason ?? ""), `wants a check-in visit: P3, reads as a check-in visit (${rowG?.reason})`);
  const kim = await byName("Kim Young-ja");
  const kimSt = (await db().where("household_status", { household_id: kim.id }))[0];
  check(kimSt?.status === "leaving" && /cooling center/.test(kimSt.destination ?? ""), `Korean speaker going to a cooling center (${kimSt?.status}, ${kimSt?.destination})`);
  const ledger = await db().all("ledger");
  check(ledger.some((l) => l.kind === "refusal" && /when the ride will arrive/.test(l.action)), "Phone 2 asked when the ride comes: refused and logged (never an ETA)");

  // No answer twice from someone who lives alone: the linked contact, then a door-knock card.
  for (const [who, contactId, where] of [[carmen, hid(1), "Reseda, Heat Advisory"], [ruth, hid(60), "Woodland Hills, Extreme Heat Warning"]] as const) {
    const theirs = await db().where("calls", { household_id: who.id });
    const twice = theirs.filter((c) => c.purpose === "resident" && c.state === "no_answer").length;
    const contactCall = (await db().all("calls")).find((c) => c.purpose === "linked_contact" && c.subject_household_id === who.id && c.household_id === contactId);
    const row = await helpOf(who.id);
    check(twice >= 2 && Boolean(contactCall) && row?.priority === 3 && /door knock/.test(row.reason ?? ""),
      `${who.name} (${where}): no answer ${twice}x -> linked contact called -> door-knock card P3 (${row?.reason})`);
  }
  {
    const twice = (await db().where("calls", { household_id: armen.id })).filter((c) => c.purpose === "resident" && c.state === "no_answer").length;
    const row = await helpOf(armen.id);
    const cp = await db().get("zones", "SFV-CP");
    check(!armen.linked_contact_household_id && !armen.afn_flags.length && cp?.state === "warning" && twice >= 2 && row?.priority === 3 &&
      /door-knock/.test(row.reason ?? "") && /lives alone/.test(row.reason ?? ""),
      `${armen.name} (Canoga Park, Heat Advisory; lives alone, no AC, no contact, no AFN): no answer ${twice}x -> door-knock card P3 (${row?.reason})`);
  }

  // 7. Pickup run and the helper sent to the exact spot (a wellness visit is a helper), with live location.
  const runs = await buildRuns("Heat Dispatcher (test)", "rides to cooling centers");
  const onRun = (await db().get("help_requests", row2!.id))?.run_id;
  check(Boolean(onRun) && runs.length >= 1, `pickup runs: ${runs.map((r) => r.label).join("; ")}; Phone 2 is on one`);
  const share = (await db().where("location_shares", { household_id: harold }))[0];
  check(Boolean(share?.consent_quote), `live location: Phone 2 said "${share?.consent_quote}" (${share?.consent_source})`);
  const sent = await sendHelper(rowG!.id, { helper_id: "well-rs", actor: "Heat Dispatcher (test)", reason: "Check-in visit with water" });
  const disp = (await db().where("dispatches", { help_request_id: rowG!.id }))[0];
  check(disp?.status === "assigned" && disp.helper_label.startsWith("Wellness volunteers") && sent.dispatch.link.includes("/helper/"),
    `Send helper: "${disp?.helper_label}" assigned to Gloria's check-in visit`);

  // 8. Live weather (non-fatal): the network back on.
  networkOff = false;
  try {
    const live = await runHeatCheck({ actor: "heat-check (live)" });
    if (live.check.live_ok) {
      const ws = [...live.check.weather.entries()];
      check(ws.every(([, w]) => w.live && Number.isFinite(w.live.temp_f) && w.live.observed_local.length > 0), `live Open-Meteo reading at every zone (basis ${live.check.basis})`);
      for (const [id, w] of ws) {
        console.log(`      ${id}: live feels like ${w.live?.feels_like_f}°F (air ${w.live?.temp_f}°F) at ${w.live?.observed_local}; NWS ${w.nws_checked ? w.nws.map((a) => a.event).join(", ") || "none" : "not reached"}; used ${w.feels_like_high_f}°F (${w.basis})`);
      }
    } else {
      console.log(`SKIP  live weather unreachable from here (${live.check.live_error}); the fallback above is what runs`);
    }
  } catch (e) {
    console.log(`SKIP  live weather check failed: ${e instanceof Error ? e.message : e}`);
  }

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll heat checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
