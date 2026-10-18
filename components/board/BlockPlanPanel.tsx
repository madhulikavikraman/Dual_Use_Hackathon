"use client";

import { useEffect, useMemo, useState } from "react";
import {
  blockMessage, blockWords, capPerWave, firstWave, holdReleaseAt, lastWaveStartMin, overloads, roadFloorH, sharedRoads, templatesOf, waveCount,
  type PlanTemplates, type TemplateKey,
} from "@/lib/engine/blocks";
import { LEAVE_IF_UNSAFE } from "@/lib/directives";
import type { EvacBlock, EvacPlan, Zone } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useBoard } from "./BoardContext";
import { DecisionDialog } from "./DecisionDialog";
import {
  BLOCK_COLOR,
  BLOCK_EMOJI,
  BLOCK_LABEL,
  fmtN,
  loadColor,
  PLAN_STATUS_EMOJI,
  PLAN_STATUS_LABEL,
  shownWave,
} from "./blockLabels";
import * as planApi from "./planApi";
import { refreshPlans, usePlans, useZonePlan } from "./usePlans";

// Block-by-block evacuation: the plan panel for the board's sidebar. Waves, blocks, each exit road's load per wave,
// and the three controls (start the next wave, hold it, everyone go now). A proposed plan is approved here by a
// named human with a reason. Mount it anywhere inside <BoardProvider>; it picks the plan to show on its own.

type Action = "approve" | "reject" | "advance" | "hold" | "release" | "go_now";

const PRIORITY: Record<EvacPlan["status"], number> = { all_go: 0, active: 1, proposed: 2, standby: 3, rejected: 9, closed: 9 };

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function span(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
}

/** "45 min", "2.5 h" (to the quarter hour). */
const hoursText = (min: number) => (min < 60 ? `${Math.round(min)} min` : `${(Math.round((min / 60) * 4) / 4).toLocaleString("en-US")} h`);

/** "🏃 Wave 1 now: about 3,280 people in 4 blocks", for the hold's dose preview (HoldStrip can mount this). */
export function HoldWaveDose({ zoneId, className = "" }: { zoneId: string; className?: string }) {
  const plan = useZonePlan(zoneId);
  if (!plan) return null;
  const w = firstWave(plan);
  return (
    <p className={`text-sm font-semibold leading-snug text-red-800 ${className}`}>
      <span aria-hidden="true">🏃 </span>
      Wave {w.wave} now: about {fmtN(w.people)} people in {w.blocks} block{w.blocks === 1 ? "" : "s"}
      {plan.status === "proposed" ? <span className="font-normal text-slate-600"> if the block plan is approved</span> : null}
    </p>
  );
}

/** The block plan panel. Without `zoneId` it shows the most urgent plan and lets the viewer switch zones. */
export function BlockPlanPanel({ zoneId }: { zoneId?: string }) {
  const plans = usePlans();
  const { zoneById, refresh, clockOffset } = useBoard();
  const ordered = useMemo(
    () => [...plans].sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status] || a.zone_id.localeCompare(b.zone_id)),
    [plans],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const plan = ordered.find((p) => p.zone_id === (zoneId ?? picked)) ?? (zoneId ? null : ordered[0] ?? null);
  const zone = plan ? zoneById.get(plan.zone_id) : undefined;

  if (!plan || !zone) {
    return (
      <section data-tour="block-plan" className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <span aria-hidden="true">🚦</span> Block by block
        </h2>
        <p className="mt-1">No block plan yet. One is proposed when an Order is composed for a zone with exit roads set up.</p>
      </section>
    );
  }

  return (
    <section data-tour="block-plan" aria-labelledby="block-plan-title" className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="block-plan-title" className="flex items-center gap-1.5 text-base font-bold text-slate-900">
            <span aria-hidden="true">🚦</span> Block by block
          </h2>
          <p className="text-xs text-slate-600">
            Moves people out in waves, nearest the fire first, so no road jams. Patches up to about half a mile (800 m) on a side; several go in
            each wave.
          </p>
        </div>
        {!zoneId && ordered.length > 1 ? (
          <label className="text-xs font-semibold text-slate-700">
            <span className="sr-only">Zone</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              value={plan.zone_id}
              onChange={(e) => setPicked(e.target.value)}
            >
              {ordered.map((p) => (
                <option key={p.zone_id} value={p.zone_id}>
                  {zoneById.get(p.zone_id)?.name ?? p.zone_id}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>
      <PlanBody plan={plan} zone={zone} others={plans} zoneName={(id) => zoneById.get(id)?.name ?? id} clockOffset={clockOffset} onDone={refresh} />
    </section>
  );
}

function PlanBody({ plan, zone, others, zoneName, clockOffset, onDone }: {
  plan: EvacPlan; zone: Zone; others: EvacPlan[]; zoneName: (id: string) => string; clockOffset: number; onDone: () => void;
}) {
  const total = waveCount(plan);
  const shared = sharedRoads(plan, others);
  const cars = plan.blocks.reduce((t, b) => t + b.vehicles_est, 0);
  const people = plan.blocks.reduce((t, b) => t + b.people_est, 0);
  const [selected, setSelected] = useState<number | null>(null);
  const wave = Math.min(total, Math.max(1, selected ?? shownWave(plan, total)));
  const [action, setAction] = useState<Action | null>(null);
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + clockOffset), 1000);
    return () => clearInterval(t);
  }, [clockOffset]);

  const running = plan.status === "active";
  const order = zone.state === "order";
  const done = running && plan.current_wave > total;
  const nextIn = running && plan.wave_started_at && !done ? Date.parse(plan.wave_started_at) + plan.wave_minutes * 60_000 - now : null;
  const releaseAt = running ? holdReleaseAt(plan) : null;
  const over = overloads(plan);

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-slate-900">{zone.name}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${
            plan.status === "proposed"
              ? "bg-amber-50 text-amber-900 ring-amber-300"
              : plan.status === "all_go"
                ? "bg-red-700 text-white ring-red-700"
                : "bg-emerald-50 text-emerald-900 ring-emerald-300"
          }`}
        >
          <span aria-hidden="true">{PLAN_STATUS_EMOJI[plan.status]}</span>
          {PLAN_STATUS_LABEL[plan.status]}
        </span>
      </div>
      {plan.approved_by ? (
        <p className="-mt-2 text-xs text-slate-600">
          <span aria-hidden="true">✍️ </span>Approved by {plan.approved_by}
          {plan.reason ? `: ${plan.reason}` : ""}
        </p>
      ) : (
        <p className="-mt-2 text-xs text-amber-900">
          <span aria-hidden="true">⚠️ </span>Proposed by {plan.proposed_by}. Until a named human approves it, every call reads the full Order.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-1.5 text-[13px]" aria-label="Plan at a glance">
        <Stat emoji="🏘️" label="blocks" value={fmtN(plan.blocks.length)} />
        <Stat emoji="🌊" label={`waves of ${plan.wave_minutes} min`} value={fmtN(total)} />
        <Stat emoji="👥" label="people (est.)" value={`~${fmtN(people)}`} />
        <Stat emoji="🚗" label="cars (est.)" value={`~${fmtN(cars)}`} />
      </ul>

      {running || plan.status === "all_go" ? (
        <p className="rounded-md bg-slate-50 px-2.5 py-2 text-[13px] ring-1 ring-inset ring-slate-200" aria-live="polite">
          {plan.status === "all_go" ? (
            <>
              <span aria-hidden="true">🚨 </span>
              <b>Everyone go now.</b> Every block leaves on its own road.
            </>
          ) : done ? (
            <>
              <span aria-hidden="true">✅ </span>All {total} waves have started. People not confirmed out are still called.
            </>
          ) : (
            <>
              <span aria-hidden="true">🏃 </span>
              <b>
                Wave {plan.current_wave} of {total} going now.
              </b>{" "}
              {plan.held ? (
                <>
                  <span aria-hidden="true">⏸️ </span>Wave {plan.current_wave + 1} held by {plan.held_by}.{" "}
                  {nextIn !== null && nextIn < 0 ? (
                    <b className="text-red-700">Held {span(-nextIn)} past its start. </b>
                  ) : null}
                  {releaseAt !== null ? <>The wave clock releases it in about {span(releaseAt - now)}.</> : null}
                </>
              ) : nextIn !== null ? (
                <>Wave {plan.current_wave + 1} starts in about {span(nextIn)}.</>
              ) : null}
            </>
          )}
        </p>
      ) : plan.status === "standby" ? (
        <p className="rounded-md bg-slate-50 px-2.5 py-2 text-[13px] ring-1 ring-inset ring-slate-200">
          <span aria-hidden="true">🕒 </span>Stands by. Wave 1 starts the moment an Order is sent for {zone.name}.
        </p>
      ) : null}

      <Controls plan={plan} zone={zone} order={order} done={done} last={running && plan.current_wave >= total} onAction={setAction} />

      {shared.length ? (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-950">
          <span aria-hidden="true">🛣️ </span>
          <b>Shared roads:</b>{" "}
          {shared.map((s) => `${s.route.short} (also ${s.zones.map(zoneName).join(", ")})`).join("; ")}. Another zone&apos;s running plan uses
          the same street. Plans packed after it leave room for its cars; watch these roads.
        </p>
      ) : null}

      <WaveStrip plan={plan} total={total} wave={wave} onPick={setSelected} />
      <WaveDetail plan={plan} zone={zone} wave={wave} />

      {over.length ? (
        <p role="status" className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs text-red-900">
          <span aria-hidden="true">🔥 </span>
          Over capacity after a pull-forward: {over.map((o) => `wave ${o.wave} on ${plan.routes.find((r) => r.id === o.route_id)?.short ?? o.route_id}`).join(", ")}.
          Moving people sooner always wins over the road's limit.
        </p>
      ) : null}

      <Messages plan={plan} zone={zone} />

      <p className="text-[11px] leading-snug text-slate-500">
        <span aria-hidden="true">ℹ️ </span>
        {plan.assumptions}
      </p>

      {action ? <ActionDialog action={action} plan={plan} zone={zone} onClose={() => setAction(null)} onDone={onDone} /> : null}
    </>
  );
}

function Stat({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <li className="flex items-baseline gap-1.5 rounded-md bg-slate-50 px-2 py-1 ring-1 ring-inset ring-slate-200">
      <span aria-hidden="true">{emoji}</span>
      <b className="text-slate-900">{value}</b>
      <span className="truncate text-slate-600">{label}</span>
    </li>
  );
}

function Controls({ plan, zone, order, done, last, onAction }: {
  plan: EvacPlan; zone: Zone; order: boolean; done: boolean; last: boolean; onAction: (a: Action) => void;
}) {
  const running = plan.status === "active";
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Block plan controls for ${zone.name}`}>
      {plan.status === "proposed" ? (
        <>
          <Button size="sm" variant="primary" onClick={() => onAction("approve")}>
            <span aria-hidden="true">✅</span> Approve plan
          </Button>
          <Button size="sm" onClick={() => onAction("reject")}>
            <span aria-hidden="true">✖️</span> Reject
          </Button>
        </>
      ) : null}
      {running ? (
        <>
          <Button size="sm" variant="primary" disabled={done} onClick={() => onAction("advance")}>
            <span aria-hidden="true">⏭️</span> Start next wave
          </Button>
          {plan.held ? (
            <Button size="sm" onClick={() => onAction("release")}>
              <span aria-hidden="true">▶️</span> {last || done ? "Clear the hold" : `Release wave ${plan.current_wave + 1}`}
            </Button>
          ) : (
            <Button size="sm" disabled={done || last} title={last ? "This is the last wave: there is no next wave to hold" : undefined} onClick={() => onAction("hold")}>
              <span aria-hidden="true">⏸️</span> Hold next wave
            </Button>
          )}
        </>
      ) : null}
      {order && plan.status !== "all_go" ? (
        <Button size="sm" variant="danger" onClick={() => onAction("go_now")}>
          <span aria-hidden="true">🚨</span> Everyone go now
        </Button>
      ) : null}
    </div>
  );
}

function waveState(plan: EvacPlan, n: number): EvacBlock["status"] {
  if (plan.status === "all_go") return n < plan.current_wave ? "left" : "go_now";
  if (plan.status !== "active") return "ready";
  if (n < plan.current_wave) return "left";
  if (n === plan.current_wave) return "go_now";
  if (n === plan.current_wave + 1) return plan.held ? "hold" : "next";
  return "ready";
}

function WaveStrip({ plan, total, wave, onPick }: { plan: EvacPlan; total: number; wave: number; onPick: (n: number) => void }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-600">Waves</h3>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Pick a wave to see its blocks and road loads">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
          const s = waveState(plan, n);
          const w = plan.waves.find((x) => x.n === n);
          return (
            <button
              key={n}
              type="button"
              aria-pressed={n === wave}
              onClick={() => onPick(n)}
              title={`Wave ${n}: ${BLOCK_LABEL[s]}${w ? `, ${w.started_at ? "started" : "planned"} ${clock(w.planned_at)}` : ""}`}
              className={`inline-flex h-7 min-w-9 items-center justify-center gap-0.5 rounded-md px-1.5 text-xs font-bold ring-1 ring-inset focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                n === wave ? "ring-2 ring-slate-900" : "ring-slate-300"
              }`}
              style={{ background: `${BLOCK_COLOR[s]}${s === "go_now" ? "" : "33"}`, color: s === "go_now" ? "#fff" : "#0f172a" }}
            >
              <span aria-hidden="true">{BLOCK_EMOJI[s]}</span>
              <span>
                <span className="sr-only">Wave </span>
                {n}
                <span className="sr-only">, {BLOCK_LABEL[s]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WaveDetail({ plan, zone, wave }: { plan: EvacPlan; zone: Zone; wave: number }) {
  const w = plan.waves.find((x) => x.n === wave);
  const blocks = plan.blocks.filter((b) => b.wave === wave);
  const s = waveState(plan, wave);
  const before = plan.status === "proposed" || plan.status === "standby";
  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-2.5">
      <p className="flex flex-wrap items-center gap-1.5 text-[13px]">
        <b className="text-slate-900">Wave {wave}</b>
        <span className="rounded-full px-1.5 text-xs font-bold" style={{ background: `${BLOCK_COLOR[s]}26`, color: "#0f172a" }}>
          <span aria-hidden="true">{BLOCK_EMOJI[s]} </span>
          {BLOCK_LABEL[s]}
        </span>
        {w ? (
          <span className="text-slate-600">
            {w.started_at ? `started ${clock(w.started_at)}` : before ? `${(wave - 1) * plan.wave_minutes} min after the plan starts` : `planned ${clock(w.planned_at)}`}
          </span>
        ) : null}
      </p>
      <ul className="flex flex-wrap gap-1" aria-label={`Blocks in wave ${wave}`}>
        {blocks.map((b) => (
          <li
            key={b.id}
            className="rounded-md bg-white px-1.5 py-0.5 text-xs ring-1 ring-inset"
            style={{ boxShadow: `inset 3px 0 0 ${BLOCK_COLOR[b.status]}` }}
            title={`${b.id}: about ${fmtN(b.people_est)} people, ${fmtN(b.vehicles_est)} cars (estimates)${b.households ? `, ${b.households} on the roster` : ""}${b.pulled_forward ? `. Pulled forward: ${b.pulled_forward}` : ""}`}
          >
            <b>{b.id}</b>
            {b.pulled_forward ? <span aria-label="pulled forward by the fire model"> 🔥</span> : null}
            <span className="text-slate-600">
              {" "}
              · <span aria-hidden="true">👥</span>
              <span className="sr-only">people</span> {fmtN(b.people_est)} · <span aria-hidden="true">🚗</span>
              <span className="sr-only">cars</span> {fmtN(b.vehicles_est)}
            </span>
          </li>
        ))}
      </ul>
      <div>
        <h4 className="mb-1 text-xs font-bold text-slate-700">
          <span aria-hidden="true">🛣️ </span>Exit roads in wave {wave}
        </h4>
        <ul className="space-y-1.5">
          {plan.routes.map((r) => {
            const carsOn = w?.load[r.id] ?? 0;
            const cap = capPerWave(r, plan.wave_minutes);
            const pct = cap ? Math.round((carsOn / cap) * 100) : 0;
            return (
              <li key={r.id}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-semibold text-slate-800" title={r.name}>
                    {r.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-700">
                    {fmtN(carsOn)} / {fmtN(cap)} cars · <b style={{ color: loadColor(pct) }}>{pct}%</b>
                  </span>
                </div>
                <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: loadColor(pct) }} />
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {r.lanes} lane{r.lanes === 1 ? "" : "s"} out × {fmtN(r.per_lane_vph)} cars an hour (planning assumption)
                </p>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="sr-only">Zone {zone.name}.</p>
    </div>
  );
}

function Messages({ plan, zone }: { plan: EvacPlan; zone: Zone }) {
  const first = plan.blocks.find((b) => b.wave === Math.max(1, plan.current_wave)) ?? plan.blocks[0];
  const later = plan.blocks.find((b) => b.wave > Math.max(1, plan.current_wave));
  if (!first) return null;
  const goNow: EvacPlan = { ...plan, status: plan.status === "all_go" ? "all_go" : "active", current_wave: first.wave, held: false };
  return (
    <details className="rounded-md border border-slate-200 p-2.5 text-[13px]">
      <summary className="cursor-pointer font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
        <span aria-hidden="true">📞 </span>What residents hear (approved words, filled from the plan)
      </summary>
      <p className="mt-2 text-xs font-semibold text-slate-600">A block going now:</p>
      <blockquote className="border-l-4 border-red-600 pl-2 text-slate-800">“{blockMessage(goNow, first, zone, plan.status === "all_go" ? "all_go" : "go_now")}”</blockquote>
      {later && plan.status !== "all_go" ? (
        <>
          <p className="mt-2 text-xs font-semibold text-slate-600">A block in a later wave (called again when its wave starts), in place of the Order text:</p>
          <blockquote className="border-l-4 border-yellow-500 pl-2 text-slate-800">
            “{blockWords(plan, later, zone, "get_ready").directive_text} {blockMessage(plan, later, zone, "get_ready")}”
          </blockquote>
          <p className="mt-2 text-xs font-semibold text-slate-600">
            Exception: people who need extra time to leave (access and functional needs on file, or an open help row) do not wait for their wave:
          </p>
          <blockquote className="border-l-4 border-red-600 pl-2 text-slate-800">“{blockMessage(plan, later, zone, "extra_time")}”</blockquote>
        </>
      ) : null}
      <p className="mt-2 text-xs text-slate-600">
        Blocks going now hear the zone&apos;s approved Order first. The agent never gives an arrival time and never says anyone is safe.
      </p>
    </details>
  );
}

const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  go_now: "Wave going now (must say “leave now”)",
  get_ready_directive: "Later waves: read in place of the Order text (must keep the leave-right-away line; never “leave now”)",
  get_ready: "Later waves: route line (must keep the leave-right-away line)",
  extra_time: "People who need extra time, in a later wave (must say “leave now”)",
  all_go: "Everyone go now (must say “leave now”)",
};

const SUGGEST: Record<Action, string[]> = {
  approve: ["Roads are open; nearest the fire first", "Exit roads checked with traffic control"],
  reject: ["Roads are not confirmed; everyone hears the full Order", "Fire is too close for waves"],
  advance: ["Wave clear on the roads; next wave now", "Fire is moving faster; start the next wave"],
  hold: ["Crash on an exit road", "Road blocked by fire equipment"],
  release: ["Road is open again", "Traffic control in place"],
  go_now: ["Fire moved faster than the plan", "Spot fires inside the zone"],
};

function ActionDialog({ action, plan, zone, onClose, onDone }: { action: Action; plan: EvacPlan; zone: Zone; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [minutes, setMinutes] = useState(plan.wave_minutes);
  const [templates, setTemplates] = useState<Required<PlanTemplates>>(() => templatesOf(plan));
  const next = plan.current_wave + 1;
  const total = waveCount(plan);
  // How long the plan runs: the last wave's start, beside the floor the roads set (every car at full road capacity).
  const runs = `The last wave starts about ${hoursText(lastWaveStartMin(plan))} after wave 1 (the roads need at least about ${hoursText(roadFloorH(plan) * 60)} for every car).`;
  const title: Record<Action, string> = {
    approve: `Approve the block plan for ${zone.name}`,
    reject: `Reject the block plan for ${zone.name}`,
    advance: `Start wave ${next} now`,
    hold: `Hold wave ${next}`,
    release: `Release wave ${next}`,
    go_now: `Everyone in ${zone.name} goes now`,
  };
  const description: Record<Action, string> = {
    approve:
      zone.state === "order"
        ? `${plan.blocks.length} blocks in ${total} waves of ${plan.wave_minutes} min. ${runs} Wave 1 goes now; later waves hear when to get ready, and to leave right away if they see fire or smoke or feel unsafe. People who need extra time leave now. The Order stays the Order for the whole zone.`
        : `${plan.blocks.length} blocks in ${total} waves of ${plan.wave_minutes} min. ${runs} The plan stands by and starts with wave 1 when an Order is sent.`,
    reject: "Every call reads the full Order: everyone leaves now by the zone's approved route.",
    advance: `Wave ${next} blocks hear "leave now" on their roads. Calls start at once.`,
    hold: `Wave ${plan.current_wave} keeps going. Wave ${next} waits until you release it, or one wave length (${plan.wave_minutes} min) past its start at most: then the wave clock releases it. Residents waiting still hear: ${LEAVE_IF_UNSAFE}`,
    release: `Wave ${next} may start on the wave clock again.`,
    go_now: `All ${plan.blocks.length} blocks leave at once, each on its own road. Roads may jam; use this when the fire is faster than the plan.`,
  };
  const label: Record<Action, string> = {
    approve: "Approve plan", reject: "Reject plan", advance: `Start wave ${next}`, hold: `Hold wave ${next}`, release: "Release", go_now: "Everyone go now",
  };
  return (
    <DecisionDialog
      title={title[action]}
      description={description[action]}
      confirmLabel={label[action]}
      danger={action === "go_now"}
      size={action === "approve" ? "lg" : "md"}
      reasonSuggestions={SUGGEST[action]}
      onClose={onClose}
      onConfirm={async (s) => {
        if (action === "approve") {
          const before = templatesOf(plan);
          const changed = Object.fromEntries(Object.entries(templates).filter(([k, v]) => v !== before[k as TemplateKey]));
          await planApi.approvePlan(zone.id, s, { wave_minutes: minutes !== plan.wave_minutes ? minutes : undefined, templates: changed });
        } else if (action === "reject") await planApi.rejectPlan(zone.id, s);
        else if (action === "advance") await planApi.advanceWave(zone.id, s);
        else if (action === "hold") await planApi.holdWave(zone.id, s);
        else if (action === "release") await planApi.holdWave(zone.id, s, true);
        else await planApi.everyoneGoNow(zone.id, s);
        toast(`${label[action]}: done`, "good");
        await refreshPlans();
        onDone();
      }}
    >
      {action === "approve" ? (
        <div className="space-y-3">
          <label className="block text-[13px] font-semibold text-slate-800">
            Wave length (minutes)
            <select className={`${inputClass} mt-1`} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[...new Set([plan.wave_minutes, 10, 15, 20, 30, 45, 60])].sort((a, b) => a - b).map((m) => (
                <option key={m} value={m}>
                  {m} min{m === plan.wave_minutes ? " (planned)" : ""}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              A different length re-plans the waves. A patch with more cars than its road carries in one wave is cut into smaller patches.
            </span>
          </label>
          <details className="rounded-md border border-slate-200 p-2">
            <summary className="cursor-pointer text-[13px] font-semibold text-slate-800">The words the agent reads (edit if needed)</summary>
            {(["go_now", "get_ready_directive", "get_ready", "extra_time", "all_go"] as const).map((k) => (
              <label key={k} className="mt-2 block text-xs font-semibold text-slate-700">
                {TEMPLATE_LABEL[k]}
                <textarea
                  className={`${inputClass} mt-1 text-sm`}
                  rows={k === "get_ready" || k === "get_ready_directive" ? 4 : 2}
                  value={templates[k]}
                  onChange={(e) => setTemplates((t) => ({ ...t, [k]: e.target.value }))}
                />
              </label>
            ))}
            <p className="mt-1 text-[11px] text-slate-500">Filled in from the plan: {"{block}"}, {"{wave}"}, {"{time}"}, {"{route}"}, {"{to_evac}"}, {"{zone}"}.</p>
          </details>
        </div>
      ) : null}
    </DecisionDialog>
  );
}
