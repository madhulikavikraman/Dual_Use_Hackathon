"use client";

import Link from "next/link";
import { EXPORT_CSV_URL } from "@/lib/client/api";
import { fmtAgo, isFresh } from "@/lib/client/format";
import {
  HELP_SOURCE_LABEL,
  HELP_STATUS_LABEL,
  HELP_STATUS_TONE,
  LOCATION_SOURCE_LABEL,
  NEED_LABEL,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
} from "@/lib/client/labels";
import type { HelpRequest } from "@/lib/types";
import { Chip, ColorChip } from "@/components/ui/Chip";
import { useBoard } from "./BoardContext";
import { PickupRuns } from "./PickupRuns";
import { RegistryActions } from "./RegistryActions";

/** "Last seen" for a row: where the fix came from, how old it is, fresh under 15 minutes. */
function LastSeen({ row, now }: { row: HelpRequest; now: string }) {
  if (row.last_lat === null || row.last_lng === null) return <span className="text-slate-500">No location yet</span>;
  const fresh = isFresh(row.last_observed_at, now);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      {row.last_stated_text ? <span className="font-semibold text-slate-900">“{row.last_stated_text}”</span> : null}
      <span className="text-slate-600">
        {LOCATION_SOURCE_LABEL[row.last_source]} · {fmtAgo(row.last_observed_at, now)}
      </span>
      <Chip tone={fresh ? "good" : "warn"}>{fresh ? "fresh" : "stale"}</Chip>
    </span>
  );
}

function PriorityChip({ priority }: { priority: 1 | 2 | 3 | 4 }) {
  return (
    <ColorChip color={PRIORITY_COLOR[priority]} text={priority === 3 ? "#111827" : "#ffffff"} title={PRIORITY_LABEL[priority]}>
      P{priority}
    </ColorChip>
  );
}

/** Needs, people, battery and animals as one line. */
function needsLine(row: HelpRequest): string {
  return [
    row.needs.length ? row.needs.map((n) => NEED_LABEL[n]).join(", ") : (row.reason ?? "").replaceAll("_", " "),
    row.people ? `${row.people} ${row.people === 1 ? "person" : "people"}` : "",
    row.device_battery_hours !== null ? `battery ${row.device_battery_hours} h` : "",
    row.animals ? `animals: ${row.animals}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** One registry row with its actions. With `onLocate`, a Locate button selects it on the map. */
export function RegistryCard({
  row,
  now,
  selected = false,
  onLocate,
}: {
  row: HelpRequest;
  now: string;
  selected?: boolean;
  onLocate?: (id: string) => void;
}) {
  const done = row.status === "closed" || row.status === "reached";
  return (
    <article
      id={`registry-${row.id}`}
      className={`scroll-mt-2 rounded-md border border-l-[6px] border-slate-200 bg-white px-3 py-2 ${done ? "opacity-60" : ""} ${
        selected ? "ring-2 ring-blue-600" : ""
      }`}
      style={{ borderLeftColor: PRIORITY_COLOR[row.priority] }}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <PriorityChip priority={row.priority} />
        <b className="text-[15px]">{row.name ?? "Name not given"}</b>
        {row.phone ? <span className="font-mono text-sm text-slate-700">{row.phone}</span> : null}
        {row.language ? <span className="text-sm text-slate-600">{row.language}</span> : null}
        <span className="ml-auto flex items-center gap-1.5">
          {row.synthetic ? <Chip>synthetic</Chip> : <Chip tone="info">real phone</Chip>}
          <Chip tone={HELP_STATUS_TONE[row.status]}>{HELP_STATUS_LABEL[row.status]}</Chip>
          {onLocate && row.last_lat !== null ? (
            <button
              type="button"
              onClick={() => onLocate(row.id)}
              className="rounded px-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              Locate
            </button>
          ) : null}
        </span>
      </header>
      <p className="mt-1 text-sm font-medium text-slate-800">{needsLine(row) || "Needs not recorded"}</p>
      <p className="mt-0.5 text-sm">
        <span className="text-slate-500">Last seen: </span>
        <LastSeen row={row} now={now} />
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        {row.zone_id ?? "no zone"} · {HELP_SOURCE_LABEL[row.source]}
        {row.assigned_to ? ` · assigned to ${row.assigned_to}` : ""}
      </p>
      <div className="mt-1.5">
        <RegistryActions row={row} />
      </div>
    </article>
  );
}

/** The help registry on the board: who needs a person, where they were last heard from. */
export function RegistryPanel() {
  const { snap } = useBoard();
  const open = snap.registry.filter((r) => r.status !== "closed" && r.status !== "reached");
  const byPriority = ([1, 2, 3, 4] as const).map((p) => ({ p, n: open.filter((r) => r.priority === p).length }));

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-700">{open.length} open</span>
        {byPriority.map(({ p, n }) => (
          <span key={p} className="inline-flex items-center gap-1 text-sm text-slate-700">
            <PriorityChip priority={p} /> {n}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-3 text-sm font-semibold">
          <a href={EXPORT_CSV_URL} className="text-blue-700 underline-offset-2 hover:underline">
            Export CSV
          </a>
          <Link href="/qrt" target="_blank" className="text-blue-700 underline-offset-2 hover:underline">
            QRT view ↗
          </Link>
        </span>
      </div>
      <PickupRuns />
      {snap.registry.length ? (
        <div className="space-y-2">
          {snap.registry.map((r) => (
            <RegistryCard key={r.id} row={r} now={snap.now} />
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
          Nobody has asked for a person yet. “I need help” on any call adds a row here, with the number and the last known location.
        </p>
      )}
    </div>
  );
}
