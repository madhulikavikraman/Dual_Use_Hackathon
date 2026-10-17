import "server-only";
import { analysisModel, anthropic } from "@/lib/anthropic";
import { STATE_LABEL } from "@/lib/directives";
import { buildBoard } from "@/lib/engine/board";

// "Ask the board" (PRD backlog 17): the supervisor asks a question in plain words; Claude answers from a
// compact, read-only summary of the board. It cannot take actions, and it says when the board does not know.

const SYSTEM = `You help the overnight supervisor of an emergency call line read their board at 3 AM.
Answer the question in at most four short sentences, with numbers and names from the board summary only.
If the summary does not contain the answer, say so plainly. Never recommend sending, cancelling or changing an alert or a zone: those are the supervisor's decisions; you may point out what is waiting for a decision.
Everything in this demo is simulated; residents marked synthetic are not real people.`;

async function summary(): Promise<string> {
  const b = await buildBoard();
  const lines: string[] = [];
  lines.push(`Time ${b.now}. Scenario ${b.meta.scenario}, mode ${b.meta.mode}.`);
  for (const z of b.zones) {
    const people = b.households.filter((h) => h.zone_id === z.id && h.role === "resident");
    const counts: Record<string, number> = {};
    for (const h of people) counts[h.status] = (counts[h.status] ?? 0) + 1;
    lines.push(`Zone ${z.name} (${z.id}): ${STATE_LABEL[z.state]}; population estimate ${z.population_est ?? "?"}; residents on roster ${people.length}: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}.`);
  }
  for (const p of b.proposals.filter((p) => p.status === "open")) lines.push(`Open model proposal: ${STATE_LABEL[p.proposed_state]} for ${p.zone_id} — ${p.reason}`);
  for (const h of b.holds) {
    lines.push(`Hold ${h.status} for ${h.zone_id} (${h.polygon_label}): read ${h.read}, tally yes ${h.tally.yes} no ${h.tally.no} unsure ${h.tally.unsure} silent ${h.tally.silent} pending ${h.tally.pending}, wakes ~${h.population_est}, deadline ${h.deadline}.`);
  }
  for (const c of b.canaries) lines.push(`Canary ${c.result} (${c.flag ?? "pending"}), inside zone: ${c.inside}.`);
  const open = b.registry.filter((r) => r.status !== "closed");
  lines.push(`Help registry (${open.length} open):`);
  for (const r of open.slice(0, 40)) {
    lines.push(`  P${r.priority} ${r.name ?? "caller"} [${r.synthetic ? "synthetic" : "real phone"}] zone ${r.zone_id ?? "?"}: ${r.reason}; needs ${r.needs.join(", ") || "none"}; people ${r.people ?? "?"}; status ${r.status}${r.assigned_to ? ` (${r.assigned_to})` : ""}; last seen ${r.last_stated_text ?? r.last_source} at ${r.last_observed_at}.`);
  }
  for (const c of b.clusters.filter((c) => c.status !== "dismissed")) lines.push(`Cluster ${c.kind} in ${c.zone_id ?? "?"}: ${c.count} (baseline ${c.baseline}), corroborated ${c.corroborated}, sentinel reads ${c.sentinel_reads}.`);
  lines.push(`Metrics: ${JSON.stringify(b.metrics)}`);
  lines.push("Recent ledger (newest first):");
  for (const l of b.ledger.slice(0, 30)) lines.push(`  ${l.created_at} ${l.actor}: ${l.action}${l.target ? ` (${l.target})` : ""}${l.reason ? ` — ${l.reason}` : ""}`);
  return lines.join("\n");
}

export async function askBoard(question: string): Promise<string> {
  const res = await anthropic().messages.create({
    model: analysisModel(),
    max_tokens: 2048,
    system: SYSTEM,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: `Board summary:\n${await summary()}\n\nQuestion: ${question}` }],
  });
  if (res.stop_reason === "refusal") return "I can't answer that from the board.";
  return res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join(" ").trim();
}
