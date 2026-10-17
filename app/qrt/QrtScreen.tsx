"use client";

import Image from "next/image";
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
import { LiveRegistryCard } from "@/components/locate/LiveRegistry";
import { LiveRegistryProvider } from "@/components/locate/LiveRegistryContext";
import { Emoji } from "@/lib/ui/Emoji";
import { ICON } from "@/lib/ui/icons";
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
        <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 bg-slate-900 px-4 py-2.5 text-white lg:h-14 lg:flex-nowrap lg:py-0">
          <span className="flex shrink-0 items-center gap-2 text-xl font-black tracking-tight">
            <Image src="/brand/voiceflare-mark.png" alt="" width={26} height={26} className="size-[26px]" loading="eager" />
            VoiceFlare
          </span>
          <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-black tracking-widest text-slate-950">SIMULATED</span>
          <h1 className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold">
            <Emoji e={ICON.qrt} />
            <span className="truncate">Quick response team · {WORDING[snap.meta.mode].registry}</span>
          </h1>
          <span className="hidden min-w-0 truncate text-sm text-slate-400 xl:inline">
            <Emoji e={ICON.scenario} /> {scenarioLabel(snap.meta.scenario)}
          </span>
          <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 lg:ml-auto lg:w-auto lg:shrink-0 lg:flex-nowrap">
            <SupervisorInput />
            <Button size="sm" onClick={() => window.print()}>
              <Emoji e={ICON.print} /> Print door-knock sheet ({knock})
            </Button>
            <a href={EXPORT_CSV_URL} className="text-sm font-semibold text-slate-300 hover:text-white">
              <Emoji e={ICON.csv} /> Export CSV
            </a>
            <Link href="/board" className="text-sm font-semibold text-slate-300 hover:text-white">
              <Emoji e={ICON.map} /> Board
            </Link>
          </div>
        </header>
        {error ? <OfflineBanner error={error} receivedAt={receivedAt} /> : null}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-300 bg-white px-4 py-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Emoji e={ICON.location} /> Zone
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
          <span className="flex items-center gap-3 text-sm text-slate-600 sm:ml-auto">
            {([1, 2, 3, 4] as const).map((p) => (
              <span key={p} className="inline-flex items-center gap-1">
                <span className="inline-block size-3 rounded-full" style={{ backgroundColor: PRIORITY_COLOR[p] }} aria-hidden="true" />P{p}{" "}
                {rows.filter((r) => r.priority === p).length}
              </span>
            ))}
          </span>
        </div>
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:overflow-hidden">
          <div className="relative h-[45dvh] min-h-[280px] overflow-hidden rounded-lg border border-slate-300 bg-slate-200 lg:h-auto lg:min-h-0">
            <BoardMap variant="qrt" registry={rows} selectedId={selectedId} onSelectRegistry={selectFromMap} />
          </div>
          <div className="space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            {rows.length ? (
              rows.map((r) => (
                <LiveRegistryCard key={r.id} row={r} now={snap.now} selected={r.id === selectedId} onLocate={setSelectedId} showCall />
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
          <LiveRegistryProvider>
            <QrtLayout error={error} receivedAt={receivedAt} />
          </LiveRegistryProvider>
        </BoardProvider>
      </ToastProvider>
    </OperatorContext>
  );
}
