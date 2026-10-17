"use client";

import type { CallView } from "@/lib/contracts";
import { fmtSpan, fmtTime } from "@/lib/client/format";
import { PURPOSE_LABEL, TRANSPORT_LABEL } from "@/lib/client/labels";
import { Chip } from "@/components/ui/Chip";
import { useBoard } from "./BoardContext";

function CallCard({ call, now }: { call: CallView; now: string }) {
  const ringing = call.state === "ringing";
  const since = call.answered_at ?? call.started_at;
  return (
    <article className="flex w-[270px] shrink-0 flex-col rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
      <header className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={`size-2.5 shrink-0 rounded-full ${ringing ? "animate-pulse bg-blue-500" : "bg-green-600"}`}
        />
        <b className="min-w-0 truncate text-sm">{call.household_name ?? "Inbound caller"}</b>
        {call.device_label ? <Chip tone="info">{call.device_label}</Chip> : null}
        <span className="ml-auto shrink-0 text-xs tabular-nums text-slate-500">
          {ringing ? "ringing" : "on call"}
          {since ? ` ${fmtSpan(Date.parse(now) - Date.parse(since))}` : ""}
        </span>
      </header>
      <div className="mt-0.5 truncate text-xs text-slate-600">
        {PURPOSE_LABEL[call.purpose]} · {call.language} · {TRANSPORT_LABEL[call.transport]}
        {call.attempt > 1 ? ` · attempt ${call.attempt}` : ""}
        {call.simulated ? " · simulated" : ""}
      </div>
      <p className="mt-0.5 line-clamp-2 text-[13px] italic leading-snug text-slate-800">
        {call.last_line ? `“${call.last_line}”` : <span className="not-italic text-slate-400">…</span>}
      </p>
    </article>
  );
}

/**
 * Calls ringing or connected right now, newest first; the rest update the board silently.
 * Fixed height, so calls starting and ending never resize the map.
 */
export function CallsStrip() {
  const { snap } = useBoard();
  const live = snap.calls.filter((c) => c.state === "ringing" || c.state === "active");
  const lastEnded = snap.calls.find((c) => c.ended_at);
  return (
    <section aria-label="Live calls" className="flex h-[112px] shrink-0 flex-col rounded-lg border border-slate-300 bg-white">
      <header className="flex items-center gap-3 px-3 py-1.5">
        <h2 className="shrink-0 text-xs font-bold uppercase tracking-wider text-slate-600">Live calls</h2>
        <span className="shrink-0 text-sm text-slate-700">
          <b className="tabular-nums">{snap.metrics.calls_active}</b> active · <b className="tabular-nums">{snap.metrics.calls_queued}</b> queued
        </span>
        {lastEnded ? (
          <span className="ml-auto min-w-0 truncate text-xs text-slate-500">
            Last ended {fmtTime(lastEnded.ended_at)}: {lastEnded.household_name ?? "caller"}
            {lastEnded.summary ? ` · ${lastEnded.summary}` : ""}
          </span>
        ) : null}
      </header>
      {live.length ? (
        <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto px-3 pb-2">
          {live.map((c) => (
            <CallCard key={c.id} call={c} now={snap.now} />
          ))}
        </div>
      ) : (
        <p className="grid flex-1 place-items-center px-3 pb-2 text-sm text-slate-500">
          No call is ringing right now. Approving a zone to Near-Crisis starts Stage 1 from the edge nearest the hazard.
        </p>
      )}
    </section>
  );
}
