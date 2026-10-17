import "server-only";
import type { BoardMetrics, BoardSnapshot, CallView, HouseholdView } from "@/lib/contracts";
import { db, nowIso } from "@/lib/db";
import { retellEnabled } from "@/lib/env";
import type { Call, HelpRequest, HouseholdStatus, Status } from "@/lib/types";
import { getMeta } from "./log";

const FINAL: Status[] = ["safe", "leaving", "needs_help", "wont_leave", "unclear", "wrong_number", "unreachable"];
const COST_PER_MIN = 0.1; // estimate, labeled on screen
const newest = <T>(rows: T[], key: (r: T) => string) => [...rows].sort((a, b) => (key(a) < key(b) ? 1 : -1));

function lastLine(call: Call): string | null {
  const msgs = call.messages as { role: string; content: unknown }[];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (typeof m.content === "string" && m.content.trim()) return m.content.slice(0, 160);
    if (Array.isArray(m.content)) {
      const t = (m.content as { type: string; text?: string }[]).filter((b) => b.type === "text" && b.text).map((b) => b.text).join(" ");
      if (t.trim()) return t.slice(0, 160);
    }
  }
  return call.transcript ? call.transcript.split("\n").filter(Boolean).slice(-1)[0]?.slice(0, 160) ?? null : null;
}

export function registrySort(rows: HelpRequest[]): HelpRequest[] {
  const open = (r: HelpRequest) => (r.status === "closed" || r.status === "reached" ? 1 : 0);
  return [...rows].sort((a, b) => open(a) - open(b) || a.priority - b.priority || (a.created_at < b.created_at ? -1 : 1));
}

export async function buildBoard(): Promise<BoardSnapshot> {
  const s = db();
  const [meta, zones, proposals, households, statuses, calls, campaigns, holds, canaries, registry, runs, ledger, feedRows, clusters, reports] =
    await Promise.all([
      getMeta(), s.all("zones"), s.all("proposals"), s.all("households"), s.all("household_status"), s.all("calls"),
      s.all("campaigns"), s.all("holds"), s.all("canaries"), s.all("help_requests"), s.all("pickup_runs"), s.all("ledger"),
      s.all("alerts_feed"), s.all("clusters"), s.all("reports"),
    ]);

  const latestStatus = new Map<string, HouseholdStatus>();
  for (const st of statuses) {
    const prev = latestStatus.get(st.household_id);
    if (!prev || prev.updated_at < st.updated_at) latestStatus.set(st.household_id, st);
  }
  const latestCall = new Map<string, Call>();
  for (const c of calls) {
    if (!c.household_id) continue;
    const prev = latestCall.get(c.household_id);
    if (!prev || prev.created_at < c.created_at) latestCall.set(c.household_id, c);
  }

  const views: HouseholdView[] = households.map((h) => {
    const st = latestStatus.get(h.id);
    const c = latestCall.get(h.id);
    return {
      ...h,
      status: st?.status ?? "pending",
      status_at: st?.updated_at ?? null,
      via: st?.via ?? null,
      understood: st?.understood ?? null,
      destination: st?.destination ?? null,
      needs: st?.needs ?? [],
      human_requested: st?.human_requested ?? false,
      call_state: c?.state ?? null,
      call_id: c?.id ?? null,
      ring_index: c?.ring_index ?? null,
    };
  });

  const byId = new Map(households.map((h) => [h.id, h]));
  const callViews: CallView[] = newest(calls, (c) => c.created_at).slice(0, 80).map((c) => {
    const h = c.household_id ? byId.get(c.household_id) : undefined;
    return {
      id: c.id, household_id: c.household_id, household_name: h?.name ?? null, device_label: h?.device_label ?? null,
      purpose: c.purpose, state: c.state, transport: c.transport, language: c.vars.language, zone_id: c.vars.zone_id,
      campaign_id: c.campaign_id, hold_id: c.hold_id, attempt: c.attempt, simulated: c.simulated,
      started_at: c.started_at, answered_at: c.answered_at, ended_at: c.ended_at, summary: c.summary, last_line: lastLine(c),
    };
  });

  const residentsCalled = new Set(calls.filter((c) => c.purpose === "resident" || c.purpose === "linked_contact").map((c) => c.subject_household_id ?? c.household_id));
  const reachedIds = new Set(
    calls.filter((c) => c.answered_at && (c.purpose === "resident" || c.purpose === "linked_contact")).map((c) => c.subject_household_id ?? c.household_id),
  );
  const reachedViews = views.filter((v) => reachedIds.has(v.id) && v.role === "resident");
  const understoodKnown = reachedViews.filter((v) => v.understood !== null);
  // Volunteer phones only: public-line callers are not part of the demo roster.
  const volunteer = (v: HouseholdView) => v.has_device && v.device_label !== "Public line";
  const devices = views.filter((v) => volunteer(v) && v.role === "resident");
  // Accounted for = a final answer in any campaign (a later wave re-queues people without erasing what they said).
  const everFinal = new Set(statuses.filter((st) => FINAL.includes(st.status)).map((st) => st.household_id));
  const metrics: BoardMetrics = {
    real_phones: views.filter(volunteer).length,
    real_accounted: devices.filter((v) => everFinal.has(v.id)).length,
    reached: reachedIds.size,
    in_campaigns: residentsCalled.size,
    understood_pct: understoodKnown.length ? Math.round((100 * understoodKnown.filter((v) => v.understood).length) / understoodKnown.length) : null,
    needs_help_open: registry.filter((r) => (r.kind ?? "people") === "people" && r.status !== "closed" && r.status !== "reached").length,
    calls_active: calls.filter((c) => c.state === "ringing" || c.state === "active").length,
    calls_queued: calls.filter((c) => c.state === "queued").length,
    refusals: ledger.filter((l) => !l.allowed || l.kind === "refusal").length,
    // Seeded approvals ("Duty officer (seed)") and the demo autoplay ("Autoplay supervisor (simulated)") are not people.
    human_decisions: ledger.filter(
      (l) => l.kind === "decision" && !["system", "agent", "timer"].includes(l.actor) && !l.actor.includes("(seed)") && !l.actor.includes("(simulated)"),
    ).length,
    // Estimated as if every connected minute ran on Retell (~$0.10/min all-in); real Retell minutes add to meta.
    ...(() => {
      const minutes = calls.reduce((m, c) => (c.answered_at ? m + (Date.parse(c.ended_at ?? nowIso()) - Date.parse(c.answered_at)) / 60_000 : m), 0);
      return { cost_minutes: +minutes.toFixed(1), cost_usd: +(minutes * COST_PER_MIN).toFixed(2) };
    })(),
  };

  return {
    now: nowIso(),
    backend: s.backend,
    retell: retellEnabled(),
    meta,
    zones,
    proposals: newest(proposals, (p) => p.created_at),
    households: views,
    calls: callViews,
    campaigns: newest(campaigns, (c) => c.created_at).slice(0, 20),
    holds: [...holds.filter((h) => h.status === "open"), ...newest(holds.filter((h) => h.status !== "open"), (h) => h.started_at).slice(0, 5)],
    canaries: newest(canaries, (c) => c.created_at).slice(0, 10),
    registry: registrySort(registry),
    runs: newest(runs, (r) => r.created_at),
    ledger: newest(ledger, (l) => l.created_at).slice(0, 150),
    feed: newest(feedRows, (f) => f.created_at).slice(0, 50),
    clusters,
    reports: newest(reports, (r) => r.created_at).slice(0, 200),
    metrics,
  };
}
