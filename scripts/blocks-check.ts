// Block-by-block evacuation check, in-process, against its own data file (no server needed).
// Run: npx tsx --conditions=react-server scripts/blocks-check.ts
// Covers: block sizes for Santa Monica (big patches cut to fit one wave), road capacity in every wave (shared streets
// included), nearest-to-hazard first, the plan's length against the road-capacity floor, the fire model pulling a block
// forward (a system row, never a human decision), Everyone go now (logged), the call words (go now; get ready with its
// own directive, never "leave now" beside "wait"; extra time for people who need it), the hold's dose with wave 1, the
// wave clock with a human hold (and its cap), no hold on the last wave, and the template checks.
import { config } from "dotenv";

config({ path: ".env.local" });
config();
process.env.SECONDKEY_DATA_FILE ??= ".data/blocks-check.json";
process.env.STORAGE = "local";

let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};

async function main() {
  const { db } = await import("../lib/db");
  const { resetScenario } = await import("../lib/engine/reset");
  const { approveZone } = await import("../lib/engine/zones");
  const { decideHold, holdDose } = await import("../lib/engine/holds");
  const { setMeta } = await import("../lib/engine/log");
  const plans = await import("../lib/engine/plans");
  const blocks = await import("../lib/engine/blocks");
  const { LEAVE_IF_UNSAFE } = await import("../lib/directives");
  const { runFireModel } = await import("../lib/engine/fireModel");
  const { CELL_M, capPerWave, waveCount, overloads, lastWaveStartMin, roadFloorH, sharedLoads, sharedRoads } = blocks;

  const capacityOk = (p: Awaited<ReturnType<typeof plans.planFor>>, fromWave = 1) => {
    if (!p) return false;
    return p.waves.filter((w) => w.n >= fromWave).every((w) =>
      Object.entries(w.load).every(([rid, cars]) => cars <= capPerWave(p.routes.find((r) => r.id === rid)!, p.wave_minutes)),
    );
  };
  // Nearest to the hazard first on every road: on each road, a block never goes before a nearer block on that road.
  const nearestFirst = (p: NonNullable<Awaited<ReturnType<typeof plans.planFor>>>, ignore = new Set<string>()) =>
    p.routes.every((r) => {
      const on = p.blocks.filter((b) => b.route_id === r.id && !ignore.has(b.id)).sort((a, b) => a.hazard_m - b.hazard_m || a.id.localeCompare(b.id));
      return on.every((b, i) => i === 0 || b.wave >= on[i - 1].wave);
    }) && p.blocks.every((b) => b.route_id);
  const refused = async (f: () => Promise<unknown>) => {
    try {
      await f();
      return false;
    } catch {
      return true;
    }
  };

  // 1. Seed: Santa Monica runs an approved plan; Venice and Mar Vista stands by.
  await resetScenario("westside");
  await setMeta({ autopilot_devices: true });
  const sm = await plans.planFor("LA-SM");
  check(Boolean(sm && sm.status === "active" && sm.approved_by === plans.SEED_ACTOR), `Santa Monica seeded plan: ${sm?.status}, approved by ${sm?.approved_by}`);
  const cell = (CELL_M * CELL_M) / 1e6;
  const areas = sm!.blocks.map((b) => b.area_km2);
  // Patches start as ~800 m cells clipped to the zone (slivers merged, up to about two cells); a patch with more cars
  // than one wave carries on its roads is cut into 2 to 6 equal patches. Santa Monica (~93,000 people) has many.
  const zoneKm2 = sm!.blocks.reduce((t, b) => t + b.area_km2, 0);
  check(sm!.blocks.length >= 30 && sm!.blocks.length <= 260, `Santa Monica: ${sm!.blocks.length} blocks over ${zoneKm2.toFixed(1)} km² (~800 m cells, big ones cut)`);
  check(Math.max(...areas) <= cell * 2 && Math.min(...areas) > 0, `block sizes ${Math.min(...areas)} to ${Math.max(...areas)} km² (cell ${cell.toFixed(2)} km²; at most about two cells)`);
  const smRoute = (id: string) => sm!.routes.find((r) => r.id === id)!;
  check(sm!.wave_minutes <= 15 && sm!.blocks.every((b) => b.vehicles_est <= capPerWave(smRoute(b.route_id), sm!.wave_minutes)),
    `Santa Monica: waves of ${sm!.wave_minutes} min, and every block fits one wave on its road (largest ${Math.max(...sm!.blocks.map((b) => b.vehicles_est))} cars)`);
  check(sm!.blocks[0].id === "SM-01" && sm!.blocks[0].wave === 1, `SM-01 is nearest the hazard and in wave 1 (${sm!.blocks[0].hazard_m} m from the hazard edge)`);
  const smStatus = new Set(sm!.blocks.map((b) => b.status));
  check(sm!.current_wave > 1 && smStatus.has("left") && smStatus.has("go_now") && (smStatus.has("next") || smStatus.has("ready")),
    `Santa Monica on wave ${sm!.current_wave} of ${waveCount(sm!)}: ${[...smStatus].join(", ")}`);
  check(capacityOk(sm), `Santa Monica: no road over capacity in any of ${waveCount(sm!)} waves of ${sm!.wave_minutes} min`);
  check(nearestFirst(sm!), "Santa Monica: on every road, nearer-to-hazard blocks never go after farther ones");
  const floorMin = roadFloorH(sm!) * 60;
  const clearMin = waveCount(sm!) * sm!.wave_minutes;
  check(lastWaveStartMin(sm!) <= 1.25 * floorMin && clearMin <= 1.3 * floorMin,
    `Santa Monica: last wave starts +${(lastWaveStartMin(sm!) / 60).toFixed(2)} h, clears in ${(clearMin / 60).toFixed(2)} h; road-capacity floor ${(floorMin / 60).toFixed(2)} h (within 1.25x / 1.3x)`);
  const people = sm!.blocks.reduce((t, b) => t + b.people_est, 0);
  check(Math.abs(people - 93_000) < 93_000 * 0.02, `Santa Monica people shared by area add up to the estimate (${people.toLocaleString()} of 93,000)`);
  const vn = await plans.planFor("LA-VN");
  check(Boolean(vn && vn.status === "standby" && vn.blocks.every((b) => b.status === "ready")), `Venice and Mar Vista: ${vn?.blocks.length} blocks, standby, all ready`);
  check(capacityOk(vn) && nearestFirst(vn!), "Venice: capacity and nearest-first hold");
  // Shared streets: Venice's waves were packed with Santa Monica's running cars on Lincoln Blvd and Centinela Ave counted.
  const shared = sharedRoads(vn!, [sm!]).map((s) => s.route.short);
  check(shared.includes("Lincoln Blvd") && shared.includes("Centinela Ave"), `Venice shares ${shared.join(" and ")} with Santa Monica's running plan`);
  const smCars = sharedLoads(vn!.routes, vn!.wave_minutes, Date.parse(vn!.created_at), 1, [sm!], "LA-VN");
  const both = vn!.waves.every((w) => vn!.routes.every((r) => (w.load[r.id] ?? 0) + (smCars.get(w.n)?.[r.id] ?? 0) <= capPerWave(r, vn!.wave_minutes)));
  const smOnShared = [...smCars.values()].reduce((t, l) => t + Object.values(l).reduce((a, b) => a + b, 0), 0);
  check(both && smOnShared > 0, `Venice + Santa Monica cars on each shared street stay within its capacity in every Venice wave (${smOnShared.toLocaleString()} Santa Monica cars counted)`);

  // 2. Culver City: the Order's hold proposes a plan; the dose keeps the zone total and adds wave 1.
  const order = await approveZone("LA-CC", { state: "order", directive_text: "", move_text: "", evac_point: null, approved_by: "Blocks Check", reason: "Envelope reached the edge" });
  const hold = order.hold!;
  const cc = await plans.planFor("LA-CC");
  check(cc?.status === "proposed", `Culver City: hold opened, plan ${cc?.status} (${cc?.blocks.length} blocks, ${cc ? waveCount(cc) : 0} waves of ${cc?.wave_minutes} min, last wave +${cc ? (lastWaveStartMin(cc) / 60).toFixed(2) : "?"} h)`);
  const dose = await holdDose(hold);
  check(dose.total === 41_000 && dose.wave1 !== null && dose.wave1.people > 0 && /Wave 1 now: about [\d,]+ people .* if the block plan is approved/.test(dose.text), `hold dose: "${dose.text}"`);
  const card = (await db().where("alerts_feed", { kind: "hold", zone_id: "LA-CC" }))[0];
  check(Boolean(card?.detail?.includes("Wakes about 41,000") && card.detail.includes("Wave 1 now") && card.detail.includes("if the block plan is approved")), `hold feed card: ${card?.detail?.slice(0, 140)}…`);
  check(capacityOk(cc) && nearestFirst(cc!), "Culver City: capacity and nearest-first hold");

  // 3. A named human approves during the hold (stands by), then Send: wave 1 goes now, later waves get ready.
  const approved = await plans.approvePlan("LA-CC", { approved_by: "Blocks Check", reason: "Exit roads checked" });
  check(approved.status === "standby", `approved during the hold: ${approved.status}`);
  await decideHold(hold.id, { decision: "send", actor: "Blocks Check", reason: "Two sentinels see smoke" });
  const live = (await plans.planFor("LA-CC"))!;
  check(live.status === "active" && live.current_wave === 1, `after Send: ${live.status}, wave ${live.current_wave}`);
  const zoneCC = (await db().get("zones", "LA-CC"))!;
  const camp = (await db().where("campaigns", { zone_id: "LA-CC", kind: "order" }))[0];
  const calls = (await db().where("calls", { campaign_id: camp.id })).sort((a, b) => a.planned_at.localeCompare(b.planned_at) || a.order_index - b.order_index);
  const go = calls.filter((c) => /^Your block, CC-\d+, is in wave 1: leave now by /.test(c.vars.move_text));
  const extra = calls.filter((c) => /People who need extra time to leave should not wait for the wave: leave now by /.test(c.vars.move_text));
  const ready = calls.filter((c) => /Get ready now/.test(c.vars.move_text));
  const routeNames = live.routes.map((r) => r.name);
  const hasRoute = (t: string) => routeNames.some((n) => t.includes(n));
  const wave1 = new Set(live.blocks.filter((b) => b.wave === 1).map((b) => b.id));
  check(go.length > 0 && go.every((c) => [...wave1].some((id) => c.vars.move_text.startsWith(`Your block, ${id}, is in wave 1: leave now by `)) && hasRoute(c.vars.move_text)),
    `wave-1 households hear leave now (${go.length} on the roster in wave 1)${go[0] ? `: "${go[0].vars.move_text}"` : ""}`);
  check(go.every((c) => c.vars.directive_text === zoneCC.directive_text && /leave now/.test(c.vars.directive_text)), `wave 1 hears the zone's Order: "${go[0]?.vars.directive_text}"`);
  check(ready.length > 0 && ready.every((c) => /Your block, CC-\d+, is in wave \d+, planned for about /.test(c.vars.move_text) && hasRoute(c.vars.move_text) && c.vars.move_text.includes(LEAVE_IF_UNSAFE)),
    `get-ready words (${ready.length}): "${ready[0]?.vars.move_text}"`);
  // One call never says "leave now" next to "wait for your wave": a waiting block hears the approved get-ready directive.
  const readyWave = (t: string) => Number(/is in wave (\d+)/.exec(t)?.[1] ?? 0);
  check(ready.every((c) => !/leave now/i.test(c.vars.directive_text) && c.vars.directive_text.includes(LEAVE_IF_UNSAFE) &&
      c.vars.directive_text.includes(`your block leaves in wave ${readyWave(c.vars.move_text)}`) && /Evacuation Order for Culver City and Palms/.test(c.vars.directive_text)),
    `get-ready directive, never "leave now": "${ready[0]?.vars.directive_text}"`);
  const hh = new Map((await db().where("households", { zone_id: "LA-CC" })).map((h) => [h.id, h]));
  const afn = calls.filter((c) => (hh.get(c.household_id ?? "")?.afn_flags.length ?? 0) > 0);
  check(afn.length > 0 && afn.every((c) => !ready.includes(c)) && extra.every((c) => c.vars.directive_text === zoneCC.directive_text && hasRoute(c.vars.move_text)),
    `people who need extra time leave now whatever their wave (${afn.length} with access and functional needs; ${extra.length} in later waves)${extra[0] ? `: "${extra[0].vars.move_text}"` : ""}`);
  check(go.length + extra.length + ready.length === calls.length, `every Order call carries its block's words (${go.length} go now + ${extra.length} extra time + ${ready.length} get ready = ${calls.length})`);
  const lastGo = Math.max(0, ...[...go, ...extra].map((c) => Date.parse(c.planned_at)));
  const firstReady = Math.min(...ready.map((c) => Date.parse(c.planned_at)));
  check(lastGo <= firstReady, "the people going now are called first");
  const readyWaves = ready.map((c) => readyWave(c.vars.move_text));
  check(readyWaves.every((w, i) => i === 0 || w >= readyWaves[i - 1]), "later waves are called in wave order (edge-first inside each wave)");

  // 4. Start the next wave (a person): wave 2 hears leave now; queued get-ready calls take the go-now words and the Order.
  const w2 = await plans.advanceWave("LA-CC", "Blocks Check", "Wave 1 clear on the roads");
  const wave2Blocks = new Set(w2.blocks.filter((b) => b.wave === 2).map((b) => b.id));
  const queued2 = (await db().all("calls")).filter((c) => c.vars.zone_id === "LA-CC" && c.state === "queued" && [...wave2Blocks].some((id) => c.vars.move_text.includes(`block, ${id},`)));
  check(w2.current_wave === 2 && queued2.length > 0 && queued2.every((c) => /^Your block, CC-\d+, is in wave 2: leave now by /.test(c.vars.move_text) && hasRoute(c.vars.move_text) && c.vars.directive_text === zoneCC.directive_text),
    `wave 2 started: ${queued2.length} queued calls now say "${queued2[0]?.vars.move_text}" after the Order`);
  check((await db().all("ledger")).some((l) => l.actor === "Blocks Check" && l.action.startsWith("start wave 2")), "ledger: start wave 2, with a name");

  // 5. Hold the next wave: the clock does not move it (within the cap); release and it does. A forgotten hold ends
  //    one wave length past the wave's start, with a system ledger row and a feed card.
  await plans.holdWave("LA-CC", "Blocks Check", "Crash on Sepulveda");
  const held = (await plans.planFor("LA-CC"))!;
  await db().update("evac_plans", held.id, { wave_started_at: new Date(Date.now() - 1.5 * held.wave_minutes * 60_000).toISOString() });
  await plans.planTick(new Date().toISOString());
  const stillHeld = blocks.refresh((await plans.planFor("LA-CC"))!);
  check(stillHeld.current_wave === 2 && stillHeld.blocks.filter((b) => b.wave === 3).every((b) => b.status === "hold") && stillHeld.blocks.filter((b) => b.wave === 2).every((b) => b.status === "go_now"),
    "held: wave 3 waits (status hold) and wave 2 keeps going, even past the wave clock");
  await plans.holdWave("LA-CC", "Blocks Check", "Road open again", true);
  await plans.planTick(new Date().toISOString());
  check((await plans.planFor("LA-CC"))!.current_wave === 3, "released: the wave clock starts wave 3");
  await plans.holdWave("LA-CC", "Blocks Check", "Fire engines on Overland");
  const held4 = (await plans.planFor("LA-CC"))!;
  await db().update("evac_plans", held4.id, { wave_started_at: new Date(Date.now() - 2.1 * held4.wave_minutes * 60_000).toISOString() });
  await plans.planTick(new Date().toISOString());
  const capped = (await plans.planFor("LA-CC"))!;
  const capRow = (await db().all("ledger")).find((l) => l.action.startsWith("hold ends: wave 4"));
  const capCard = (await db().where("alerts_feed", { zone_id: "LA-CC" })).find((f) => /hold on wave 4 ended by the wave clock/.test(f.title));
  check(capped.current_wave === 4 && !capped.held && capRow?.kind === "system" && Boolean(capCard),
    `hold cap: wave 4 released by the wave clock one wave length past its start (ledger "${capRow?.action}", ${capRow?.kind}; feed card ${capCard ? "shown" : "missing"})`);

  // 6. The fire model pulls a block forward; later waves reflow. Its rows are system rows, never human decisions.
  const before = (await plans.planFor("LA-SM"))!;
  const far = [...before.blocks].filter((b) => b.status === "ready").sort((a, b) => b.hazard_m - a.hazard_m)[0];
  const pulled = await plans.pullBlocksForward("LA-SM", [far.id], "model (toy fire envelope)", "Toy model: spot fire reported near the block");
  const after = (await plans.planFor("LA-SM"))!;
  const moved = after.blocks.find((b) => b.id === far.id)!;
  check(Boolean(pulled?.moved.includes(far.id)) && moved.status === "go_now" && moved.wave === after.current_wave && Boolean(moved.pulled_forward),
    `pull forward: ${far.id} from wave ${far.wave} to go now (wave ${moved.wave})`);
  check(capacityOk(after, after.current_wave + 1) && nearestFirst(after, new Set([far.id])), "after the pull: later waves reflowed, within capacity, nearest first");
  check((await db().all("ledger")).some((l) => l.actor === "model (toy fire envelope)" && l.action.includes(far.id)), "ledger: the model's pull-forward");
  // The model pulls a Culver City block whose resident has no call waiting: new go-now calls start, signed by the model.
  const ccNow = (await plans.planFor("LA-CC"))!;
  const ccHh = (await db().where("households", { zone_id: "LA-CC" })).filter((h) => h.role === "resident");
  const target = ccNow.blocks.find((b) => b.wave > ccNow.current_wave && ccHh.some((h) => blocks.blockAt(ccNow, h.lng, h.lat)?.id === b.id));
  if (target) {
    for (const h of ccHh.filter((x) => blocks.blockAt(ccNow, x.lng, x.lat)?.id === target.id)) {
      await db().updateWhere("calls", { household_id: h.id, state: "queued" }, { state: "no_answer", ended_at: new Date().toISOString() });
    }
    await plans.pullBlocksForward("LA-CC", [target.id], "model (toy fire envelope)", "Toy model: the envelope reached the block");
  }
  const fire = await runFireModel({ wind: "seeded", advanceHours: 1 });
  const modelRows = (await db().all("ledger")).filter((l) => l.actor === "model (toy fire envelope)");
  const firePulls = modelRows.filter((l) => l.action.startsWith("pull block"));
  check(firePulls.length >= 2, `toy fire model run (+1 h): ${firePulls.length - 1} more pull-forward(s) ${firePulls.slice(0, 2).map((l) => l.action.slice(0, 80)).join(" | ")} (${fire.length} proposals)`);
  check(modelRows.length > 0 && modelRows.every((l) => l.kind === "system") && modelRows.some((l) => l.action.startsWith("start go-now calls")),
    `the model's ledger rows (${modelRows.length}, its go-now calls included) are system rows, not human decisions: ${modelRows.map((l) => `${l.kind}: ${l.action.slice(0, 40)}`).join(" | ")}`);
  check(overloads(after).every((o) => o.wave <= after.current_wave), "any road over capacity is only in the wave going now (a pull-forward always wins)");

  // 6b. The last wave has no next wave to hold.
  const cc6 = (await plans.planFor("LA-CC"))!;
  await db().update("evac_plans", cc6.id, { current_wave: waveCount(cc6), wave_started_at: new Date().toISOString() });
  check(await refused(() => plans.holdWave("LA-CC", "Blocks Check", "test")), `on the last wave (${waveCount(cc6)}), Hold next wave is refused`);

  // 7. Everyone go now: one click for the named human, logged; waiting blocks hear leave now.
  await db().update("evac_plans", cc6.id, { current_wave: 4 });
  const all = await plans.everyoneGoNow("LA-CC", "Blocks Check", "Spot fires inside the zone");
  check(all.status === "all_go" && all.blocks.every((b) => b.status === "go_now" || b.status === "left"), `everyone go now: ${all.status}`);
  check((await db().all("ledger")).some((l) => l.actor === "Blocks Check" && l.action.startsWith("everyone go now")), "ledger: everyone go now, with a name and a reason");
  const waiting = (await db().all("calls")).filter((c) => c.vars.zone_id === "LA-CC" && c.state === "queued" && c.purpose === "resident");
  check(waiting.length > 0 && waiting.every((c) => /Everyone in Culver City and Palms leaves now\. Your block, CC-\d+: leave now by /.test(c.vars.move_text) && c.vars.directive_text === zoneCC.directive_text),
    `queued calls now: "${waiting[0]?.vars.move_text}"`);

  // 8. The approved words are checked.
  await resetScenario("westside");
  await approveZone("LA-CC", { state: "order", directive_text: "", move_text: "", evac_point: null, approved_by: "Blocks Check", reason: "test" });
  const tryWords = (templates: Record<string, string>) => refused(() => plans.approvePlan("LA-CC", { approved_by: "Blocks Check", reason: "test", templates }));
  check(await tryWords({ get_ready: "Your block, {block}, is in wave {wave} by {route}. Wait for your wave." }), "a get-ready message without the leave-right-away line is refused");
  check(await tryWords({ get_ready: "Your block, {block}, is in wave {wave} by {route}. Get ready. Leave right away if unsafe." }), "a get-ready message with a reworded leave-right-away line is refused (the exact line is required)");
  check(await tryWords({ go_now: "Your block, {block}: go by {route}." }), "a go-now message without \"leave now\" is refused");
  check(await tryWords({ all_go: "Everyone in {zone} goes. Your block, {block}, by {route}." }), "an everyone-go message without \"leave now\" is refused");
  check(await tryWords({ get_ready_directive: `Evacuation Order for {zone}. Your block is in wave {wave}: leave now. ${LEAVE_IF_UNSAFE}` }), "a get-ready directive that says \"leave now\" is refused");
  check((await plans.planFor("LA-CC"))?.status === "proposed", "after the refusals the plan is still proposed (nothing approved)");

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
