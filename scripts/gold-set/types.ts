// Shape of the gold-set run written by scripts/gold-set/run.ts to .data/gold-set-latest.json and read by
// lib/engine/evidence.ts (milestone M2 on /evidence). Types only: safe to import from anywhere.
import type { Need, PrimaryIntent } from "@/lib/types";

export interface GoldItem {
  id: string; // "EN-01"
  language: string; // "English"
  lang_code: string; // "en-US"
  purpose: "resident" | "sentinel" | "inbound";
  tricky?: string; // "sarcasm", "eta", "wrong_number", "downplayed", ...
  note?: string;
  transcript: string;
  expected: { primary_intent: PrimaryIntent; needs: Need[] };
}

export interface GoldItemResult {
  id: string;
  language: string;
  tricky: string | null;
  expected_intent: PrimaryIntent;
  got_intent: string | null;
  expected_needs: Need[];
  got_needs: string[];
  intent_ok: boolean;
  needs_ok: boolean;
  correct: boolean;
  confidence: number | null;
  flags: string[];
  ms: number;
  error: string | null;
}

export interface GoldSetResult {
  run_at: string; // ISO 8601 UTC
  base_url: string;
  endpoint: string;
  /** Items in transcripts.json when the run started; absent in files written before this field existed. */
  set_size?: number;
  /** True for an --only run that skipped items: written to gold-set-partial.json, never to gold-set-latest.json. */
  subset?: boolean;
  total: number;
  scored: number; // items that got a classification back
  errors: number;
  correct: number; // intent and needs right
  accuracy: number; // correct / total
  intent_correct: number;
  intent_accuracy: number;
  needs_help_now: { expected: number; detected: number; recall: number | null; false_alarms: number };
  by_language: Record<string, { total: number; correct: number; intent_correct: number }>;
  scoring: string; // the rule, stated
  target: { accuracy: number; needs_help_now_recall: number; note: string };
  items: GoldItemResult[];
  worst: string[]; // ids of the three worst misses (needs_help_now misses first)
}
