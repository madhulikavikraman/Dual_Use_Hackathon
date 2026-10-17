// Gold-set runner for the post-call classifier (PRD 10 "Evaluation"; PRD 17.1 milestone 2, shown on /evidence).
// Posts each scripted call to POST /api/agent/classify, scores intent and needs, prints a table and writes
// .data/gold-set-latest.json (read by GET /api/evidence) plus one summary line in .data/gold-set-history.jsonl.
// Only a full run (every item in transcripts.json) replaces gold-set-latest.json: an --only subset is written to
// .data/gold-set-partial.json and marked partial in the history, so milestone M2 never rests on a hand-picked subset.
//
// Run from the repo root:  npx tsx scripts/gold-set/run.ts
// Options:  --concurrency 3   --only EN-01,ES-05 (debugging; does not count for M2)   --dry (check the transcripts file only)
// Base URL: APP_BASE_URL, else http://localhost:3000 (GOLD_BASE_URL overrides both).
import fs from "node:fs";
import path from "node:path";
import { NEEDS, PRIMARY_INTENTS, type Need } from "../../lib/types";
import type { GoldItem, GoldItemResult, GoldSetResult } from "./types";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, ".data");
const OUT = path.join(DATA_DIR, "gold-set-latest.json");
const PARTIAL = path.join(DATA_DIR, "gold-set-partial.json");
const HISTORY = path.join(DATA_DIR, "gold-set-history.jsonl");
const SET = path.join(ROOT, "scripts", "gold-set", "transcripts.json");
const BASE = (process.env.GOLD_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const ENDPOINT = `${BASE}/api/agent/classify`;
const TIMEOUT_MS = 90_000;
const TOLERATED_EXTRA: string[] = ["other"];

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return null;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : "";
}

function loadSet(): GoldItem[] {
  const raw = JSON.parse(fs.readFileSync(SET, "utf8")) as { items: GoldItem[] };
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const it of raw.items) {
    if (ids.has(it.id)) problems.push(`${it.id}: duplicate id`);
    ids.add(it.id);
    if (!PRIMARY_INTENTS.includes(it.expected.primary_intent)) problems.push(`${it.id}: unknown intent ${it.expected.primary_intent}`);
    for (const n of it.expected.needs) if (!NEEDS.includes(n)) problems.push(`${it.id}: unknown need ${n}`);
    if (!it.transcript?.trim()) problems.push(`${it.id}: empty transcript`);
  }
  if (problems.length) throw new Error(`transcripts.json has problems:\n  ${problems.join("\n  ")}`);
  return raw.items;
}

interface Classified {
  primary_intent?: string;
  needs?: string[];
  confidence?: number;
  flags?: string[];
}

class EndpointMissing extends Error {}

async function classify(it: GoldItem): Promise<{ out: Classified | null; ms: number; error: string | null }> {
  const t0 = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: it.transcript, language: it.language, lang_code: it.lang_code, purpose: it.purpose }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    if (res.status === 404 && !text.includes("primary_intent")) throw new EndpointMissing(`${ENDPOINT} returned 404`);
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      return { out: null, ms: Date.now() - t0, error: `HTTP ${res.status}: not JSON` };
    }
    if (!res.ok) return { out: null, ms: Date.now() - t0, error: `HTTP ${res.status}: ${(body as { error?: string })?.error ?? text.slice(0, 120)}` };
    const b = body as Classified & { result?: Classified; intent?: Classified };
    const out = b.primary_intent ? b : b.result ?? b.intent ?? b;
    return { out, ms: Date.now() - t0, error: out.primary_intent ? null : "no primary_intent in the response" };
  } catch (e) {
    if (e instanceof EndpointMissing) throw e;
    const name = e instanceof Error ? e.name : "";
    return { out: null, ms: Date.now() - t0, error: name === "TimeoutError" ? `timed out after ${TIMEOUT_MS / 1000} s` : String(e instanceof Error ? e.message : e) };
  }
}

function score(it: GoldItem, out: Classified | null, ms: number, error: string | null): GoldItemResult {
  const got = (out?.needs ?? []).filter((n): n is string => typeof n === "string");
  const intentOk = out?.primary_intent === it.expected.primary_intent;
  const missing = it.expected.needs.filter((n) => !got.includes(n));
  const extra = got.filter((n) => !it.expected.needs.includes(n as Need) && !TOLERATED_EXTRA.includes(n));
  const needsOk = !error && missing.length === 0 && extra.length === 0;
  return {
    id: it.id,
    language: it.language,
    tricky: it.tricky ?? null,
    expected_intent: it.expected.primary_intent,
    got_intent: out?.primary_intent ?? null,
    expected_needs: it.expected.needs,
    got_needs: got,
    intent_ok: Boolean(intentOk && !error),
    needs_ok: needsOk,
    correct: Boolean(intentOk && needsOk && !error),
    confidence: typeof out?.confidence === "number" ? out.confidence : null,
    flags: Array.isArray(out?.flags) ? out!.flags!.filter((f): f is string => typeof f === "string") : [],
    ms,
    error,
  };
}

async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));

function printTable(rows: GoldItemResult[]) {
  const head = `${pad("ID", 6)} ${pad("Lang", 8)} ${pad("Expected", 19)} ${pad("Classified", 19)} ${pad("Needs expected", 26)} ${pad("Needs classified", 26)} ${pad("Conf", 5)} OK`;
  console.log(head);
  console.log("-".repeat(head.length));
  for (const r of rows) {
    console.log(
      `${pad(r.id, 6)} ${pad(r.language, 8)} ${pad(r.expected_intent, 19)} ${pad(r.error ? "ERROR" : r.got_intent ?? "-", 19)} ` +
        `${pad(r.expected_needs.join(",") || "none", 26)} ${pad(r.got_needs.join(",") || "none", 26)} ` +
        `${pad(r.confidence === null ? "-" : r.confidence.toFixed(2), 5)} ${r.correct ? "yes" : r.intent_ok ? "needs" : "NO"}` +
        (r.error ? `  (${r.error})` : ""),
    );
  }
}

async function main() {
  const items = loadSet();
  const only = arg("only");
  const chosen = only ? items.filter((it) => only.split(",").map((s) => s.trim()).includes(it.id)) : items;
  const subset = chosen.length < items.length;
  const concurrency = Math.max(1, Number(arg("concurrency") || 3));
  console.log(
    `Gold set: ${chosen.length} calls (${[...new Set(chosen.map((i) => i.language))].join(", ")}) -> ${ENDPOINT}` +
      (subset ? ` [subset of ${items.length}: written to ${path.relative(ROOT, PARTIAL)}, does not count for M2]` : ""),
  );
  if (process.argv.includes("--dry")) {
    console.log("Dry run: transcripts.json is valid.");
    return;
  }

  let results: GoldItemResult[];
  try {
    results = await pool(chosen, concurrency, async (it) => {
      const r = await classify(it);
      const s = score(it, r.out, r.ms, r.error);
      process.stdout.write(s.correct ? "." : s.error ? "E" : "x");
      return s;
    });
  } catch (e) {
    if (e instanceof EndpointMissing) {
      console.error(`\n${e.message}: the classifier route is not live yet. Nothing was written.`);
      process.exit(2);
    }
    throw e;
  }
  process.stdout.write("\n\n");
  printTable(results);

  const scored = results.filter((r) => !r.error).length;
  if (scored === 0) {
    console.error("\nNo call was classified (is the dev server running?). Nothing was written.");
    process.exit(2);
  }
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const intentCorrect = results.filter((r) => r.intent_ok).length;
  const nhn = results.filter((r) => r.expected_intent === "needs_help_now");
  const nhnHit = nhn.filter((r) => r.got_intent === "needs_help_now").length;
  const falseAlarms = results.filter((r) => r.expected_intent !== "needs_help_now" && r.got_intent === "needs_help_now").length;
  const byLanguage: GoldSetResult["by_language"] = {};
  for (const r of results) {
    const l = (byLanguage[r.language] ??= { total: 0, correct: 0, intent_correct: 0 });
    l.total++;
    if (r.correct) l.correct++;
    if (r.intent_ok) l.intent_correct++;
  }
  const missRank = (r: GoldItemResult) =>
    r.expected_intent === "needs_help_now" && r.got_intent !== "needs_help_now" ? 0 : !r.intent_ok ? 1 : 2;
  const worst = results
    .filter((r) => !r.correct)
    .sort((a, b) => missRank(a) - missRank(b) || (a.confidence ?? 0) - (b.confidence ?? 0))
    .slice(0, 3)
    .map((r) => r.id);

  const out: GoldSetResult = {
    run_at: new Date().toISOString(),
    base_url: BASE,
    endpoint: ENDPOINT,
    set_size: items.length,
    subset,
    total,
    scored,
    errors: total - scored,
    correct,
    accuracy: correct / total,
    intent_correct: intentCorrect,
    intent_accuracy: intentCorrect / total,
    needs_help_now: { expected: nhn.length, detected: nhnHit, recall: nhn.length ? nhnHit / nhn.length : null, false_alarms: falseAlarms },
    by_language: byLanguage,
    scoring: "Correct = the primary intent matches and every expected need is present, with no extra need except 'other'. Errors count as wrong.",
    target: { accuracy: 0.9, needs_help_now_recall: 1, note: "PRD 17.1: 18 of 20 correct across languages (90%) and 100% recall on needs_help_now." },
    items: results,
    worst,
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // A subset never replaces the latest full run that /evidence reads for M2.
  const file = subset ? PARTIAL : OUT;
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  fs.appendFileSync(
    HISTORY,
    JSON.stringify({
      run_at: out.run_at, endpoint: ENDPOINT, total, set_size: items.length, ...(subset ? { partial: true } : {}),
      correct, accuracy: out.accuracy, nhn_recall: out.needs_help_now.recall, worst,
    }) + "\n",
  );

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  console.log(
    `\nCorrect ${correct}/${total} (${pct(out.accuracy)}; target 90%) · intent only ${intentCorrect}/${total} · ` +
      `needs_help_now recall ${nhnHit}/${nhn.length}${nhn.length ? ` (${pct(nhnHit / nhn.length)}; target 100%)` : ""}` +
      `${falseAlarms ? ` · ${falseAlarms} false alarm(s)` : ""}${total - scored ? ` · ${total - scored} error(s)` : ""}`,
  );
  console.log(`By language: ${Object.entries(byLanguage).map(([l, v]) => `${l} ${v.correct}/${v.total}`).join(", ")}`);
  if (worst.length) console.log(`Worst three (pitch appendix): ${worst.join(", ")}`);
  console.log(
    subset
      ? `Wrote ${path.relative(ROOT, file)} (subset run; /evidence keeps the latest full run for M2).`
      : `Wrote ${path.relative(ROOT, file)}; /evidence picks it up on its next refresh.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

