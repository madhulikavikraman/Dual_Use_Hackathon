import "server-only";
import { db, nowIso, uid } from "@/lib/db";
import { TABLES } from "@/lib/db/tables";
import { serverEnv } from "@/lib/env";
import { STATE_LABEL } from "@/lib/directives";
import { buildScenario, modeFor, SCENARIOS } from "@/lib/scenarios";
import type { Scenario, TwistEntry, ZoneEvent } from "@/lib/types";
import { defaultMeta, feed, ledger, setMeta } from "./log";

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
  commits: ["f3b21f9"],
};

export async function ensureTwistOne() {
  const rows = await db().where("twist_log", { twist_no: 1 });
  if (!rows.length) await db().insert("twist_log", { ...TWIST_ONE, id: uid(), created_at: nowIso() });
}

/** Wipe the run (not the twist log) and load a scenario. */
export async function resetScenario(scenario: Scenario) {
  const env = serverEnv();
  const at = nowIso();
  const phones = [env.DEVICE_PHONE_1, env.DEVICE_PHONE_2, env.DEVICE_PHONE_3, env.DEVICE_PHONE_4, env.DEVICE_PHONE_5, env.DEVICE_PHONE_6]
    .map((p) => p ?? null);
  const build = buildScenario(scenario, at, phones);

  for (const t of TABLES) if (t !== "twist_log") await db().clear(t);

  await db().insert("zones", build.zones);
  await db().insert("households", build.households);
  if (build.proposals.length) await db().insert("proposals", build.proposals);
  await setMeta({ ...defaultMeta(), scenario, mode: modeFor(scenario) });

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
  for (const p of build.proposals) {
    const zone = build.zones.find((z) => z.id === p.zone_id)!;
    await feed({ kind: "proposal", severity: "warn", zone_id: p.zone_id, title: `Model proposes ${STATE_LABEL[p.proposed_state]} for ${zone.name}`,
      detail: `${p.reason} Needs a human.` });
  }
  await ensureTwistOne();
  return {
    scenario,
    zones: build.zones.length,
    households: build.households.length,
    devices: build.households.filter((h) => h.has_device).length,
    proposals: build.proposals.length,
  };
}
