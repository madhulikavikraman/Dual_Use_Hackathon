import "server-only";
import { db, nowIso, uid } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { SCENARIOS, modeFor } from "@/lib/scenarios";
import type { AlertItem, LedgerEntry, Meta, Mode } from "@/lib/types";

/** Append a ledger line. Every human decision and every refused action lands here (PRD section 9). */
export async function ledger(entry: {
  actor: string;
  action: string;
  allowed?: boolean;
  kind?: LedgerEntry["kind"];
  target?: string | null;
  reason?: string | null;
}): Promise<LedgerEntry> {
  const row: LedgerEntry = {
    id: uid(),
    actor: entry.actor,
    action: entry.action,
    allowed: entry.allowed ?? true,
    kind: entry.kind ?? "decision",
    target: entry.target ?? null,
    reason: entry.reason ?? null,
    created_at: nowIso(),
  };
  await db().insert("ledger", row);
  return row;
}

/** Add a card to the supervisor's feed. */
export async function feed(item: Omit<AlertItem, "id" | "created_at" | "campaign_id" | "zone_id" | "geo" | "detail" | "severity"> &
  Partial<Pick<AlertItem, "campaign_id" | "zone_id" | "geo" | "detail" | "severity">>): Promise<AlertItem> {
  const row: AlertItem = {
    id: uid(),
    campaign_id: item.campaign_id ?? null,
    zone_id: item.zone_id ?? null,
    kind: item.kind,
    severity: item.severity ?? "info",
    title: item.title,
    detail: item.detail ?? null,
    geo: item.geo ?? null,
    created_at: nowIso(),
  };
  await db().insert("alerts_feed", row);
  return row;
}

export function defaultMeta(): Meta {
  const env = serverEnv();
  return {
    id: "meta",
    scenario: "westside",
    mode: "civilian",
    jurisdiction: "US-CA",
    sim_preset: "normal",
    verification_phrase: env.VERIFICATION_PHRASE,
    callback_number: env.CALLBACK_NUMBER,
    cost_minutes: 0,
    cost_usd: 0,
    usgs_event: null,
    autopilot_devices: false,
    wrong_polygon: false,
    updated_at: nowIso(),
  };
}

const MODES: readonly string[] = ["civilian", "heat", "base"] satisfies Mode[];

/**
 * A stored meta row from an older build (mode "campus", scenario "usc": the USC DPS line was removed) must not crash
 * the board: an unknown scenario falls back to westside (and its mode), an unknown mode to the scenario's own mode.
 */
function known(m: Meta): Meta {
  const scenarioOk = SCENARIOS.some((s) => s.id === m.scenario);
  const scenario = scenarioOk ? m.scenario : "westside";
  const mode = scenarioOk && MODES.includes(m.mode) ? m.mode : modeFor(scenario);
  return scenario === m.scenario && mode === m.mode ? m : { ...m, scenario, mode };
}

export async function getMeta(): Promise<Meta> {
  const m = await db().get("meta", "meta");
  return m ? known({ ...defaultMeta(), ...m }) : defaultMeta();
}

export async function setMeta(patch: Partial<Meta>): Promise<Meta> {
  const next = { ...(await getMeta()), ...patch, id: "meta" as const, updated_at: nowIso() };
  await db().upsert("meta", next);
  return next;
}
