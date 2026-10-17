"use client";

import { useState } from "react";
import { resetDemo } from "@/lib/client/api";
import { useNow } from "@/lib/client/clock";
import { fmtClock } from "@/lib/client/format";
import { SCENARIO_OPTIONS, scenarioLabel } from "@/lib/client/labels";
import { OPERATOR_LABEL, setOperatorName, useOperator, useOperatorName } from "@/lib/client/supervisor";
import type { Scenario } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useAct } from "./BoardContext";

/**
 * The name of the person at this screen (the supervisor on the board, the QRT lead on /qrt), saved in
 * this browser and pre-filled in every decision dialog on that screen.
 */
export function SupervisorInput({ dark = true }: { dark?: boolean }) {
  const operator = useOperator();
  const name = useOperatorName(operator);
  const label = OPERATOR_LABEL[operator];
  return (
    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
      <span className={dark ? "text-slate-400" : "text-slate-600"}>{label}</span>
      <input
        value={name}
        onChange={(e) => setOperatorName(operator, e.target.value)}
        placeholder="Your name"
        aria-label={`${label} name`}
        className={`h-8 w-36 rounded-md px-2.5 text-sm font-semibold normal-case tracking-normal focus:outline-none focus:ring-2 ${
          dark
            ? `bg-slate-800 text-white placeholder:text-slate-500 focus:ring-blue-400 ${name ? "" : "ring-2 ring-amber-400"}`
            : `border border-slate-300 bg-white text-slate-900 focus:ring-blue-600/30 ${name ? "" : "border-amber-500"}`
        }`}
      />
    </label>
  );
}

/** Local time, updated every second. */
export function LiveClock() {
  const now = useNow();
  return (
    <time className="min-w-[104px] text-right font-mono text-lg font-bold tabular-nums">
      {now === null ? "" : fmtClock(now)}
    </time>
  );
}

/** Reset the run and load another scenario (confirmed first: it wipes calls, holds and the registry). */
export function ScenarioSwitcher({ current }: { current: Scenario }) {
  const act = useAct();
  const [target, setTarget] = useState<Scenario | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await act(() => resetDemo(target), `Loaded ${scenarioLabel(target)}`);
      setTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <select
        aria-label="Scenario"
        value={current}
        onChange={(e) => {
          setError(null);
          setTarget(e.target.value as Scenario);
        }}
        className="h-8 max-w-[200px] shrink-0 rounded-md bg-slate-800 px-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {SCENARIO_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {target ? (
        <Dialog title={`Load ${scenarioLabel(target)}?`} size="sm" onClose={() => setTarget(null)}>
          <div className="space-y-3 px-5 py-4 text-[15px] text-slate-700">
            <p>
              This resets the run on the same screen: calls, holds, the registry, the feed and the ledger are cleared and the scenario&apos;s
              zones and synthetic roster load. The twist log is kept.
            </p>
            {error ? <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setTarget(null)}>
                Keep {scenarioLabel(current)}
              </Button>
              <Button variant="primary" disabled={busy} onClick={reset}>
                {busy ? "Loading…" : "Reset and load"}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
