import "server-only";
import { db, isoIn, nowIso, uid } from "@/lib/db";
import { centroidOf, metersBetween } from "@/lib/geo";
import type { HelpRequest, HelpSource, Household, LocationFix, LocationSource, Need, PickupRun, Zone } from "@/lib/types";
import { buildVars, newCall } from "./campaigns";
import { feed, getMeta, ledger } from "./log";

// The help registry (PRD 11): one row per person who needs a person, with the need and the last place we
// heard from them. Visible to the response team only; feeds strip names and phones.

const RANK: Record<LocationSource, number> = { centroid: 0, enrolled: 1, stated: 2, gps_link: 3 };
const STALE_MS = 15 * 60_000;

export interface Fix {
  lat: number;
  lng: number;
  accuracy_m: number | null;
  source: LocationSource;
  stated_text: string | null;
  consent: boolean;
}

/** Record a location fix in the history table. */
export async function recordFix(householdId: string | null, helpId: string | null, fix: Fix): Promise<LocationFix> {
  const row: LocationFix = {
    id: uid(), household_id: householdId, help_request_id: helpId, lat: fix.lat, lng: fix.lng,
    accuracy_m: fix.accuracy_m, source: fix.source, stated_text: fix.stated_text, consent: fix.consent, observed_at: nowIso(),
  };
  await db().insert("locations", row);
  return row;
}

/** Fallback fix when nothing was stated: the enrolled address, else the zone centroid (low precision). */
export function enrolledFix(h: Household | null, zone: Zone | null): Fix | null {
  if (h) return { lat: h.lat, lng: h.lng, accuracy_m: 30, source: "enrolled", stated_text: null, consent: true };
  if (zone) {
    const [lng, lat] = centroidOf(zone.geom);
    return { lat, lng, accuracy_m: 1500, source: "centroid", stated_text: null, consent: false };
  }
  return null;
}

function better(row: HelpRequest, fix: Fix): boolean {
  if (row.last_lat === null) return true;
  if (RANK[fix.source] >= RANK[row.last_source]) return true;
  return Date.now() - Date.parse(row.last_observed_at) > STALE_MS; // a fresh lower-precision fix beats a stale one
}

/** Create or update the open registry row for a person (merge needs, keep the highest priority). */
export async function upsertHelp(input: {
  household: Household | null;
  zone_id: string | null;
  priority: 1 | 2 | 3;
  needs?: Need[];
  people?: number | null;
  device_battery_hours?: number | null;
  animals?: string | null;
  reason: string;
  source: HelpSource;
  fix?: Fix | null;
}): Promise<HelpRequest> {
  const h = input.household;
  const now = nowIso();
  const existing = h
    ? (await db().where("help_requests", { household_id: h.id })).find((r) => r.status !== "closed")
    : undefined;
  const fix = input.fix ?? null;
  if (existing) {
    const patch: Partial<HelpRequest> = {
      priority: Math.min(existing.priority, input.priority) as 1 | 2 | 3,
      needs: [...new Set([...existing.needs, ...(input.needs ?? [])])],
      people: input.people ?? existing.people,
      device_battery_hours: input.device_battery_hours ?? existing.device_battery_hours,
      animals: input.animals ?? existing.animals,
      reason: input.priority <= existing.priority ? input.reason : existing.reason,
      updated_at: now,
    };
    if (fix && better(existing, fix)) {
      Object.assign(patch, {
        last_lat: fix.lat, last_lng: fix.lng, last_accuracy_m: fix.accuracy_m, last_source: fix.source,
        last_stated_text: fix.stated_text, last_consent: fix.consent, last_observed_at: now,
      });
    }
    const row = (await db().update("help_requests", existing.id, patch))!;
    if (fix) await recordFix(h?.id ?? null, row.id, fix);
    if (input.priority === 1 && existing.priority !== 1) await announce(row);
    return row;
  }
  const f = fix ?? enrolledFix(h, null);
  const row: HelpRequest = {
    id: uid(),
    household_id: h?.id ?? null,
    phone: h?.phone_e164 ?? (h?.has_device ? h.device_label : null),
    name: h?.name ?? null,
    language: h?.language ?? null,
    zone_id: input.zone_id,
    priority: input.priority,
    needs: input.needs ?? [],
    device_battery_hours: input.device_battery_hours ?? null,
    animals: input.animals ?? null,
    people: input.people ?? null,
    reason: input.reason,
    status: "open",
    assigned_to: null,
    run_id: null,
    source: input.source,
    last_lat: f?.lat ?? null,
    last_lng: f?.lng ?? null,
    last_accuracy_m: f?.accuracy_m ?? null,
    last_source: f?.source ?? "centroid",
    last_stated_text: f?.stated_text ?? null,
    last_consent: f?.consent ?? false,
    last_observed_at: now,
    synthetic: h?.synthetic ?? true,
    created_at: now,
    updated_at: now,
  };
  await db().insert("help_requests", row);
  if (f) await recordFix(h?.id ?? null, row.id, f);
  if (row.priority === 1) await announce(row);
  else await feed({ kind: "needs_help", severity: "warn", zone_id: row.zone_id, title: `Needs help: ${row.name ?? "caller"}`, detail: row.reason });
  return row;
}

async function announce(row: HelpRequest) {
  await feed({
    kind: "needs_help", severity: "critical", zone_id: row.zone_id,
    title: `Life safety: ${row.name ?? "caller"} (${row.people ?? "?"} people)`,
    detail: `${row.reason}. Told to hang up and call 911. Last seen: ${row.last_stated_text ?? row.last_source}.`,
  });
}

/** Refresh the last-seen location of a person's open registry row, if any. */
export async function refreshLocation(householdId: string, fix: Fix) {
  const row = (await db().where("help_requests", { household_id: householdId })).find((r) => r.status !== "closed");
  if (!row || !better(row, fix)) {
    await recordFix(householdId, row?.id ?? null, fix);
    return;
  }
  await db().update("help_requests", row.id, {
    last_lat: fix.lat, last_lng: fix.lng, last_accuracy_m: fix.accuracy_m, last_source: fix.source,
    last_stated_text: fix.stated_text, last_consent: fix.consent, last_observed_at: nowIso(), updated_at: nowIso(),
  });
  await recordFix(householdId, row.id, fix);
}

export async function patchHelp(id: string, body: { status?: HelpRequest["status"]; assigned_to?: string | null; actor: string; reason?: string }) {
  const row = await db().get("help_requests", id);
  if (!row) return null;
  const patch: Partial<HelpRequest> = { updated_at: nowIso() };
  if (body.status) patch.status = body.status;
  if (body.assigned_to !== undefined) {
    patch.assigned_to = body.assigned_to;
    if (body.assigned_to && row.status === "open" && !body.status) patch.status = "assigned";
  }
  const next = await db().update("help_requests", id, patch);
  await ledger({
    actor: body.actor,
    action: body.status ? `registry: ${body.status}` : `registry: assign to ${body.assigned_to ?? "nobody"}`,
    target: row.name ?? row.id.slice(0, 8),
    reason: body.reason ?? null,
  });
  return next;
}

const HEAVY: Need[] = ["wheelchair", "oxygen", "bedbound", "powered_medical_device"];

/**
 * Pickup runs (PRD 11): wheelchair, oxygen, bedbound and powered-device needs always go to accessible vans;
 * order by device battery hours, then distance; nearest-neighbor route; four stops per vehicle.
 */
export async function buildRuns(actor: string): Promise<PickupRun[]> {
  const open = (await db().all("help_requests")).filter((r) => (r.status === "open" || r.status === "assigned") && !r.run_id && r.last_lat !== null && r.priority <= 2);
  if (!open.length) return [];
  const runs: PickupRun[] = [];
  const groups: { vehicle: PickupRun["vehicle"]; rows: HelpRequest[] }[] = [
    { vehicle: "accessible_van", rows: open.filter((r) => r.needs.some((n) => HEAVY.includes(n))) },
    { vehicle: "car", rows: open.filter((r) => !r.needs.some((n) => HEAVY.includes(n))) },
  ];
  let vanN = 0;
  let carN = 0;
  for (const g of groups) {
    const pending = [...g.rows].sort((a, b) => (a.device_battery_hours ?? 99) - (b.device_battery_hours ?? 99) || a.priority - b.priority);
    while (pending.length) {
      const stops: HelpRequest[] = [pending.shift()!];
      while (stops.length < 4 && pending.length) {
        const last = stops[stops.length - 1];
        let best = 0;
        let bestD = Infinity;
        pending.forEach((r, i) => {
          const d = metersBetween([last.last_lng!, last.last_lat!], [r.last_lng!, r.last_lat!]);
          if (d < bestD) { bestD = d; best = i; }
        });
        stops.push(pending.splice(best, 1)[0]);
      }
      const letter = String.fromCharCode(65 + (g.vehicle === "accessible_van" ? vanN++ : carN++));
      const run: PickupRun = {
        id: uid(),
        label: `${g.vehicle === "accessible_van" ? "Accessible van" : "Car"} ${letter}: ${stops.length} stop${stops.length > 1 ? "s" : ""}`,
        vehicle: g.vehicle,
        stops: stops.map((s) => s.id),
        status: "planned",
        created_at: nowIso(),
      };
      runs.push(run);
      await db().insert("pickup_runs", run);
      for (const s of stops) {
        await db().update("help_requests", s.id, { run_id: run.id, assigned_to: run.label, status: "assigned", updated_at: nowIso() });
      }
    }
  }
  await ledger({ actor, action: `build pickup runs (${runs.length})`, target: runs.map((r) => r.label).join("; "), reason: "registry priority 1-2" });
  return runs;
}

/** Response-team callback: a call to the person on the registry row, logged. */
export async function callback(id: string, actor: string) {
  const row = await db().get("help_requests", id);
  if (!row || !row.household_id) return null;
  const h = await db().get("households", row.household_id);
  if (!h) return null;
  const zone = row.zone_id ? await db().get("zones", row.zone_id) : null;
  const meta = await getMeta();
  const campaign = (await db().where("campaigns", { zone_id: row.zone_id ?? undefined, status: "running" }))[0] ?? null;
  const call = newCall({
    campaign_id: campaign?.id ?? null,
    household: h,
    purpose: "qrt_callback",
    vars: buildVars({ zone, household: h, purpose: "qrt_callback", stage: "callback", meta }),
    planned_at: isoIn(0),
  });
  await db().insert("calls", call);
  await ledger({ actor, action: "registry: call back", target: row.name ?? row.id.slice(0, 8), reason: row.reason });
  return call;
}
