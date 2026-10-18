"use client";

import { useState } from "react";
import { decideProposal } from "@/lib/client/api";
import { fmtAgo } from "@/lib/client/format";
import { MODEL_LABEL, stateLabel, STATE_TEXT } from "@/lib/client/labels";
import { STATE_COLOR } from "@/lib/directives";
import type { Mode, Proposal, Zone } from "@/lib/types";
import { Emoji } from "@/lib/ui/Emoji";
import { ICON, STATE_ICON } from "@/lib/ui/icons";
import { displayActor, plain } from "@/lib/ui/display";
import { Button } from "@/components/ui/Button";
import { ColorChip } from "@/components/ui/Chip";
import { ApproveZoneDialog } from "./ApproveZoneDialog";
import { useAct, useBoard } from "./BoardContext";
import { DecisionDialog } from "./DecisionDialog";

type Pending = { kind: "approve" | "reject"; zone: Zone; proposal: Proposal };

const SHOWN = 3; // proposals can arrive for any zone at any time; the rest fold away

function ProposalCard({
  proposal,
  zone,
  mode,
  now,
  onDecide,
}: {
  proposal: Proposal;
  zone: Zone;
  mode: Mode;
  now: string;
  onDecide: (kind: Pending["kind"]) => void;
}) {
  return (
    <article className="rounded-md border-2 border-dashed bg-white px-3 py-1.5" style={{ borderColor: STATE_COLOR[proposal.proposed_state] }}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-wide text-amber-800">
          <Emoji e={ICON.model} /> Proposed by model — needs a human
        </span>
        <span className="ml-auto text-xs text-slate-500">
          {MODEL_LABEL[proposal.model]} · {proposal.score.toFixed(2)} · {fmtAgo(proposal.created_at, now)}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[15px] font-bold">{zone.name}</span>
        <span className="text-slate-500">→</span>
        <ColorChip color={STATE_COLOR[proposal.proposed_state]} text={STATE_TEXT[proposal.proposed_state]}>
          <Emoji e={STATE_ICON[proposal.proposed_state]} />
          {stateLabel(proposal.proposed_state, mode)}
        </ColorChip>
      </div>
      <div className="mt-1 flex items-end gap-2">
        <p className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug text-slate-700" title={plain(proposal.reason)}>
          {plain(proposal.reason)}
        </p>
        <Button size="sm" variant="primary" onClick={() => onDecide("approve")}>
          Approve…
        </Button>
        <Button size="sm" onClick={() => onDecide("reject")}>
          Reject…
        </Button>
      </div>
    </article>
  );
}

/** Model proposals: advisory, drawn dashed on the map, and nothing happens until a named human decides. */
export function ProposalsPanel() {
  const { snap, zoneById } = useBoard();
  const act = useAct();
  const [pending, setPending] = useState<Pending | null>(null);
  const [showAll, setShowAll] = useState(false);
  const mode = snap.meta.mode;
  const open = snap.proposals.filter((p) => p.status === "open" && zoneById.has(p.zone_id));
  const decided = snap.proposals.filter((p) => p.status !== "open").slice(0, 3);
  if (!open.length && !decided.length) return null;
  const visible = showAll ? open : open.slice(0, SHOWN);

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
        <Emoji e={ICON.model} /> Model proposals · need a human
        {open.length ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">{open.length} open</span> : null}
      </h3>
      <div className="space-y-2">
        {visible.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            zone={zoneById.get(p.zone_id)!}
            mode={mode}
            now={snap.now}
            onDecide={(kind) => setPending({ kind, zone: zoneById.get(p.zone_id)!, proposal: p })}
          />
        ))}
      </div>
      {open.length > SHOWN ? (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="mt-1.5 text-sm font-semibold text-blue-700 underline-offset-2 hover:underline"
        >
          {showAll ? "Show fewer" : `Show ${open.length - SHOWN} more`}
        </button>
      ) : null}
      {decided.length ? (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
          {decided.map((p) => (
            <li key={p.id}>
              <b className="text-slate-800">{p.status === "rejected" ? "Rejected" : "Approved"}</b> by {p.decided_by ? displayActor(p.decided_by) : "—"}:{" "}
              {zoneById.get(p.zone_id)?.name ?? p.zone_id} → {stateLabel(p.proposed_state, mode)}
              {p.decision_reason ? ` · “${p.decision_reason}”` : ""}
            </li>
          ))}
        </ul>
      ) : null}

      {pending?.kind === "approve" ? (
        <ApproveZoneDialog zone={pending.zone} proposal={pending.proposal} onClose={() => setPending(null)} />
      ) : null}
      {pending?.kind === "reject" ? (
        <DecisionDialog
          title={`Reject the proposal for ${pending.zone.name}`}
          description={
            <>
              The model proposed <b>{stateLabel(pending.proposal.proposed_state, mode)}</b>: {plain(pending.proposal.reason)} Rejections
              are logged with your reason, so the model&apos;s record stays visible.
            </>
          }
          confirmLabel="Reject proposal"
          reasonPlaceholder="Why the model is wrong, or why not yet"
          reasonSuggestions={["Envelope does not reach this zone yet", "No sentinel corroboration"]}
          onConfirm={({ actor, reason }) =>
            act(
              () => decideProposal(pending.proposal.id, { decision: "reject", actor, reason }),
              `Proposal for ${pending.zone.name} rejected and logged`,
            )
          }
          onClose={() => setPending(null)}
        />
      ) : null}
    </section>
  );
}
