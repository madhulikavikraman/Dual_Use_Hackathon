import { connection, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { bad, handle } from "@/lib/http";
import type { HouseholdStatus } from "@/lib/types";

// CSV exports for the field (PRD 11 "Export: CSV for the field", backlog item 19). The registry CSV includes
// phone numbers ON PURPOSE: it is the QRT's working list for call-backs and door knocks, unlike the public
// GeoJSON feeds, which strip phones and names. Treat a downloaded file as sensitive (purge 72 h after close).

type Cell = string | number | boolean | null | undefined;

function cell(v: Cell): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "boolean" ? (v ? "yes" : "no") : String(v);
  // Spreadsheet formula-injection guard for free text (names, reasons, stated locations).
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

const KINDS = ["registry", "households", "ledger"] as const;
type Kind = (typeof KINDS)[number];

async function registryCsv(): Promise<string> {
  const rows = (await db().all("help_requests")).sort((a, b) => {
    const closed = (r: typeof a) => (r.status === "closed" || r.status === "reached" ? 1 : 0);
    return closed(a) - closed(b) || a.priority - b.priority || (a.created_at < b.created_at ? -1 : 1);
  });
  return toCsv(
    [
      "id", "priority", "status", "name", "phone", "language", "zone_id", "needs", "people", "device_battery_hours", "animals",
      "reason", "assigned_to", "run_id", "source", "last_lat", "last_lng", "last_accuracy_m", "last_source", "last_stated_text",
      "location_consent", "last_observed_at", "synthetic", "created_at", "updated_at",
    ],
    rows.map((r) => [
      r.id, r.priority, r.status, r.name, r.phone, r.language, r.zone_id, r.needs.join("; "), r.people, r.device_battery_hours, r.animals,
      r.reason, r.assigned_to, r.run_id, r.source, r.last_lat, r.last_lng, r.last_accuracy_m, r.last_source, r.last_stated_text,
      r.last_consent, r.last_observed_at, r.synthetic, r.created_at, r.updated_at,
    ]),
  );
}

async function householdsCsv(): Promise<string> {
  const [households, statuses] = await Promise.all([db().all("households"), db().all("household_status")]);
  const latest = new Map<string, HouseholdStatus>();
  for (const st of statuses) {
    const prev = latest.get(st.household_id);
    if (!prev || prev.updated_at < st.updated_at) latest.set(st.household_id, st);
  }
  const sorted = [...households].sort(
    (a, b) => Number(!a.zone_id) - Number(!b.zone_id) || (a.zone_id ?? "").localeCompare(b.zone_id ?? "") || a.name.localeCompare(b.name),
  );
  return toCsv(
    [
      "id", "name", "role", "device_label", "synthetic", "phone_e164", "language", "zone_id", "address", "lat", "lng", "afn_flags",
      "on_post", "reliability", "last_heard", "status", "status_via", "understood", "destination", "needs", "status_at",
    ],
    sorted.map((h) => {
      const st = latest.get(h.id);
      return [
        h.id, h.name, h.role, h.device_label, h.synthetic, h.phone_e164, h.language, h.zone_id, h.address, h.lat, h.lng,
        h.afn_flags.join("; "), h.on_post, h.reliability, h.last_heard, st?.status ?? "pending", st?.via ?? null,
        st?.understood ?? null, st?.destination ?? null, st?.needs.join("; ") ?? null, st?.updated_at ?? null,
      ];
    }),
  );
}

async function ledgerCsv(): Promise<string> {
  const rows = (await db().all("ledger")).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  return toCsv(
    ["created_at", "actor", "kind", "action", "allowed", "target", "reason", "id"],
    rows.map((l) => [l.created_at, l.actor, l.kind, l.action, l.allowed, l.target, l.reason, l.id]),
  );
}

/** GET /api/export/csv?kind=registry|households|ledger (registry by default). */
export async function GET(req: NextRequest) {
  await connection();
  return handle(async () => {
    const kind = (req.nextUrl.searchParams.get("kind") ?? "registry") as Kind;
    if (!KINDS.includes(kind)) throw bad(`kind must be one of ${KINDS.join(", ")}`);
    const csv = kind === "registry" ? await registryCsv() : kind === "households" ? await householdsCsv() : await ledgerCsv();
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="voiceflare-${kind}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
