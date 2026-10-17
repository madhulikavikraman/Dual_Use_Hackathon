"use client";

import { useState } from "react";
import { stateLabel } from "@/lib/client/labels";
import type { Zone, ZoneState } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { useBoard } from "./BoardContext";

/**
 * A zone dialog opens on the zone as it was at the click. If the zone moves while the dialog is open
 * (the hold sends on its timer, someone in another tab approves), confirming what was chosen against
 * the old state could undo that move, for example drop a Crisis zone back to Near-Crisis. So the dialog
 * reads the live zone, says what changed, and blocks the confirm until the human has looked again.
 */
export function useZoneMoved(zone: Zone) {
  const { zoneById } = useBoard();
  const live = zoneById.get(zone.id) ?? zone;
  const [seen, setSeen] = useState<ZoneState>(zone.state);
  return {
    live,
    moved: live.state === seen ? null : { from: seen, to: live.state },
    acknowledge: () => setSeen(live.state),
  };
}

export function ZoneMovedNotice({
  name,
  moved,
  onAcknowledge,
}: {
  name: string;
  moved: { from: ZoneState; to: ZoneState };
  onAcknowledge: () => void;
}) {
  const { snap } = useBoard();
  const mode = snap.meta.mode;
  return (
    <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <p className="font-semibold">
        {name} changed while this was open: it is now {stateLabel(moved.to, mode)} (it was {stateLabel(moved.from, mode)}).
      </p>
      <p className="mt-0.5">Check what you are about to confirm against the new state.</p>
      <Button size="sm" className="mt-2" onClick={onAcknowledge}>
        I have checked
      </Button>
    </div>
  );
}
