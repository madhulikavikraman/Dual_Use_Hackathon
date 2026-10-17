import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { analysisModel, anthropic } from "@/lib/anthropic";
import { db, nowIso, uid } from "@/lib/db";
import { executeTool, upsertStatus } from "@/lib/engine/calls";
import { feed } from "@/lib/engine/log";
import { upsertHelp } from "@/lib/engine/registry";
import { NEEDS, PRIMARY_INTENTS, type Intent, type IntentFlag, type Need, type PrimaryIntent } from "@/lib/types";

// The intent pipeline's second layer (PRD 10): after a real call, Claude Sonnet reads the transcript and
// returns a strict-schema classification. In-call confirmed answers win; the post-call pass fills gaps,
// flags disagreements for review, and always surfaces "needs help now".

const FLAGS: [IntentFlag, ...IntentFlag[]] = ["medical", "mobility", "oxygen", "no_car", "children", "pets", "language_mismatch", "hostile", "duplicate"];

export const Classification = z.object({
  primary_intent: z.enum(PRIMARY_INTENTS as [PrimaryIntent, ...PrimaryIntent[]]),
  flags: z.array(z.enum(FLAGS)),
  needs: z.array(z.enum(NEEDS as [Need, ...Need[]])),
  people: z.number().int().nullable(),
  location_text: z.string().nullable(),
  destination: z.string().nullable(),
  can_leave: z.boolean().nullable(),
  understood: z.boolean().nullable(),
  language: z.string(),
  confidence: z.number(),
  summary: z.string(),
  memory_note: z.string().nullable(),
});
export type ClassificationResult = z.infer<typeof Classification>;

const SYSTEM = `You classify transcripts of short emergency-information phone calls. The agent called a resident (or a resident called the line). Return the resident's situation, not the agent's words.

Primary intent (pick exactly one):
- needs_help_now: life safety right now (medical emergency, cannot breathe, trapped, fire at the house, injured).
- needs_help_leaving: can leave only with help (wheelchair, oxygen, bedbound, no car, children alone, pets they cannot move).
- leaving: will leave or is leaving now. already_left: already out of the area.
- staying: refuses or is undecided. hazard_report: reports smoke, fire, shaking, damage or injury they see (when that is the main point).
- no_hazard_seen: a sentinel saying nothing matches. info_request: only asked a question.
- wrong_number / not_in_zone: not the person, moved, or outside the area.
- unclear / voicemail / silence: no usable conversation.
Rules: life safety outranks everything; sarcasm or jokes about danger are not needs_help_now unless they describe a real emergency; a caller asking for an ETA is info_request unless something else applies.
needs: only access and functional needs actually mentioned. people: count including the speaker, if said.
confidence: 0 to 1, your confidence in primary_intent. summary: one sentence in English. memory_note: one short fact worth remembering next time (no diagnoses), or null.
language: the language the resident spoke.`;

export async function classifyTranscript(transcript: string, language: string, purpose = "resident"): Promise<ClassificationResult> {
  const res = await anthropic().messages.parse({
    model: analysisModel(),
    max_tokens: 4096,
    system: SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(Classification) },
    messages: [{ role: "user", content: `Call language: ${language}\nCall purpose: ${purpose}\n\nTranscript:\n${transcript}` }],
  });
  if (!res.parsed_output) throw new Error(`classifier returned no parsed output (stop_reason ${res.stop_reason})`);
  return res.parsed_output;
}

const STATUS_FOR: Partial<Record<PrimaryIntent, string>> = {
  needs_help_now: "needs_help_now", needs_help_leaving: "needs_help_leaving", leaving: "leaving", staying: "staying",
  already_left: "already_left", unclear: "unclear", wrong_number: "wrong_number", not_in_zone: "not_in_zone",
};

/** Run the post-call pass for a finished call and reconcile it with the in-call record. */
export async function runPostCall(callId: string): Promise<Intent | null> {
  const call = await db().get("calls", callId);
  if (!call?.transcript) return null;
  const cls = await classifyTranscript(call.transcript, call.vars.language, call.purpose);
  const subjectId = call.subject_household_id ?? call.household_id;
  const post: Intent = {
    id: uid(), call_id: callId, household_id: subjectId, primary_intent: cls.primary_intent, flags: cls.flags, needs: cls.needs,
    people: cls.people, location_text: cls.location_text, destination: cls.destination, can_leave: cls.can_leave,
    understood: cls.understood, language: cls.language, confidence: cls.confidence, summary: cls.summary, source: "post_call",
    review_needed: cls.confidence < 0.7, created_at: nowIso(),
  };
  await db().insert("intents", post);

  const inCall = (await db().where("intents", { call_id: callId, source: "in_call" }))[0];
  const retell = (await db().where("intents", { call_id: callId, source: "retell" }))[0];
  const first = inCall ?? null;
  const primary = first?.primary_intent ?? cls.primary_intent ?? retell?.primary_intent;
  const disagree = Boolean(first && first.primary_intent !== cls.primary_intent);
  const reconciled: Intent = {
    ...post,
    id: uid(),
    primary_intent: primary,
    needs: first?.needs.length ? first.needs : cls.needs,
    people: first?.people ?? cls.people,
    location_text: first?.location_text ?? cls.location_text,
    destination: first?.destination ?? cls.destination,
    can_leave: first?.can_leave ?? cls.can_leave,
    understood: first?.understood ?? cls.understood,
    flags: [...new Set([...(first?.flags ?? []), ...cls.flags])],
    confidence: first ? 1 : cls.confidence,
    source: "reconciled",
    review_needed: disagree || cls.confidence < 0.7,
  };
  await db().insert("intents", reconciled);
  await db().update("calls", callId, { summary: cls.summary });

  const subject = subjectId ? await db().get("households", subjectId) : null;
  if (subject && cls.memory_note && !subject.memory_note) await db().update("households", subject.id, { memory_note: cls.memory_note.slice(0, 280) });

  // No in-call record: apply a confident classification through the same tool path (below 0.7 it waits for a
  // human's review). The row that path writes is a post-call guess, not a confirmed in-call answer.
  if (!first && subject && STATUS_FOR[cls.primary_intent] && cls.confidence >= 0.7 && call.purpose !== "sentinel" && call.purpose !== "canary") {
    await executeTool(callId, "record_status", {
      status: STATUS_FOR[cls.primary_intent], understood: cls.understood, destination: cls.destination, people: cls.people,
      needs: cls.needs, device_battery_hours: null, animals: null, location_text: cls.location_text, location_consent: null,
      can_leave: cls.can_leave, refusal_reason: null, memory_note: null,
    });
    for (const row of await db().where("intents", { call_id: callId, source: "in_call" })) await db().remove("intents", { id: row.id });
  }
  // "Needs help now" surfaces even when the guess is not confident enough to apply (PRD 10).
  if (!first && subject && cls.primary_intent === "needs_help_now" && cls.confidence < 0.7) {
    await upsertHelp({ household: subject, zone_id: subject.zone_id, priority: 1, needs: cls.needs, people: cls.people,
      reason: `Post-call review: possible life safety (${cls.summary})`, source: "stage1" });
  }
  // "Needs help now" from any layer surfaces at once, whatever the confidence.
  if (subject && cls.primary_intent === "needs_help_now" && first && first.primary_intent !== "needs_help_now") {
    await upsertHelp({ household: subject, zone_id: subject.zone_id, priority: 1, needs: cls.needs, people: cls.people,
      reason: `Post-call review: possible life safety (${cls.summary})`, source: "stage1" });
    await upsertStatus(call, subject.id, { human_requested: true, human_reason: "post-call: possible life safety" });
  }
  if (reconciled.review_needed) {
    await feed({ kind: "info", severity: "warn", title: `Review: ${subject?.name ?? "call"} — in-call and post-call disagree`,
      detail: `In call: ${first?.primary_intent ?? "none"}; post-call: ${cls.primary_intent} (${Math.round(cls.confidence * 100)}%). ${cls.summary}` });
  }
  return reconciled;
}
