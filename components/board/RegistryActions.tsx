"use client";

import { useState } from "react";
import { callBack, patchRegistry, type Signed } from "@/lib/client/api";
import type { HelpRequest, HelpStatus } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { useAct } from "./BoardContext";
import { DecisionDialog } from "./DecisionDialog";

type RowAction = "assign" | "en_route" | "reached" | "closed" | "callback";

const SPEC: Record<RowAction, { button: string; title: string; confirm: string; description: string; suggestions: string[] }> = {
  assign: {
    button: "Assign",
    title: "Assign",
    confirm: "Assign",
    description: "Names the team or vehicle that owns this row. The registry is for humans: nothing is dispatched automatically.",
    suggestions: ["Nearest accessible van", "Closest door-knock team"],
  },
  en_route: {
    button: "En route",
    title: "Mark en route",
    confirm: "Mark en route",
    description: "The assigned team is on its way.",
    suggestions: ["Van dispatched", "Team on the way"],
  },
  reached: {
    button: "Reached",
    title: "Mark reached",
    confirm: "Mark reached",
    description: "A person from the team is with them.",
    suggestions: ["Team on scene", "Confirmed by phone"],
  },
  closed: {
    button: "Close",
    title: "Close the row",
    confirm: "Close",
    description: "Closes the row. Registry rows are purged 72 hours after the incident is closed.",
    suggestions: ["Evacuated with the team", "Left on their own", "Duplicate row"],
  },
  callback: {
    button: "Call back",
    title: "Call back",
    confirm: "Call back now",
    description: "Rings them with the response team's script and refreshes their last known location. Logged.",
    suggestions: ["Confirm location before pickup", "Battery low: check status"],
  },
};

const STATUS_FOR: Partial<Record<RowAction, HelpStatus>> = { en_route: "en_route", reached: "reached", closed: "closed" };
const TEAMS = ["Accessible van A", "Accessible van B", "QRT team 1", "CERT door-knock team"];

/** Assign, En route, Reached, Close, Call back: each with a name and a reason for the ledger. */
export function RegistryActions({ row }: { row: HelpRequest }) {
  const act = useAct();
  const [action, setAction] = useState<RowAction | null>(null);
  const [assignee, setAssignee] = useState(row.assigned_to ?? "");
  const closed = row.status === "closed";
  const label = row.name ?? row.phone ?? "this person";

  const enabled: Record<RowAction, boolean> = {
    assign: !closed && row.status !== "reached",
    en_route: !closed && row.status !== "en_route" && row.status !== "reached",
    reached: !closed && row.status !== "reached",
    closed: !closed,
    callback: !closed && row.household_id !== null,
  };

  async function confirm(a: RowAction, { actor, reason }: Signed) {
    if (a === "callback") {
      await act(() => callBack(row.id, { actor, reason }), `Calling ${label} back`);
      return;
    }
    if (a === "assign") {
      const to = assignee.trim();
      await act(() => patchRegistry(row.id, { status: "assigned", assigned_to: to, actor, reason }), `${label}: assigned to ${to}`);
      return;
    }
    const status = STATUS_FOR[a]!;
    await act(() => patchRegistry(row.id, { status, actor, reason }), `${label}: ${SPEC[a].button.toLowerCase()}`);
  }

  return (
    <div className="flex flex-wrap gap-1">
      {(Object.keys(SPEC) as RowAction[]).map((a) => (
        <Button
          key={a}
          size="sm"
          disabled={!enabled[a]}
          onClick={() => {
            setAssignee(row.assigned_to ?? "");
            setAction(a);
          }}
        >
          {SPEC[a].button}
        </Button>
      ))}
      {action ? (
        <DecisionDialog
          title={`${SPEC[action].title}: ${label}`}
          description={SPEC[action].description}
          confirmLabel={SPEC[action].confirm}
          reasonSuggestions={SPEC[action].suggestions}
          canSubmit={action !== "assign" || assignee.trim().length >= 2}
          onConfirm={(signed) => confirm(action, signed)}
          onClose={() => setAction(null)}
        >
          {action === "assign" ? (
            <Field label="Assign to" required>
              <input className={inputClass} value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Team or vehicle" />
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {TEAMS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAssignee(t)}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-200"
                  >
                    {t}
                  </button>
                ))}
              </span>
            </Field>
          ) : null}
        </DecisionDialog>
      ) : null}
    </div>
  );
}
