"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { EXPORT_CSV_URL, getBoard } from "@/lib/client/api";
import { HELP_STATUS_LABEL, PRIORITY_COLOR, scenarioLabel, WORDING } from "@/lib/client/labels";
import { OperatorContext } from "@/lib/client/supervisor";
import { usePoll } from "@/lib/client/usePoll";
import type { HelpStatus } from "@/lib/types";
import { BoardProvider, useBoard } from "@/components/board/BoardContext";
import { BoardMap } from "@/components/board/BoardMap";
import { BoardWaiting, OfflineBanner } from "@/components/board/BoardScreen";
import { SupervisorInput } from "@/components/board/HeaderControls";
import { PickupRuns } from "@/components/board/PickupRuns";
import { RegistryCard } from "@/components/board/RegistryPanel";
import { Button } from "@/components/ui/Button";
import { ToastProvider } from "@/components/ui/Toast";
import { DoorKnockSheet, doorKnockRows, silenceClusters } from "./DoorKnockSheet";

const POLL_MS = 1500;
const STATUSES: HelpStatus[] = ["open", "assigned", "en_route", "reached", "unreachable", "closed"];
const ACTIVE: HelpStatus[] = ["open", "assigned", "en_route", "unreachable"];

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-sm font-semibold ring-1 ring-inset ${
        on ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function QrtLayout({ error, receivedAt }: { error: string | null; receivedAt: number | null }) {
  const { snap } = useBoard();
  const [zone, setZone] = useState("all");
  const [statuses, setStatuses] = useState<HelpStatus[]>(ACTIVE);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const inZone = snap.registry.filter((r) => zone === "all" || r.zone_id === zone);
  const rows = inZone.filter((r) => statuses.includes(r.status));
  const knock = doorKnockRows(snap.registry).length + silenceClusters(snap.clusters).length;

  function toggle(s: HelpStatus) {
    setStatuses((xs) => (xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s]));
  }

  function selectFromMap(id: string) {
    setSelectedId(id);
    document.getElementById(`registry-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <>
      <div className="flex h-dvh flex-col overflow-hidden bg-slate-100 text-slate-900 print:hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 bg-slate-900 px-4 text-white">
          <span className="text-xl font-black tracking-tight">VoiceFlare</span>
          <span className="text-sm text-slate-300">Quick response team · {WORDING[snap.meta.mode].registry}</span>
          <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-black tracking-widest text-slate-950">SIMULATED</span>
          <span className="min-w-0 truncate text-sm text-slate-300">{scenarioLabel(snap.meta.scenario)}</span>
          <div className="ml-auto flex shrink-0 items-center gap-4">
            <SupervisorInput />
            <Button size="sm" onClick={() => window.print()}>
              Print door-knock sheet ({knock})
            </Button>
            <a href={EXPORT_CSV_URL} className="text-sm font-semibold text-slate-300 hover:text-white">
              Export CSV
            </a>
            <Link href="/board" className="text-sm font-semibold text-slate-300 hover:text-white">
              Board
            </Link>
          </div>
        </header>
        {error ? <OfflineBanner error={error} receivedAt={receivedAt} /> : null}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-300 bg-white px-4 py-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            Zone
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm font-normal"
            >
              <option value="all">All zones</option>
              {snap.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
          <span className="ml-2 text-sm font-semibold text-slate-700">Status</span>
          {STATUSES.map((s) => (
            <FilterChip key={s} on={statuses.includes(s)} onClick={() => toggle(s)}>
              {HELP_STATUS_LABEL[s]} {inZone.filter((r) => r.status === s).length}
            </FilterChip>
          ))}
          <span className="ml-auto flex items-center gap-3 text-sm text-slate-600">
            {([1, 2, 3, 4] as const).map((p) => (
              <span key={p} className="inline-flex items-center gap-1">
                <span className="inline-block size-3 rounded-full" style={{ backgroundColor: PRIORITY_COLOR[p] }} aria-hidden="true" />P{p}{" "}
                {rows.filter((r) => r.priority === p).length}
              </span>
            ))}
          </span>
        </div>
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-3 p-3">
          <div className="relative min-h-0 overflow-hidden rounded-lg border border-slate-300 bg-slate-200">
            <BoardMap variant="qrt" registry={rows} selectedId={selectedId} onSelectRegistry={selectFromMap} />
          </div>
          <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
            {rows.length ? (
              rows.map((r) => (
                <RegistryCard key={r.id} row={r} now={snap.now} selected={r.id === selectedId} onLocate={setSelectedId} />
              ))
            ) : (
              <p className="rounded-lg border border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                No rows match these filters.
              </p>
            )}
            <PickupRuns />
            <DoorKnockSheet printed={false} />
          </div>
        </main>
      </div>
      <DoorKnockSheet printed />
    </>
  );
}

/** /qrt: the quick response team's registry map and list, pickup runs and the door-knock sheet. */
export function QrtScreen() {
  const { data, error, receivedAt, refresh } = usePoll(getBoard, POLL_MS);
  if (!data) return <BoardWaiting error={error} />;
  const clockOffset = receivedAt ? Date.parse(data.now) - receivedAt : 0;
  // Signed as the QRT lead: a name typed here never replaces the supervisor's on the board.
  return (
    <OperatorContext value="qrt">
      <ToastProvider>
        <BoardProvider snap={data} refresh={refresh} clockOffset={clockOffset}>
          <QrtLayout error={error} receivedAt={receivedAt} />
        </BoardProvider>
      </ToastProvider>
    </OperatorContext>
  );
}
