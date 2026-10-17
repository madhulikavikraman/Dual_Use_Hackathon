"use client";

import { fmtTime } from "@/lib/client/format";
import type { LedgerEntry } from "@/lib/types";
import { Chip } from "@/components/ui/Chip";
import { useBoard } from "./BoardContext";

const MACHINE_ACTORS = ["system", "agent", "timer"];

/** PRD section 9, printed on the screen: what the agent may do, and what only a human may do. */
function Allowlist() {
  return (
    <section aria-label="What the agent can and cannot do" className="grid grid-cols-2 gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] leading-snug">
      <div>
        <h3 className="mb-0.5 text-xs font-black uppercase tracking-wider text-green-800">The agent can</h3>
        <ul className="list-disc pl-4 text-slate-800">
          <li>Relay the zone&apos;s approved directive, route and evacuation point, verbatim</li>
          <li>Read the official alert; answer from it and the zone&apos;s fact sheet</li>
          <li>Ask fixed questions, confirm, then record</li>
          <li>Send a caller to 911 and flag the row</li>
          <li>Ask sentinels what they see; ask a canary if the alert arrived</li>
          <li>Say “I can&apos;t answer; a person will call you back”</li>
          <li>End the call</li>
        </ul>
      </div>
      <div>
        <h3 className="mb-0.5 text-xs font-black uppercase tracking-wider text-slate-800">The agent cannot</h3>
        <ul className="list-disc pl-4 text-slate-800">
          <li>Change a zone; send, cancel, widen or retract an alert</li>
          <li>Extend or shorten the hold</li>
          <li>Improvise a route, give an ETA, or say “you&apos;re probably fine”</li>
          <li>Say a zone is clear or a person is safe</li>
          <li>Call anyone off the roster or outside an approved zone</li>
          <li>Tell a caller where another person is</li>
          <li>Dispatch anyone</li>
        </ul>
      </div>
      <p className="col-span-2 border-t border-slate-200 pt-1.5 text-xs text-slate-600">
        Seven tools: <code>record_status</code> · <code>report_hazard</code> · <code>request_human</code> · <code>end_call</code> ·{" "}
        <code>lookup_zone</code> · <code>read_observation</code> · <code>received_alert</code>. Every refusal and every human decision is
        written below with a timestamp.
      </p>
    </section>
  );
}

function kindOf(e: LedgerEntry): "decision" | "refusal" | "machine" {
  if (!e.allowed || e.kind === "refusal") return "refusal";
  if (e.kind === "decision" && !MACHINE_ACTORS.includes(e.actor)) return "decision";
  return "machine";
}

const ROW = {
  decision: "bg-white",
  refusal: "bg-amber-50",
  machine: "bg-white text-slate-600",
};

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const kind = kindOf(entry);
  return (
    <li className={`grid grid-cols-[84px_minmax(0,1fr)] gap-2 px-3 py-1.5 ${ROW[kind]}`}>
      <time className="pt-0.5 text-xs tabular-nums text-slate-500" dateTime={entry.created_at}>
        {fmtTime(entry.created_at)}
      </time>
      <div className="min-w-0 text-sm">
        <div className="flex flex-wrap items-center gap-x-1.5">
          {kind === "refusal" ? (
            <Chip tone="warn">refused</Chip>
          ) : kind === "decision" ? (
            <Chip tone="info">human decision</Chip>
          ) : (
            <Chip>{entry.kind}</Chip>
          )}
          {kind === "machine" && entry.actor === entry.kind ? null : (
            <b className={kind === "machine" ? "font-semibold" : "text-slate-900"}>{entry.actor}</b>
          )}
          <span className={kind === "refusal" ? "font-semibold text-amber-950" : ""}>{entry.action}</span>
          {entry.target ? <span className="text-slate-500">· {entry.target}</span> : null}
        </div>
        {entry.reason ? <div className="text-[13px] text-slate-600">“{entry.reason}”</div> : null}
      </div>
    </li>
  );
}

/** Every human decision and every refusal, newest first, with the allowlist beside it. */
export function LedgerPanel() {
  const { snap } = useBoard();
  return (
    <div className="space-y-3 p-3">
      <Allowlist />
      <section>
        <h3 className="mb-1.5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-600">
          Ledger
          <span className="normal-case tracking-normal text-slate-700">
            <b className="tabular-nums">{snap.metrics.human_decisions}</b> human decisions · <b className="tabular-nums">{snap.metrics.refusals}</b>{" "}
            refusals
          </span>
        </h3>
        {snap.ledger.length ? (
          <ol className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
            {snap.ledger.map((e) => (
              <LedgerRow key={e.id} entry={e} />
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">The ledger is empty.</p>
        )}
      </section>
    </div>
  );
}
