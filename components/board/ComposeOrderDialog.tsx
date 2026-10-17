"use client";

import { useState } from "react";
import { openHold, type Signed } from "@/lib/client/api";
import { fmtArea, fmtPeople } from "@/lib/client/format";
import { stateLabel } from "@/lib/client/labels";
import type { Zone } from "@/lib/types";
import { Field, inputClass } from "@/components/ui/Field";
import { useAct, useBoard } from "./BoardContext";
import { DecisionDialog } from "./DecisionDialog";
import { useZoneTexts } from "./useZoneTexts";
import { useZoneMoved, ZoneMovedNotice } from "./ZoneMoved";
import { ZoneTextFields } from "./ZoneTextFields";

type HoldState = "order" | "shelter_in_place";
type PolygonChoice = "zone" | "county";

/**
 * Compose the alert that escalates a zone, and open the hold: sentinels at the polygon's edges are
 * asked "does this match what you see?" while the screen shows how many phones the alert would wake.
 */
export function ComposeOrderDialog({ zone, onClose }: { zone: Zone; onClose: () => void }) {
  const { snap } = useBoard();
  const act = useAct();
  const mode = snap.meta.mode;
  const [state, setState] = useState<HoldState>("order");
  // Until the human picks a polygon, the radio follows the demo's live Wrong polygon switch and the body
  // leaves `polygon` out, so the server applies the switch at the moment the hold opens.
  const [picked, setPicked] = useState<PolygonChoice | null>(null);
  const polygon: PolygonChoice = picked ?? (snap.meta.wrong_polygon ? "county" : "zone");
  const { moved, acknowledge } = useZoneMoved(zone);
  const { texts, fromServer, edit } = useZoneTexts(zone, state, mode);

  async function confirm({ actor, reason }: Signed) {
    if (!texts) return;
    await act(
      () =>
        openHold({
          zone_id: zone.id,
          proposed_state: state,
          directive_text: texts.directive_text,
          move_text: texts.move_text,
          evac_point: texts.evac_point.trim() || null,
          opened_by: actor,
          reason,
          ...(picked ? { polygon: picked } : {}),
        }),
      (hold) => `Hold opened: wakes about ${fmtPeople(hold.population_est)} people. Sentinels ringing at the edges.`,
    );
  }

  return (
    <DecisionDialog
      size="lg"
      title={`Compose ${stateLabel(state, mode)}: ${zone.name}`}
      subtitle="Opens the hold. Nothing is sent until a human decides or the 90-second timer runs out."
      confirmLabel="Open the hold"
      canSubmit={!moved && texts !== null && texts.directive_text.trim().length > 0}
      reasonPlaceholder="Who asked for this, and why"
      reasonSuggestions={["Duty officer requests an Order", "Envelope reached the zone edge"]}
      onConfirm={confirm}
      onClose={onClose}
    >
      {moved ? <ZoneMovedNotice name={zone.name} moved={moved} onAcknowledge={acknowledge} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Escalate to">
          <select className={inputClass} value={state} onChange={(e) => setState(e.target.value as HoldState)}>
            <option value="order">{stateLabel("order", mode)}</option>
            <option value="shelter_in_place">{stateLabel("shelter_in_place", mode)}</option>
          </select>
        </Field>
        <fieldset>
          <legend className="mb-1 block text-[13px] font-semibold text-slate-800">Alert polygon</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="polygon" checked={polygon === "zone"} onChange={() => setPicked("zone")} className="accent-slate-900" />
            {zone.name}
            {zone.population_est ? (
              <span className="text-slate-500">
                · about {fmtPeople(zone.population_est)} people{zone.area_sq_mi ? `, ${fmtArea(zone.area_sq_mi)} sq mi` : ""}
              </span>
            ) : null}
          </label>
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input type="radio" name="polygon" checked={polygon === "county"} onChange={() => setPicked("county")} className="accent-red-700" />
            Countywide polygon <span className="text-slate-500">(the January 9 mistake, for the demo)</span>
          </label>
        </fieldset>
      </div>
      <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Four to five sentinels ring in parallel: three at the polygon&apos;s far edges, one or two near the hazard. Quorum is two
        answers; silence is an abstention, never a No. At 0:00 the alert sends on time (simulated).
      </p>
      <ZoneTextFields texts={texts} fromServer={fromServer} onEdit={edit} />
    </DecisionDialog>
  );
}
