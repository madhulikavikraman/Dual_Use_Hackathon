"use client";

import { useState } from "react";
import type { HouseholdView } from "@/lib/contracts";
import { fmtArea, fmtPeople, fmtTime } from "@/lib/client/format";
import { campaignLabel, displayStatus, stateLabel, STATE_TEXT, STATUS_COLOR, statusLabel } from "@/lib/client/labels";
import { STATE_COLOR, STATE_RUNG } from "@/lib/directives";
import type { Mode, Status, Zone } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Chip, ColorChip } from "@/components/ui/Chip";
import { ApproveZoneDialog } from "./ApproveZoneDialog";
import { useBoard } from "./BoardContext";
import { CampaignDialog, type CampaignAction } from "./CampaignDialog";
import { ComposeOrderDialog } from "./ComposeOrderDialog";
import { ProposalsPanel } from "./ProposalsPanel";

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

function ZoneProgress({ residents, mode }: { residents: HouseholdView[]; mode: Mode }) {
  const statuses = residents.map(displayStatus);
  if (statuses.every((s) => s === "pending")) return null;
  const counts = GROUPS.map((g) => ({
    label: statusLabel(g[0], mode).toLowerCase(),
    color: STATUS_COLOR[g[0]],
    n: statuses.filter((s) => g.includes(s)).length,
  })).filter((g) => g.n);
  return (
    <div className="mt-1.5">
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

function ZoneCard({ zone, onAction }: { zone: Zone; onAction: (p: Pending) => void }) {
  const { snap } = useBoard();
  const mode = snap.meta.mode;
  const holdOpen = snap.holds.some((h) => h.status === "open" && h.zone_id === zone.id);
  const campaign = snap.campaigns.find((c) => c.zone_id === zone.id && c.kind !== "hold" && c.kind !== "canary");
  const residents = snap.households.filter((h) => h.zone_id === zone.id && h.role === "resident");

  return (
    <article className="rounded-md border border-l-[6px] border-slate-200 bg-white px-3 py-2" style={{ borderLeftColor: STATE_COLOR[zone.state] }}>
      <header className="flex items-center gap-2">
        <h4 className="min-w-0 truncate text-[15px] font-bold">{zone.name}</h4>
        <span className="font-mono text-xs text-slate-500">{zone.id}</span>
        {holdOpen ? <Chip tone="bad">Hold open</Chip> : null}
        <ColorChip className="ml-auto" color={STATE_COLOR[zone.state]} text={STATE_TEXT[zone.state]}>
          {stateLabel(zone.state, mode)}
        </ColorChip>
      </header>
      <p className="mt-0.5 text-sm text-slate-600">
        {zone.population_est ? `about ${fmtPeople(zone.population_est)} people` : "population not estimated"}
        {zone.area_sq_mi ? ` · ${fmtArea(zone.area_sq_mi)} sq mi` : ""} · rung: {STATE_RUNG[zone.state]}
        {zone.evac_point ? <> · evacuation point: {zone.evac_point.split(",")[0]}</> : null}
      </p>
      {campaign ? (
        <p className="mt-0.5 text-xs text-slate-600">
          <b className="text-slate-800">{campaignLabel(campaign)}</b> {campaign.status === "running" ? "running" : campaign.status} since{" "}
          {fmtTime(campaign.created_at)}, started by {campaign.started_by}
        </p>
      ) : null}
      {zone.approved_by ? (
        <p className="mt-0.5 text-xs text-slate-500">
          Approved by {zone.approved_by} at {fmtTime(zone.approved_at)}
        </p>
      ) : null}
      <ZoneProgress residents={residents} mode={mode} />
      <div className="mt-2 flex flex-wrap gap-1.5">
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
                Compose Order (opens hold)
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
    </article>
  );
}

/** Proposals first (they need a human), then every zone with its state and the actions that fit it. */
export function ZonesPanel() {
  const { snap } = useBoard();
  const [pending, setPending] = useState<Pending | null>(null);
  const close = () => setPending(null);

  return (
    <div className="space-y-4 p-3">
      <ProposalsPanel />
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">Zones · a named human sets every state</h3>
        {snap.zones.length ? (
          <div className="space-y-2">
            {snap.zones.map((z) => (
              <ZoneCard key={z.id} zone={z} onAction={setPending} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No zones loaded. Reset a scenario from the header.</p>
        )}
      </section>
      {pending?.kind === "approve" ? <ApproveZoneDialog zone={pending.zone} onClose={close} /> : null}
      {pending?.kind === "compose" ? <ComposeOrderDialog zone={pending.zone} onClose={close} /> : null}
      {pending?.kind === "campaign" ? <CampaignDialog zone={pending.zone} action={pending.action} onClose={close} /> : null}
    </div>
  );
}
