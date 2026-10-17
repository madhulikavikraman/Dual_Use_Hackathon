"use client";

import { useState } from "react";
import type { ApproveZoneResult } from "@/lib/contracts";
import { approveZone, decideProposal, type Signed } from "@/lib/client/api";
import { fmtArea, fmtPeople } from "@/lib/client/format";
import { campaignLabel, MODEL_LABEL, stateLabel, STATE_TEXT } from "@/lib/client/labels";
import { STATE_COLOR, STATE_RUNG } from "@/lib/directives";
import { ZONE_STATES, type Proposal, type Zone, type ZoneState } from "@/lib/types";
import { ColorChip } from "@/components/ui/Chip";
import { Field, inputClass } from "@/components/ui/Field";
import { useAct, useBoard } from "./BoardContext";
import { DecisionDialog } from "./DecisionDialog";
import { useZoneTexts } from "./useZoneTexts";
import { ZoneTextFields } from "./ZoneTextFields";

/** What each rung does once approved (PRD 6.1), shown under the ladder select. */
const WHAT_HAPPENS: Record<ZoneState, string> = {
  monitor: "Nothing calls anyone. Pattern watch keeps running in the background.",
  watch: "The sentinel roster is warmed. No resident is called unless you start a call.",
  warning:
    "Starts Stage 1: calls sweep the zone from the edge nearest the hazard inward, about 200 m per ring; people with access and functional needs ring first in each ring.",
  order: "Opens a 90-second hold with sentinels before the send (simulated). On Send, Stage 3 relays the Order.",
  shelter_in_place: "Earthquake, hazmat or active-threat mode. The registry puts trapped or injured people first.",
  lifted: "A human-only word: the agent never says a zone is clear.",
};

function resultMessage(zone: Zone, label: string, r: ApproveZoneResult | null | undefined): string {
  if (r?.hold) return `Hold opened for ${zone.name}: sentinels ringing at the edges`;
  if (r?.campaign) return `${campaignLabel(r.campaign)} calls started in ${zone.name}`;
  return `${zone.name} is now ${label}`;
}

/**
 * Change a zone's state (or approve a model proposal): the ladder, the three approved texts, and the
 * human's name and reason. Approving an Order opens a hold unless an incident commander bypasses it.
 */
export function ApproveZoneDialog({ zone, proposal, onClose }: { zone: Zone; proposal?: Proposal; onClose: () => void }) {
  const { snap } = useBoard();
  const act = useAct();
  const mode = snap.meta.mode;
  const [state, setState] = useState<ZoneState>(proposal?.proposed_state ?? zone.state);
  const [bypass, setBypass] = useState(false);
  const { texts, fromServer, edit } = useZoneTexts(zone, state, mode);
  const label = stateLabel(state, mode);

  async function confirm({ actor, reason }: Signed) {
    if (!texts) return;
    const evac = texts.evac_point.trim() || null;
    if (proposal) {
      await act(
        () =>
          decideProposal(proposal.id, {
            decision: "approve",
            actor,
            reason,
            directive_text: texts.directive_text,
            move_text: texts.move_text,
            evac_point: evac,
          }),
        (r) => resultMessage(zone, label, r?.result),
      );
      return;
    }
    await act(
      () =>
        approveZone(zone.id, {
          state,
          directive_text: texts.directive_text,
          move_text: texts.move_text,
          evac_point: evac,
          approved_by: actor,
          reason,
          ...(state === "order" && bypass ? { bypass_hold: true } : {}),
        }),
      (r) => resultMessage(zone, label, r),
    );
  }

  return (
    <DecisionDialog
      size="lg"
      title={proposal ? `Approve the model's proposal for ${zone.name}` : `Change state: ${zone.name}`}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          Now <ColorChip color={STATE_COLOR[zone.state]} text={STATE_TEXT[zone.state]}>{stateLabel(zone.state, mode)}</ColorChip>
          {zone.population_est ? (
            <span>
              · about {fmtPeople(zone.population_est)} people{zone.area_sq_mi ? ` across ${fmtArea(zone.area_sq_mi)} sq mi` : ""} (estimate)
            </span>
          ) : null}
        </span>
      }
      confirmLabel={state === "order" && !bypass ? "Approve and open the hold" : `Approve: ${label}`}
      canSubmit={texts !== null && (state === "monitor" || texts.directive_text.trim().length > 0)}
      reasonPlaceholder={proposal ? "Why you agree with the model" : "Why this zone, why now"}
      reasonSuggestions={
        state === "warning"
          ? ["Fire envelope reaches the zone's edge", "Duty officer requested a Warning"]
          : state === "order"
            ? ["Duty officer requests an Order", "Envelope reached the zone edge"]
            : []
      }
      onConfirm={confirm}
      onClose={onClose}
    >
      {proposal ? (
        <div className="rounded-md border-2 border-dashed px-3 py-2 text-sm" style={{ borderColor: STATE_COLOR[proposal.proposed_state] }}>
          <div className="text-xs font-black uppercase tracking-wide text-amber-800">Proposed by model — needs a human</div>
          <div className="mt-0.5 text-slate-800">{proposal.reason}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {MODEL_LABEL[proposal.model]} · score {proposal.score.toFixed(2)}
          </div>
        </div>
      ) : null}
      <Field label="State on the ladder" hint={`Rung: ${STATE_RUNG[state]}. ${WHAT_HAPPENS[state]}`}>
        <select
          className={inputClass}
          value={state}
          disabled={Boolean(proposal)}
          onChange={(e) => {
            setState(e.target.value as ZoneState);
            setBypass(false);
          }}
        >
          {ZONE_STATES.map((s) => (
            <option key={s} value={s}>
              {stateLabel(s, mode)}
              {s === zone.state ? " (current)" : ""}
            </option>
          ))}
        </select>
      </Field>
      {state === "order" ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950">
          <p className="font-semibold">Opens a 90-second hold with sentinels before the send.</p>
          <p className="mt-0.5">The machine can delay an alert, never stop one: at 0:00 it sends on time (simulated).</p>
          {proposal ? null : (
            <label className="mt-2 flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={bypass} onChange={(e) => setBypass(e.target.checked)} className="size-4 accent-red-700" />
              Incident commander order: bypass hold (logged)
            </label>
          )}
        </div>
      ) : null}
      <ZoneTextFields texts={texts} fromServer={fromServer} onEdit={edit} />
    </DecisionDialog>
  );
}
