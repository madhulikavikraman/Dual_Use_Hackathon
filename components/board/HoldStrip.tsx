"use client";

import { useState, type ReactNode } from "react";
import type { HoldDecisionBody } from "@/lib/contracts";
import { decideHold } from "@/lib/client/api";
import { useNow } from "@/lib/client/clock";
import { fmtArea, fmtCountdown, fmtInt, fmtTime } from "@/lib/client/format";
import {
  ANSWER_COLOR,
  ANSWER_LABEL,
  CANARY_FLAG,
  CANARY_RESULT_LABEL,
  HOLD_OUTCOME,
  POSITION_LABEL,
  READ_INFO,
  stateLabel,
  STATE_TEXT,
} from "@/lib/client/labels";
import { STATE_COLOR } from "@/lib/directives";
import { Emoji, People } from "@/lib/ui/Emoji";
import { HoldWaveDose } from "./BlockPlanPanel";
import { ICON, STATE_ICON } from "@/lib/ui/icons";
import type { Hold, HoldDecision, HoldTally, SentinelAnswer, Zone } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Chip, ColorChip } from "@/components/ui/Chip";
import { useAct, useBoard } from "./BoardContext";
import { DecisionDialog } from "./DecisionDialog";

type Decision = HoldDecisionBody["decision"];

const DECISIONS: Record<
  Decision,
  { button: string; title: string; confirm: string; toast: string; suggestions: string[]; describe: (hold: Hold, zone: Zone | undefined) => ReactNode }
> = {
  send: {
    button: "Send now",
    title: "Send now (simulated)",
    confirm: "Send now",
    toast: "Sent (simulated). The canary outside the polygon rings next.",
    suggestions: ["Quorum: two edge reads confirm the hazard", "Incident commander wants it out now"],
    describe: (h) => (
      <>
        Sends the alert to “{h.polygon_label}”, waking <People n={h.population_est} /> (estimate). Afterwards a canary phone{" "}
        <Emoji e={ICON.canary} /> outside the polygon is asked whether it arrived.
      </>
    ),
  },
  hold_once: {
    button: "Hold once +60 s",
    title: "Hold once: 60 more seconds",
    confirm: "Hold 60 s more",
    toast: "Held once: 60 more seconds. It still sends on time.",
    suggestions: ["Waiting for a second edge read", "A sentinel is still ringing"],
    describe: () => "Adds 60 seconds, once. The hold is capped at two minutes and still sends on time at 0:00.",
  },
  edit: {
    button: "Edit polygon",
    title: "Edit polygon",
    confirm: "Use the zone's polygon",
    toast: "Polygon replaced with the zone's own. Dose preview updated.",
    suggestions: ["A sentinel outside the zone sees nothing", "Dose far larger than the zone"],
    describe: (_h, z) =>
      `Replaces the alert polygon with ${z ? z.name : "the zone"}'s own polygon. The dose preview updates; the timer keeps running.`,
  },
  cancel: {
    button: "Cancel",
    title: "Cancel the alert",
    confirm: "Cancel the alert",
    toast: "Alert cancelled. Nothing was sent.",
    suggestions: ["Edge reads dispute the hazard", "Duplicate request"],
    describe: (_h, z) => `Nothing is sent and the zone stays as it is${z ? ` (${z.name})` : ""}. The ledger keeps your reason.`,
  },
  hand_off: {
    button: "Hand to authority",
    title: "Hand to the alert authority",
    confirm: "Hand off",
    toast: "Handed to the duty officer with the evidence. It still sends at 0:00 unless they decide first.",
    suggestions: ["Dark zone: probably the network", "Reads disputed: the duty officer decides"],
    describe: () =>
      "Hands the decision to the duty officer with the evidence: zone, read, dose and clock. If nobody decides, it still sends at 0:00.",
  },
};

const TALLY: { key: keyof HoldTally; label: string; color: string }[] = [
  { key: "yes", label: "Yes", color: ANSWER_COLOR.yes },
  { key: "no", label: "No", color: ANSWER_COLOR.no },
  { key: "unsure", label: "Unsure", color: ANSWER_COLOR.unsure },
  { key: "silent", label: "Silent", color: ANSWER_COLOR.silent },
  { key: "pending", label: "Pending", color: ANSWER_COLOR.pending },
];

function Countdown({ hold }: { hold: Hold }) {
  const now = useNow();
  const { clockOffset } = useBoard();
  const deadline = Date.parse(hold.deadline);
  const total = Math.max(1, deadline - Date.parse(hold.started_at));
  const remaining = now === null ? total : deadline - (now + clockOffset);
  const fraction = Math.min(1, Math.max(0, remaining / total));
  return (
    <div className="w-[140px] shrink-0 text-right">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <Emoji e={ICON.hold} /> Sends on time in
      </div>
      <div className="font-mono text-[38px] font-black leading-none tabular-nums text-slate-900" aria-live="off">
        {fmtCountdown(remaining)}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-red-600" style={{ width: `${fraction * 100}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-slate-600">
        {remaining <= 0 ? "0:00 · sending on the timer" : hold.extended_once ? "held once · cap 120 s" : "sends at 0:00"}
      </div>
    </div>
  );
}

const STANDBY_COLOR = "#cbd5e1";

/** Rung sentinels first; backups not rung yet (no call) wait at the end, outside the tally. */
function SentinelRows({ hold }: { hold: Hold }) {
  const { householdById } = useBoard();
  if (!hold.sentinels.length) return <p className="px-3 text-sm text-slate-500">Choosing sentinels at the polygon&apos;s edges…</p>;
  const rows = [...hold.sentinels].sort((a, b) => Number(a.call_id === null) - Number(b.call_id === null));
  return (
    <ul className="divide-y divide-slate-100 px-3">
      {rows.map((s) => {
        const h = householdById.get(s.household_id);
        const rung = s.call_id !== null;
        return (
          <li key={`${s.household_id}:${s.call_id ?? "standby"}`} className={`flex items-start gap-2 py-1 ${rung ? "" : "opacity-60"}`}>
            <span
              aria-hidden="true"
              className={`mt-1.5 size-2.5 shrink-0 rotate-45 ${rung && s.answer === "pending" ? "animate-pulse" : ""}`}
              style={{ backgroundColor: rung ? ANSWER_COLOR[s.answer] : STANDBY_COLOR }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
                <b className="text-slate-900">{h?.name ?? "Sentinel"}</b>
                {h?.device_label ? <Chip tone="info">{h.device_label}</Chip> : null}
                <span className="text-slate-500">
                  {POSITION_LABEL[s.position]} · {s.independent ? "independent" : "recent caller, not independent"}
                </span>
              </div>
              {s.what || s.direction ? (
                <div className="text-sm text-slate-700">
                  “{s.what ?? "—"}”{s.direction ? `, ${s.direction}` : ""}
                  {s.answered_at ? <span className="text-slate-500"> · {fmtTime(s.answered_at)}</span> : null}
                </div>
              ) : null}
            </div>
            {rung ? (
              <AnswerChip answer={s.answer} />
            ) : (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-300">
                Standby · not rung
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AnswerChip({ answer }: { answer: SentinelAnswer }) {
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: ANSWER_COLOR[answer] }}
    >
      {ANSWER_LABEL[answer]}
    </span>
  );
}

function OpenHold({ hold, others, onSelect }: { hold: Hold; others: Hold[]; onSelect: (id: string) => void }) {
  const { snap, zoneById } = useBoard();
  const act = useAct();
  const [decision, setDecision] = useState<Decision | null>(null);
  const zone = zoneById.get(hold.zone_id);
  const mode = snap.meta.mode;
  const read = READ_INFO[hold.read];
  const oversize = zone?.population_est ? hold.population_est / zone.population_est : 1;

  // A column: everything fixed except the sentinel list, which scrolls, so the five buttons always show.
  return (
    <section data-tour="hold" aria-label="Hold" className="flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-red-600 bg-white shadow-sm">
      <header className="flex shrink-0 flex-wrap items-center gap-2 bg-red-50 px-3 py-1.5">
        <span className="rounded bg-red-700 px-1.5 py-0.5 text-[11px] font-black tracking-widest text-white">
          <Emoji e={ICON.hold} /> HOLD
        </span>
        <b className="text-[15px]">{zone?.name ?? hold.zone_id}</b>
        <span className="text-slate-500">→</span>
        <ColorChip color={STATE_COLOR[hold.proposed_state]} text={STATE_TEXT[hold.proposed_state]}>
          <Emoji e={STATE_ICON[hold.proposed_state]} />
          {stateLabel(hold.proposed_state, mode)}
        </ColorChip>
        <Chip tone={read.tone} className="ml-auto" title={read.detail}>
          {read.label}
        </Chip>
      </header>
      {hold.handed_off_by ? (
        // A hand-off escalates, it never stops the alert: the hold stays open and every button still works.
        <p role="status" className="mx-3 mt-2 shrink-0 rounded-md bg-amber-100 px-2 py-1 text-[13px] font-semibold leading-snug text-amber-950 ring-1 ring-inset ring-amber-300">
          Handed to the duty officer by {hold.handed_off_by} at {fmtTime(hold.handed_off_at)} — still sends at 0:00
        </p>
      ) : null}
      {others.length > 1 ? (
        <div className="flex shrink-0 gap-1 px-3 pt-2">
          {others.map((o) => (
            <Button key={o.id} size="sm" variant={o.id === hold.id ? "primary" : "secondary"} onClick={() => onSelect(o.id)}>
              {zoneById.get(o.zone_id)?.name ?? o.zone_id}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="flex shrink-0 gap-3 px-3 pt-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Dose preview</div>
          <div className="text-[23px] font-black leading-tight text-slate-900">
            Wakes <People n={hold.population_est} />
          </div>
          <div className="text-[13px] leading-snug text-slate-600">
            across {fmtArea(hold.area_sq_mi)} sq mi (estimate) · polygon: <b className="text-slate-900">{hold.polygon_label}</b>
          </div>
          {zone && hold.polygon_label === zone.name ? <HoldWaveDose zoneId={hold.zone_id} className="mt-0.5" /> : null}
          {oversize >= 3 && zone?.population_est ? (
            <p className="mt-1 rounded bg-red-100 px-2 py-0.5 text-[13px] font-semibold text-red-900">
              {fmtInt(oversize)}× the zone&apos;s <People n={zone.population_est} />. Check the polygon.
            </p>
          ) : null}
        </div>
        <Countdown hold={hold} />
      </div>
      <blockquote className="mx-3 mt-1.5 line-clamp-2 shrink-0 border-l-4 border-slate-300 pl-2 text-[13px] italic leading-snug text-slate-700" title={hold.alert_text}>
        {hold.alert_text}
      </blockquote>
      <div className="mt-1.5 grid shrink-0 grid-cols-5 gap-1 px-3">
        {TALLY.map((t) => (
          <div key={t.key} className="rounded-md bg-slate-50 py-0.5 text-center">
            <div className="text-[22px] font-black leading-none tabular-nums" style={{ color: t.color }}>
              {hold.tally[t.key]}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{t.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-1 min-h-[64px] flex-1 overflow-y-auto">
        <h4 className="px-3 pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <Emoji e={ICON.sentinel} /> Sentinels at the edge
        </h4>
        <SentinelRows hold={hold} />
      </div>
      <p className="shrink-0 px-3 pt-1 text-xs text-slate-600">{read.detail}</p>
      <div data-tour="hold-actions" className="mt-1.5 flex shrink-0 flex-wrap gap-1.5 border-t border-slate-200 px-3 py-2">
        {(Object.keys(DECISIONS) as Decision[]).map((d) => (
          <Button
            key={d}
            size="sm"
            variant={d === "send" ? "primary" : "secondary"}
            disabled={d === "hold_once" && hold.extended_once}
            title={d === "hold_once" && hold.extended_once ? "Hold once was already used" : undefined}
            onClick={() => setDecision(d)}
          >
            {DECISIONS[d].button}
          </Button>
        ))}
      </div>
      <p className="shrink-0 bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
        Sends on time at 0:00. The machine can delay an alert, never stop one.
      </p>
      {decision ? (
        <DecisionDialog
          title={DECISIONS[decision].title}
          description={DECISIONS[decision].describe(hold, zone)}
          confirmLabel={DECISIONS[decision].confirm}
          reasonSuggestions={DECISIONS[decision].suggestions}
          onConfirm={({ actor, reason }) =>
            act(
              () => decideHold(hold.id, { decision, actor, reason, ...(decision === "edit" ? { polygon: "zone" as const } : {}) }),
              DECISIONS[decision].toast,
            )
          }
          onClose={() => setDecision(null)}
        />
      ) : null}
    </section>
  );
}

function outcomeOf(hold: Hold): HoldDecision {
  if (hold.decision) return hold.decision;
  return hold.status === "cancelled" ? "cancel" : hold.status === "handed_off" ? "hand_off" : "send";
}

/** After the hold: what happened, and the canary's answer for a send. */
function ClosedHold({ hold, onDismiss }: { hold: Hold; onDismiss: () => void }) {
  const { snap, zoneById, householdById } = useBoard();
  const zone = zoneById.get(hold.zone_id);
  const canaries = snap.canaries.filter((c) => c.hold_id === hold.id);
  const sent = hold.status === "sent";
  return (
    <section data-tour="last-hold" aria-label="Last hold" className="shrink-0 rounded-lg border border-slate-300 bg-white">
      <header className="flex items-start gap-2 px-3 pt-2">
        <span className="mt-0.5 shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-black tracking-widest text-white">
          <Emoji e={ICON.hold} /> LAST HOLD
        </span>
        <div className="min-w-0 flex-1">
          <b className="block text-[15px] leading-snug">{HOLD_OUTCOME[outcomeOf(hold)]}</b>
          <span className="block truncate text-[13px] text-slate-600">
            {zone?.name ?? hold.zone_id} · {fmtTime(hold.sent_at ?? hold.decided_at)}
            {hold.decided_by ? ` · ${hold.decided_by}` : ""}
            {hold.reason ? ` · “${hold.reason}”` : ""}
          </span>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-lg leading-none text-slate-400 hover:text-slate-900">
          ×
        </button>
      </header>
      <div className="space-y-1.5 px-3 pb-2.5 pt-1">
        {sent ? (
          <p className="text-[13px] text-slate-700">
            Woke <b><People n={hold.population_est} /></b> · {hold.polygon_label} · tally {hold.tally.yes} yes, {hold.tally.no} no,{" "}
            {hold.tally.silent} silent
          </p>
        ) : null}
        {hold.handed_off_by ? (
          <p className="text-[13px] text-slate-700">
            Handed to the duty officer by {hold.handed_off_by} at {fmtTime(hold.handed_off_at)}.
          </p>
        ) : null}
        {sent && !canaries.length ? (
          <p className="text-sm text-slate-500">
            <Emoji e={ICON.canary} /> Canary: rings outside the polygon about 15 s after the send…
          </p>
        ) : null}
        {canaries.map((c) => {
          const h = householdById.get(c.household_id);
          const flag = c.flag ? CANARY_FLAG[c.flag] : null;
          return (
            <div key={c.id} className="rounded-md bg-slate-50 px-2.5 py-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-bold">
                  <Emoji e={ICON.canary} /> Canary
                </span>
                <span className="min-w-0 truncate">
                  {h?.name ?? "Canary phone"}
                  {h?.device_label ? ` · ${h.device_label}` : ""} · {c.inside ? "inside" : "outside"} the polygon
                </span>
                {flag ? (
                  <Chip tone={flag.tone} className="ml-auto" title={flag.detail}>
                    {flag.label}
                  </Chip>
                ) : (
                  <Chip tone="info" className="ml-auto">
                    {CANARY_RESULT_LABEL[c.result]}
                  </Chip>
                )}
              </div>
              {flag ? (
                <p className="mt-0.5 text-xs text-slate-700">
                  {CANARY_RESULT_LABEL[c.result]}. {flag.detail}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Top of the right column: the open hold, or the outcome of the last one until dismissed. */
export function HoldStrip() {
  // The selected open hold lives in the board context, so the map draws the hold these buttons act on.
  const { snap, openHolds, hold, selectHold } = useBoard();
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (hold) return <OpenHold key={hold.id} hold={hold} others={openHolds} onSelect={selectHold} />;
  const last = snap.holds[0];
  if (!last || last.id === dismissed) return null;
  return <ClosedHold key={last.id} hold={last} onDismiss={() => setDismissed(last.id)} />;
}
