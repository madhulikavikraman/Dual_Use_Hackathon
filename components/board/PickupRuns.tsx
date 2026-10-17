"use client";

import { useState } from "react";
import { buildPickupRuns } from "@/lib/client/api";
import { NEED_LABEL } from "@/lib/client/labels";
import type { PickupRun } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { useAct, useBoard } from "./BoardContext";
import { DecisionDialog } from "./DecisionDialog";

const VEHICLE: Record<PickupRun["vehicle"], string> = { accessible_van: "accessible van", car: "car" };
const RUN_TONE = { planned: "neutral", en_route: "info", done: "good" } as const;

/** Pickup runs built from open registry rows, and the button that builds them. */
export function PickupRuns() {
  const { snap } = useBoard();
  const act = useAct();
  const [building, setBuilding] = useState(false);
  const rowById = new Map(snap.registry.map((r) => [r.id, r]));

  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <header className="flex items-center gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Pickup runs</h4>
        <Button size="sm" className="ml-auto" onClick={() => setBuilding(true)}>
          Build pickup runs
        </Button>
      </header>
      {snap.runs.length ? (
        <div className="mt-1.5 space-y-2">
          {snap.runs.map((run) => (
            <div key={run.id}>
              <div className="flex items-center gap-2 text-sm">
                <b>{run.label}</b>
                <span className="text-slate-600">{VEHICLE[run.vehicle]}</span>
                <Chip tone={RUN_TONE[run.status]} className="ml-auto">
                  {run.status.replace("_", " ")}
                </Chip>
              </div>
              <ol className="mt-0.5 list-decimal space-y-0.5 pl-5 text-sm text-slate-700">
                {run.stops.map((id) => {
                  const r = rowById.get(id);
                  return (
                    <li key={id}>
                      {r ? (
                        <>
                          <b className="text-slate-900">P{r.priority}</b> {r.name ?? r.phone ?? "Name not given"}
                          {r.needs.length ? ` · ${r.needs.map((n) => NEED_LABEL[n]).join(", ")}` : ""}
                          {r.last_stated_text ? ` · ${r.last_stated_text}` : ""}
                        </>
                      ) : (
                        "Row no longer in the registry"
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-500">No runs yet. Runs group open priority 1 and 2 rows by place and need.</p>
      )}
      {building ? (
        <DecisionDialog
          title="Build pickup runs"
          description="Groups open priority 1 and 2 rows by location and need, orders stops by device battery hours and then distance. Wheelchair, oxygen and bedbound needs always go to accessible vans."
          confirmLabel="Build runs"
          reasonSuggestions={["Vans ready at the staging area", "New help rows since the last runs"]}
          onConfirm={({ actor, reason }) =>
            act(
              () => buildPickupRuns({ actor, reason }),
              (r) => `${r.runs.length} pickup ${r.runs.length === 1 ? "run" : "runs"} built`,
            )
          }
          onClose={() => setBuilding(false)}
        />
      ) : null}
    </section>
  );
}
