"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { fmtInt, fmtPct, fmtUsd } from "@/lib/client/format";
import { MODE_LABEL, WORDING } from "@/lib/client/labels";
import { useBoard } from "./BoardContext";
import { LiveClock, ScenarioSwitcher, SupervisorInput } from "./HeaderControls";

function HeaderChip({ on, className = "", children }: { on: boolean; className?: string; children: ReactNode }) {
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        on ? "bg-slate-800 text-slate-100 ring-slate-600" : "bg-transparent text-slate-400 ring-slate-700"
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** Product name, the always-on SIMULATED badge, scenario and mode, storage and Retell, clock, name. */
export function BoardHeader() {
  const { snap } = useBoard();
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 bg-slate-900 px-4 text-white">
      <div className="flex shrink-0 items-baseline gap-2">
        <span className="text-xl font-black tracking-tight">VoiceFlare</span>
        <span className="hidden text-xs text-slate-400 2xl:inline">the supervisor&apos;s screen</span>
      </div>
      <span
        className="shrink-0 rounded bg-amber-400 px-2 py-0.5 text-xs font-black tracking-widest text-slate-950"
        title="Every send is simulated. Residents are synthetic except the volunteer phones."
      >
        SIMULATED
      </span>
      <ScenarioSwitcher current={snap.meta.scenario} />
      <span className="min-w-0 truncate text-sm text-slate-300" title={MODE_LABEL[snap.meta.mode]}>
        {MODE_LABEL[snap.meta.mode]}
      </span>
      <HeaderChip on className="hidden min-[1360px]:inline">
        Storage: {snap.backend}
      </HeaderChip>
      <HeaderChip on={snap.retell}>Retell {snap.retell ? "on" : "off"}</HeaderChip>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <LiveClock />
        <SupervisorInput />
        <nav className="flex gap-3 text-sm font-semibold text-slate-300">
          <Link href="/qrt" target="_blank" className="hover:text-white">
            QRT ↗
          </Link>
          <Link href="/phones" target="_blank" className="hover:text-white">
            Phones ↗
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Metric({ label, value, note, alert = false }: { label: string; value: ReactNode; note: ReactNode; alert?: boolean }) {
  return (
    <div className="min-w-0 px-3 py-1.5">
      <div className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-[28px] font-black leading-none tabular-nums ${alert ? "text-red-700" : "text-slate-900"}`}>{value}</div>
      <div className="truncate text-xs text-slate-500">{note}</div>
    </div>
  );
}

/** The numbers a judge asks for, real phones only (synthetic rows are labeled and excluded). */
export function MetricsStrip() {
  const { snap } = useBoard();
  const m = snap.metrics;
  const words = WORDING[snap.meta.mode];
  // Volunteer resident phones, as the engine counts real_accounted: public-line callers are real people but
  // not part of the demo roster, so they are not in the denominator either.
  const realResidents = snap.households.filter((h) => h.has_device && h.device_label !== "Public line" && h.role === "resident").length;
  return (
    <div className="grid shrink-0 grid-cols-8 divide-x divide-slate-200 border-b border-slate-300 bg-white">
      <Metric
        label="Real phones"
        value={
          <>
            {m.real_accounted}
            <span className="text-lg text-slate-400">/{realResidents}</span>
          </>
        }
        note="accounted, real only"
      />
      <Metric label={words.reached} value={fmtInt(m.reached)} note={`of ${fmtInt(m.in_campaigns)} called`} />
      <Metric label="Understood" value={fmtPct(m.understood_pct)} note="teach-back passed" />
      <Metric label={words.needsHelp} value={fmtInt(m.needs_help_open)} note={words.registry.toLowerCase()} alert={m.needs_help_open > 0} />
      <Metric
        label="Calls"
        value={
          <>
            {m.calls_active}
            <span className="text-lg text-slate-400"> live</span>
          </>
        }
        note={`${fmtInt(m.calls_queued)} queued`}
      />
      <Metric label="Refusals" value={fmtInt(m.refusals)} note="the agent said no" />
      <Metric label="Human decisions" value={fmtInt(m.human_decisions)} note="named, in the ledger" />
      <Metric label="Cost (estimate)" value={fmtUsd(m.cost_usd)} note={`${m.cost_minutes.toFixed(1)} call minutes`} />
    </div>
  );
}
