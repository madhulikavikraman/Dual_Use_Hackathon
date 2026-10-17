import "server-only";
import { db, nowIso, uid } from "@/lib/db";
import { TABLES } from "@/lib/db/tables";
import { serverEnv } from "@/lib/env";
import { STATE_LABEL } from "@/lib/directives";
import { jurisdictionForScenario } from "@/lib/jurisdictions";
import { NORTE_SNAPSHOT, liveCalFire, liveNwsAlerts, ptTime } from "./live";
import { buildScenario, modeFor, SCENARIOS } from "@/lib/scenarios";
import type { Scenario, TwistEntry, ZoneEvent } from "@/lib/types";
import { defaultMeta, feed, ledger, setMeta } from "./log";
import { seedPlans } from "./plans";

/** Twist 1 is part of the record; reset never deletes the twist log. */
export const TWIST_ONE: Omit<TwistEntry, "id" | "created_at"> = {
  twist_no: 1,
  title: "Federal funding pathway",
  twist_text:
    "Identify the government funding pathway for your venture. Many startups find their first funding through government agencies like NASA, DHS, USDA, etc. They also find them through different funding programs such as DARPA and NSF project funding platforms. Identify at least one federal funding pathway in the US government whether through an agency, program, or military sector as your primary or alternative funding source to launch your venture.",
  what_changed:
    "Primary: NSF SBIR Phase I (NSF 26-510, up to $305,000, no equity; Project Pitch first; deadlines Nov 4, 2026 and Mar 4, 2027). Alternatives: counties buy with FEMA UASI and EMPG grants (alert and warning systems are on FEMA's Authorized Equipment List); DoD SBIR and the Defense Innovation Unit for installations. Build: /evidence page and GET /api/evidence report the Phase I milestones live from the run; CAP 1.2 export moved up; this twist log.",
  why:
    "A funding pathway is credible when the product already measures what the grant pays for. The October 2025 to April 2026 SBIR lapse is why customer revenue paid from FEMA grants is the second leg.",
  proof: "Run the demo path, open /evidence: the three Phase I milestones fill from the run; download the CSV. PRD section 17.1; decisions D-26 to D-28.",
  commits: ["f3b21f9", "4db9d76"],
};

export const TWIST_TWO: Omit<TwistEntry, "id" | "created_at"> = {
  twist_no: 2,
  title: "Make it global",
  twist_text:
    "Let's make it global. Your solution is good, see how it applies to a global application. How does the same solution hold up in another part of the world? For example, if you are solving for fire-fighters in Los Angeles, how can ones in China implement it?",
  what_changed:
    "Six invariants stay (a named human approves, the edge is asked first, the dose shows and the hold sends on time, verbatim relay with an AI-voice disclosure, a delivery canary, the ledger); six adapters change per country (ladder words, decider, emergency number, public channel and dose source, voice platform and AI model, privacy and maps). Build: jurisdiction profiles for Los Angeles, China, Japan, Greece, India and Australia; a Chongqing scenario on the August 2022 Beibei fire ground with China's ladder (colour warnings are hazard levels; only a relocation order moves people), 119 in every call, grid-worker sentinels and a named helper for an older man living alone; the emergency number became a call variable; WGS-84 to GCJ-02 conversion for Chinese basemaps; /global compares the adapters.",
  why:
    "Every country has its own words for 'leave now', its own emergency number and its own rules on AI and data; what must travel is the safety properties. In mainland China the in-call model is a CAC-filed domestic model behind the same seven tools, since Claude is not offered there.",
  proof:
    "Reset to Chongqing and approve a Warning for Tiansheng: calls carry the Chinese directive and 119. scripts/agent-check-cn.ts: a live Mandarin call opens with the AI disclosure, reads the directive, route and shelter verbatim, confirms 'wheelchair, no car' back and files a P2 help row. PRD 17.2; decisions D-37 to D-41.",
  commits: ["f724ac5"],
};

/** Twists are part of the record; reset never deletes them, and missing ones are re-filed. */
export async function ensureTwists() {
  for (const t of [TWIST_ONE, TWIST_TWO]) {
    const rows = await db().where("twist_log", { twist_no: t.twist_no });
    if (!rows.length) await db().insert("twist_log", { ...t, id: uid(), created_at: nowIso() });
  }
}
export const ensureTwistOne = ensureTwists;

/** Wipe the run (not the twist log) and load a scenario. */
export async function resetScenario(scenario: Scenario) {
  const env = serverEnv();
  const at = nowIso();
  const phones = [env.DEVICE_PHONE_1, env.DEVICE_PHONE_2, env.DEVICE_PHONE_3, env.DEVICE_PHONE_4, env.DEVICE_PHONE_5, env.DEVICE_PHONE_6]
    .map((p) => p ?? null);
  const build = buildScenario(scenario, at, phones);

  for (const t of TABLES) {
    if (t === "twist_log") continue;
    // evac_plans is new (migration 005): a Supabase database without it must still reset.
    if (t === "evac_plans") await db().clear(t).catch((e) => console.error("[reset] evac_plans (run migration 005)", e));
    else await db().clear(t);
  }

  await db().insert("zones", build.zones);
  await db().insert("households", build.households);
  if (build.proposals.length) await db().insert("proposals", build.proposals);
  await setMeta({ ...defaultMeta(), scenario, mode: modeFor(scenario), jurisdiction: jurisdictionForScenario(scenario) });

  const events: ZoneEvent[] = build.zones
    .filter((z) => z.approved_by)
    .map((z) => ({
      id: uid(), zone_id: z.id, from_state: "monitor", to_state: z.state, source: "human", actor: z.approved_by!,
      reason: "Scenario start (seeded)", hold_id: null, created_at: at,
    }));
  if (events.length) await db().insert("zone_events", events);
  for (const e of events) {
    const zone = build.zones.find((z) => z.id === e.zone_id)!;
    await ledger({ actor: e.actor, action: `approve zone: ${STATE_LABEL[e.to_state]}`, target: zone.name, reason: "Scenario start (seeded)" });
  }
  const label = SCENARIOS.find((s) => s.id === scenario)?.label ?? scenario;
  await feed({ kind: "info", title: `Scenario loaded: ${label}`, detail: "All residents are synthetic except the six volunteer phones. Every send is simulated." });
  // Block-by-block plans seeded for the zones already under an Order or a Warning (lib/engine/plans.ts).
  await seedPlans(scenario, at).catch((e) => console.error("[reset] block plans", e));
  if (scenario === "norte") await liveNorteFeed();
  for (const p of build.proposals) {
    const zone = build.zones.find((z) => z.id === p.zone_id)!;
    await feed({ kind: "proposal", severity: "warn", zone_id: p.zone_id, title: `Model proposes ${STATE_LABEL[p.proposed_state]} for ${zone.name}`,
      detail: `${p.reason} Needs a human.` });
  }
  await ensureTwists();
  return {
    scenario,
    zones: build.zones.length,
    households: build.households.length,
    devices: build.households.filter((h) => h.has_device).length,
    proposals: build.proposals.length,
  };
}

/** Norte Fire: put the live CAL FIRE status and NWS alerts at the ignition point in the feed (advisory only). */
async function liveNorteFeed() {
  const [fire, alerts] = await Promise.all([
    liveCalFire(/norte/i).catch(() => null),
    liveNwsAlerts(NORTE_SNAPSHOT.lat, NORTE_SNAPSHOT.lng).catch(() => [] as Awaited<ReturnType<typeof liveNwsAlerts>>),
  ]);
  const f = fire ?? NORTE_SNAPSHOT;
  const size = [
    f.acres !== null ? `${f.acres.toLocaleString()} acres` : null,
    f.contained !== null ? `${f.contained}% contained` : null,
  ].filter(Boolean).join(", ");
  await feed({
    kind: "info", severity: "warn",
    title: `${fire ? "Live" : "Snapshot"}: ${f.name} ${size} (CAL FIRE, updated ${ptTime(f.updated)})`,
    detail: `${f.location}. ${f.agency}. Started ${ptTime(f.started)}. ${f.url} Zone states, routes and residents here are simulated; real orders come from OCFA and the county.`,
  });
  for (const a of alerts.slice(0, 4)) {
    await feed({ kind: "info", severity: "info", title: `NWS at the ignition point: ${a.event}`, detail: a.headline });
  }
}
