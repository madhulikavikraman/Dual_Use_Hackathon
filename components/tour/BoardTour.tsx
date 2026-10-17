"use client";

import { useEffect, useMemo } from "react";
import { useBoard } from "@/components/board/BoardContext";
import { usePlans } from "@/components/board/usePlans";
import { BOARD_TOUR, boardSteps, captureTab } from "./boardSteps";
import { claimAutoStart, startTour } from "./store";
import { Tour } from "./Tour";

/**
 * The supervisor board's guided tour. The header's Tour button starts it; so does opening the board with
 * ?tour=1 (a link from the landing page or the Devpost). Mounted inside the board's provider, so the steps
 * use the scenario's own words (Accountability in base mode) and follow the hold as it opens and closes.
 */
export function BoardTour() {
  const { snap } = useBoard();
  const mode = snap.meta.mode;
  const holdOpen = snap.holds.some((h) => h.status === "open");
  const warningZoneId = snap.zones.find((z) => z.state === "warning")?.id ?? null;
  // The zone whose block-by-block plan the tour points at: one in an Order first (its waves are running).
  const plans = usePlans();
  const planZoneId =
    (plans.find((p) => p.status === "active" || p.status === "all_go") ?? plans.find((p) => p.status !== "rejected" && p.status !== "closed"))?.zone_id ?? null;
  const steps = useMemo(() => boardSteps(mode, holdOpen, warningZoneId, planZoneId), [mode, holdOpen, warningZoneId, planZoneId]);

  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("tour");
    if (asked !== "1" && asked !== BOARD_TOUR) return;
    // A moment for the map to draw, so the first spotlight lands on a finished screen. Once per page load.
    const timer = window.setTimeout(() => {
      if (claimAutoStart(BOARD_TOUR)) startTour(BOARD_TOUR);
    }, 700);
    return () => window.clearTimeout(timer);
  }, []);

  return <Tour id={BOARD_TOUR} label="Board tour" steps={steps} onOpen={captureTab} />;
}
