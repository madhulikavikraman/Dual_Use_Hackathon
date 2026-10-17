"use client";

import { useEffect, useState } from "react";
import { getZoneDefaults } from "@/lib/client/api";
import { directiveFor } from "@/lib/directives";
import type { Mode, Zone, ZoneState } from "@/lib/types";

export interface ZoneTexts {
  directive_text: string;
  move_text: string;
  evac_point: string;
}

/**
 * The directive, move text and evacuation point a human approves with a zone state. Pre-filled from
 * GET /api/zones/[id]/defaults; if that is unavailable, from the standard vocabulary and the zone's
 * current texts. Edits are kept per state until the dialog closes.
 */
export function useZoneTexts(zone: Zone, state: ZoneState, mode: Mode) {
  const key = `${zone.id}:${state}`;
  const [loaded, setLoaded] = useState<{ key: string; texts: ZoneTexts; fromServer: boolean } | null>(null);
  const { id, name, state: current, move_text, evac_point } = zone;

  useEffect(() => {
    let live = true;
    getZoneDefaults(id, state)
      .then((d) => ({
        texts: { directive_text: d.directive_text, move_text: d.move_text ?? "", evac_point: d.evac_point ?? "" },
        fromServer: true,
      }))
      .catch(() => ({
        texts: {
          directive_text: directiveFor(state, mode, name),
          move_text: state === current ? (move_text ?? "") : "",
          evac_point: state === current ? (evac_point ?? "") : "",
        },
        fromServer: false,
      }))
      .then((r) => {
        if (live) setLoaded({ key: `${id}:${state}`, ...r });
      });
    return () => {
      live = false;
    };
  }, [id, name, current, move_text, evac_point, state, mode]);

  const ready = loaded?.key === key ? loaded : null;
  const edit = (patch: Partial<ZoneTexts>) =>
    setLoaded((l) => (l && l.key === key ? { ...l, texts: { ...l.texts, ...patch } } : l));

  return { texts: ready?.texts ?? null, fromServer: ready?.fromServer ?? false, edit };
}
