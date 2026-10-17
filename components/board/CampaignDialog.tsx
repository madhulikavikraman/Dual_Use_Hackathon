"use client";

import type { StartCampaignBody } from "@/lib/contracts";
import { startCampaign, type Signed } from "@/lib/client/api";
import type { Zone } from "@/lib/types";
import { useAct } from "./BoardContext";
import { DecisionDialog } from "./DecisionDialog";

export type CampaignAction = "stage2" | "rollcall" | "test";

const SPEC: Record<
  CampaignAction,
  { title: string; confirm: string; body: Pick<StartCampaignBody, "kind" | "wave">; description: string; suggestions: string[] }
> = {
  stage2: {
    title: "Stage 2 check",
    confirm: "Start Stage 2 calls",
    body: { kind: "warning", wave: 2 },
    description:
      "Calls only the residents who said staying, preparing or unclear, and the no-answers: “Have you left? Do you need help leaving? Is anyone with you?” Each answer refreshes their last known location.",
    suggestions: ["The fire envelope moved", "Stage 2 interval reached"],
  },
  rollcall: {
    title: "Roll call",
    confirm: "Start the roll call",
    body: { kind: "rollcall" },
    description:
      "Calls the households not yet heard from since the Order or the shelter directive: safe, leaving (to where), needs help, or no answer. Unreached and vulnerable rows go to the door-knock list.",
    suggestions: ["Account for everyone after Stage 3", "Silence on the Palms block"],
  },
  test: {
    title: "Monthly test call",
    confirm: "Start test calls",
    body: { kind: "test" },
    description:
      "A 20-second call to every sentinel and roster member in the zone: “This is the Second Key test. Press or say 1 if you can hear this.” It keeps the roster alive and trains each sentinel's reliability score.",
    suggestions: ["Monthly roster test", "New sentinels enrolled"],
  },
};

/** Start Stage 2, a roll call or the monthly test call for one zone. */
export function CampaignDialog({ zone, action, onClose }: { zone: Zone; action: CampaignAction; onClose: () => void }) {
  const act = useAct();
  const spec = SPEC[action];

  async function confirm({ actor, reason }: Signed) {
    await act(
      () => startCampaign({ zone_id: zone.id, ...spec.body, started_by: actor, reason }),
      `${spec.title} started in ${zone.name}`,
    );
  }

  return (
    <DecisionDialog
      title={`${spec.title}: ${zone.name}`}
      description={spec.description}
      confirmLabel={spec.confirm}
      reasonSuggestions={spec.suggestions}
      onConfirm={confirm}
      onClose={onClose}
    />
  );
}
