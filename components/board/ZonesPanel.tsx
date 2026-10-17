"use client";

import { useState } from "react";
import type { HouseholdView } from "@/lib/contracts";
import { fmtArea, fmtTime } from "@/lib/client/format";
import { campaignLabel, displayStatus, stateLabel, STATE_TEXT, STATUS_COLOR, statusLabel } from "@/lib/client/labels";
import { STATE_COLOR, STATE_RUNG } from "@/lib/directives";
import type { Hold, Mode, Status, Zone, ZoneState } from "@/lib/types";
import { Emoji, People } from "@/lib/ui/Emoji";
import { ICON, STATE_ICON } from "@/lib/ui/icons";
import { selectZone, useBoardView } from "@/lib/ui/boardView";
import { Button } from "@/components/ui/Button";
import { Chip, ColorChip } from "@/components/ui/Chip";
import { ApproveZoneDialog } from "./ApproveZoneDialog";
import { useBoard } from "./BoardContext";
import { CampaignDialog, type CampaignAction } from "./CampaignDialog";
import { ComposeOrderDialog } from "./ComposeOrderDialog";
import { BlockPlanPanel } from "./BlockPlanPanel";
import { ProposalsPanel } from "./ProposalsPanel";
import { useZonePlan } from "./usePlans";

type Pending = { kind: "approve" | "compose"; zone: Zone } | { kind: "campaign"; zone: Zone; action: CampaignAction };

/** Status groups for the per-zone progress bar; each is named after its first status. */
const GROUPS: Status[][] = [
  ["needs_help"],
  ["wont_leave"],
  ["leaving"],
  ["safe"],
  ["ringing", "on_call"],
  ["queued"],
  ["no_answer", "unclear", "wrong_number"],
  ["unreachable"],
];

/** Most urgent first: the zone the Map view details when nobody has picked one. */
const URGENCY: Record<ZoneState, number> = { order: 5, shelter_in_place: 4, warning: 3, watch: 2, lifted: 1, monitor: 0 };

/** The zone the Map view details: the one picked, else the open hold's, else the most urgent. */
export function useSelectedZone(): Zone | null {
  const { snap, hold } = useBoard();
  const { zoneId } = useBoardView();
  const picked = zoneId ? snap.zones.find((z) => z.id === zoneId) : undefined;
  if (picked) return picked;
  const held = hold ? snap.zones.find((z) => z.id === hold.zone_id) : undefined;
  if (held) return held;
  return snap.zones.reduce<Zone | null>((best, z) => (!best || URGENCY[z.state] > URGENCY[best.state] ? z : best), null);
}

/** "⚠️ Warning" as a filled chip in the state's color. */
export function StateChip({ state, mode, className = "" }: { state: ZoneState; mode: Mode; className?: string }) {
  return (
    <ColorChip className={className} color={STATE_COLOR[state]} text={STATE_TEXT[state]}>
      <Emoji e={STATE_ICON[state]} />
      {stateLabel(state, mode)}
    </ColorChip>
  );
}

function ZoneProgress({ residents, mode }: { residents: HouseholdView[]; mode: Mode }) {
  const statuses = residents.map(displayStatus);
  if (statuses.every((s) => s === "pending")) return null;
  const counts = GROUPS.map((g) => ({
    label: statusLabel(g[0], mode).toLowerCase(),
    color: STATUS_COLOR[g[0]],
    n: statuses.filter((s) => g.includes(s)).length,
  })).filter((g) => g.n);
  return (
    <div className="mt-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        {counts.map((g) => (
          <span key={g.label} style={{ width: `${(100 * g.n) / residents.length}%`, backgroundColor: g.color }} />
        ))}
      </div>
      <p className="mt-0.5 text-xs text-slate-600">
        {counts.map((g) => `${g.n} ${g.label}`).join(" · ")} · of {residents.length} residents
      </p>
    </div>
  );
}

/** One line per zone: state, name, people. Picking one opens its detail below the list. */
function ZoneRow({ zone, selected, hold }: { zone: Zone; selected: boolean; hold: Hold | undefined }) {
  const { snap } = useBoard();
  const mode = snap.meta.mode;
  return (
    <li>
      <button
        type="button"
        onClick={() => selectZone(zone.id)}
        aria-pressed={selected}
        className={`flex w-full items-center gap-2 rounded-md border border-l-[5px] px-2.5 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 motion-reduce:transition-none ${
          selected ? "border-slate-400 bg-slate-50 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"
        }`}
        style={{ borderLeftColor: STATE_COLOR[zone.state] }}
      >
        <Emoji e={STATE_ICON[zone.state]} className="text-base leading-none" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-900">{zone.name}</span>
          <span className="block truncate text-xs text-slate-500">
            {stateLabel(zone.state, mode)}
            {zone.population_est ? (
              <>
                {" · "}
                <People n={zone.population_est} />
              </>
            ) : null}
          </span>
        </span>
        {hold ? (
          <Chip tone="bad">
            <Emoji e={ICON.hold} /> Hold
          </Chip>
        ) : null}
        <span aria-hidden="true" className={`text-slate-400 ${selected ? "text-slate-700" : ""}`}>
          ›
        </span>
      </button>
    </li>
  );
}

/** The picked zone in full: its facts, who approved it, call progress, the actions that fit its state, and its plan. */
function ZoneDetail({ zone, onAction }: { zone: Zone; onAction: (p: Pending) => void }) {
  const { snap } = useBoard();
  const mode = snap.meta.mode;
  const holdOpen = snap.holds.some((h) => h.status === "open" && h.zone_id === zone.id);
  const campaign = snap.campaigns.find((c) => c.zone_id === zone.id && c.kind !== "hold" && c.kind !== "canary");
  const residents = snap.households.filter((h) => h.zone_id === zone.id && h.role === "resident");

  return (
    <article
      data-tour="zone-detail"
      aria-label={`Zone detail: ${zone.name}`}
      className="rounded-lg border border-l-[6px] border-slate-200 bg-white px-3 py-2.5 shadow-sm"
      style={{ borderLeftColor: STATE_COLOR[zone.state] }}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h4 className="min-w-0 truncate text-base font-bold">{zone.name}</h4>
        <span className="font-mono text-xs text-slate-500">{zone.id}</span>
        {holdOpen ? (
          <Chip tone="bad">
            <Emoji e={ICON.hold} /> Hold open
          </Chip>
        ) : null}
        <StateChip state={zone.state} mode={mode} className="ml-auto" />
      </header>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-700">
        <li>{zone.population_est ? <People n={zone.population_est} /> : "Population not estimated"}</li>
        {zone.area_sq_mi ? <li>{fmtArea(zone.area_sq_mi)} sq mi</li> : null}
        <li>Rung: {STATE_RUNG[zone.state]}</li>
        {zone.evac_point ? (
          <li className="min-w-0">
            <Emoji e={ICON.evac} /> {zone.evac_point.split(",")[0]}
          </li>
        ) : null}
      </ul>
      {campaign ? (
        <p className="mt-1 text-xs text-slate-600">
          <Emoji e={ICON.wave} /> <b className="text-slate-800">{campaignLabel(campaign)}</b>{" "}
          {campaign.status === "running" ? "running" : campaign.status} since {fmtTime(campaign.created_at)}, started by {campaign.started_by}
        </p>
      ) : null}
      {zone.approved_by ? (
        <p className="mt-0.5 text-xs text-slate-500">
          <Emoji e={ICON.human} /> Approved by {zone.approved_by} at {fmtTime(zone.approved_at)}
        </p>
      ) : null}
      <ZoneProgress residents={residents} mode={mode} />
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Button size="sm" variant="primary" onClick={() => onAction({ kind: "approve", zone })}>
          Change state…
        </Button>
        {zone.state === "warning" ? (
          <>
            <Button size="sm" onClick={() => onAction({ kind: "campaign", zone, action: "stage2" })}>
              Stage 2 check
            </Button>
            {holdOpen ? null : (
              <Button size="sm" data-tour="compose-order" onClick={() => onAction({ kind: "compose", zone })}>
                <Emoji e={STATE_ICON.order} /> Compose Order (opens hold)
              </Button>
            )}
          </>
        ) : null}
        {zone.state === "order" || zone.state === "shelter_in_place" ? (
          <Button size="sm" onClick={() => onAction({ kind: "campaign", zone, action: "rollcall" })}>
            Roll call
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => onAction({ kind: "campaign", zone, action: "test" })}>
          Monthly test call
        </Button>
      </div>
      <ZonePlan zoneId={zone.id} />
    </article>
  );
}

/** The zone's block-by-block evacuation plan, when it has one (zones with exit roads set up). */
function ZonePlan({ zoneId }: { zoneId: string }) {
  const plan = useZonePlan(zoneId);
  if (!plan || plan.status === "rejected" || plan.status === "closed") return null;
  return (
    <div data-slot="zone-plan" className="mt-3">
      <BlockPlanPanel zoneId={zoneId} />
    </div>
  );
}

/** The Map view's column: proposals first (they need a human), a compact zone list, and the picked zone in detail. */
export function ZonesPanel() {
  const { snap } = useBoard();
  const [pending, setPending] = useState<Pending | null>(null);
  const selected = useSelectedZone();
  const close = () => setPending(null);
  const openHolds = snap.holds.filter((h) => h.status === "open");

  return (
    <div className="space-y-3 p-3">
      <ProposalsPanel />
      <section data-tour="zones" aria-label="Zones">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
          <Emoji e={ICON.map} /> Zones <span className="font-semibold normal-case tracking-normal text-slate-500">· a named human sets every state</span>
        </h3>
        {snap.zones.length ? (
          <ul className="space-y-1">
            {snap.zones.map((z) => (
              <ZoneRow key={z.id} zone={z} selected={z.id === selected?.id} hold={openHolds.find((h) => h.zone_id === z.id)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No zones loaded. Pick a scenario in the sidebar.</p>
        )}
      </section>
      {selected ? <ZoneDetail zone={selected} onAction={setPending} /> : null}
      {pending?.kind === "approve" ? <ApproveZoneDialog zone={pending.zone} onClose={close} /> : null}
      {pending?.kind === "compose" ? <ComposeOrderDialog zone={pending.zone} onClose={close} /> : null}
      {pending?.kind === "campaign" ? <CampaignDialog zone={pending.zone} action={pending.action} onClose={close} /> : null}
    </div>
  );
}
