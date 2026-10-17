"use client";

// The Calls view: what is ringing or connected now, the call waves started, and how recent calls ended.
import type { ReactNode } from "react";
import type { CallView } from "@/lib/contracts";
import { fmtInt, fmtPct, fmtSpan, fmtTime, fmtUsd } from "@/lib/client/format";
import { campaignLabel, PURPOSE_LABEL, stateLabel, TRANSPORT_LABEL, WORDING } from "@/lib/client/labels";
import type { CallPurpose, Campaign, Transport } from "@/lib/types";
import { Emoji } from "@/lib/ui/Emoji";
import { ICON } from "@/lib/ui/icons";
import { Chip } from "@/components/ui/Chip";
import { useBoard } from "./BoardContext";

const PURPOSE_ICON: Record<CallPurpose, string> = {
  resident: "🏠",
  sentinel: ICON.sentinel,
  canary: ICON.canary,
  linked_contact: "👪",
  inbound: "📲",
  qrt_callback: ICON.qrt,
  test: ICON.sim,
};

const TRANSPORT_ICON: Record<Transport, string> = { retell: "☎️", browser: "🌐", sim: ICON.sim };

const CAMPAIGN_TONE: Record<Campaign["status"], "info" | "good" | "neutral"> = { running: "info", done: "good", cancelled: "neutral" };

function CallCard({ call, now }: { call: CallView; now: string }) {
  const ringing = call.state === "ringing";
  const since = call.answered_at ?? call.started_at;
  return (
    <article className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <header className="flex items-center gap-1.5">
        <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${ringing ? "bg-blue-500 motion-safe:animate-pulse" : "bg-green-600"}`} />
        <Emoji e={PURPOSE_ICON[call.purpose]} />
        <b className="min-w-0 truncate text-sm">{call.household_name ?? "Inbound caller"}</b>
        {call.device_label ? (
          <Chip tone="info">
            <Emoji e={ICON.phone} /> {call.device_label}
          </Chip>
        ) : null}
        <span className="ml-auto shrink-0 text-xs tabular-nums text-slate-500">
          {ringing ? "ringing" : "on call"}
          {since ? ` ${fmtSpan(Date.parse(now) - Date.parse(since))}` : ""}
        </span>
      </header>
      <div className="mt-0.5 truncate text-xs text-slate-600">
        {PURPOSE_LABEL[call.purpose]} · {call.language} · <Emoji e={TRANSPORT_ICON[call.transport]} /> {TRANSPORT_LABEL[call.transport]}
        {call.attempt > 1 ? ` · attempt ${call.attempt}` : ""}
        {call.simulated ? " · simulated" : ""}
      </div>
      <p className="mt-1 line-clamp-2 text-[13px] italic leading-snug text-slate-800">
        {call.last_line ? `“${call.last_line}”` : <span className="not-italic text-slate-400">…</span>}
      </p>
    </article>
  );
}

function Section({ icon, title, aside, children }: { icon: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
        <Emoji e={icon} /> {title}
        {aside ? <span className="ml-auto font-semibold normal-case tracking-normal text-slate-500">{aside}</span> : null}
      </h3>
      {children}
    </section>
  );
}

/** The Calls view, newest first: live calls, waves, and the last calls to end. */
export function CallsPanel() {
  const { snap } = useBoard();
  const m = snap.metrics;
  const mode = snap.meta.mode;
  const live = snap.calls.filter((c) => c.state === "ringing" || c.state === "active");
  const ended = snap.calls.filter((c) => c.ended_at).slice(0, 8);
  const waves = snap.campaigns.filter((c) => c.kind !== "hold" && c.kind !== "canary").slice(0, 8);

  return (
    <div data-tour="calls" aria-label="Calls" className="space-y-4 p-3">
      <dl className="grid grid-cols-2 gap-2">
        {[
          { icon: ICON.calls, label: "Live now", value: fmtInt(m.calls_active), note: `${fmtInt(m.calls_queued)} queued` },
          { icon: ICON.reached, label: WORDING[mode].reached, value: fmtInt(m.reached), note: `of ${fmtInt(m.in_campaigns)} called` },
          { icon: ICON.understood, label: "Understood", value: fmtPct(m.understood_pct), note: "repeated the plan" },
          { icon: ICON.cost, label: "Cost", value: fmtUsd(m.cost_usd), note: `${m.cost_minutes.toFixed(1)} min · estimate` },
        ].map((s) => (
          <div key={s.label} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <dt className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Emoji e={s.icon} /> {s.label}
            </dt>
            <dd className="text-xl font-black tabular-nums leading-tight text-slate-900">{s.value}</dd>
            <dd className="truncate text-xs text-slate-500">{s.note}</dd>
          </div>
        ))}
      </dl>

      <Section icon={ICON.calls} title="Live now" aside={`${live.length} ringing or connected`}>
        {live.length ? (
          <div className="space-y-2">
            {live.map((c) => (
              <CallCard key={c.id} call={c} now={snap.now} />
            ))}
          </div>
        ) : (
          <p className="rounded-md bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
            No call is ringing right now. Approving a zone to {stateLabel("warning", mode)} starts Stage 1 from the edge nearest the hazard.
          </p>
        )}
      </Section>

      <Section icon={ICON.wave} title="Call waves" aside="edge first, then inward">
        {waves.length ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200 bg-white">
            {waves.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-1.5 text-sm">
                <b className="text-slate-900">{campaignLabel(c)}</b>
                <span className="text-slate-600">{c.zone_name ?? "all zones"}</span>
                <Chip tone={CAMPAIGN_TONE[c.status]} className="ml-auto">
                  {c.status}
                </Chip>
                <span className="w-full text-xs text-slate-500">
                  <Emoji e={ICON.human} /> {c.started_by} · {fmtTime(c.created_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No waves yet.</p>
        )}
      </Section>

      <Section icon={ICON.clock} title="Recently ended">
        {ended.length ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200 bg-white">
            {ended.map((c) => (
              <li key={c.id} className="px-3 py-1.5 text-sm">
                <div className="flex items-center gap-1.5">
                  <Emoji e={PURPOSE_ICON[c.purpose]} />
                  <b className="min-w-0 truncate">{c.household_name ?? "Caller"}</b>
                  <span className="text-xs text-slate-500">{PURPOSE_LABEL[c.purpose]}</span>
                  <time className="ml-auto shrink-0 text-xs tabular-nums text-slate-500" dateTime={c.ended_at ?? undefined}>
                    {fmtTime(c.ended_at)}
                  </time>
                </div>
                {c.summary ? <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-slate-700">{c.summary}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No call has ended yet.</p>
        )}
      </Section>
    </div>
  );
}
