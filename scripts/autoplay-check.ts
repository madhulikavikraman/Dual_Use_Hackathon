// Runs the "Play the full fire" beat script (lib/autoplay/script.ts) against a running server and prints
// PASS / FAIL / SKIP per beat. The same beats the board's overlay plays, with no reading time: just the waits.
// It resets the Westside scenario on that server, so point it at a dev server with its own data file:
//   SECONDKEY_DATA_FILE=.data/autoplay.json npx next dev -p 3101
//   npx tsx scripts/autoplay-check.ts http://localhost:3101
// Add --dwell (or --dwell --speed=2) to keep each beat's reading time and time the run as the board plays it.
// With DESK_PASSWORD set on the server, export the same DESK_PASSWORD here (HTTP Basic auth).
import { config } from "dotenv";
import { runScript } from "../lib/autoplay/runner";
import { BEATS, httpEnv, newMemo, restoreAfterAutoplay } from "../lib/autoplay/script";

config({ path: ".env.local" });
config();

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3101").replace(/\/+$/, "");
const dwell = args.includes("--dwell");
const speed = Number(args.find((a) => a.startsWith("--speed="))?.slice(8) ?? 1) || 1;
const password = process.env.DESK_PASSWORD;
const headers = password ? { authorization: `Basic ${Buffer.from(`autoplay:${password}`).toString("base64")}` } : undefined;
const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`.padStart(7);

async function main() {
  const env = httpEnv(base, headers);
  try {
    const h = await fetch(`${base}/api/health`, { headers });
    if (!h.ok) throw new Error(`HTTP ${h.status}`);
  } catch (e) {
    console.error(`Cannot reach ${base} (${e instanceof Error ? e.message : String(e)}). Start a server first.`);
    process.exit(2);
  }
  console.log(
    `Autoplay check against ${base}: ${BEATS.length} beats (${BEATS.filter((b) => b.optional).length} optional), ` +
      `${dwell ? `with reading time at ${speed}x` : "waits only"}\n`,
  );
  const memo = newMemo();
  const t0 = Date.now();
  const results = await runScript(BEATS, env, memo, {
    dwell,
    speed: () => speed,
    onLine: (i, line) => {
      if (line && line.kind !== "progress") console.log(`        ${BEATS[i].id}: ${line.text}`);
    },
    onResult: (i, beat, r) => {
      const tag = r.status === "passed" ? "PASS" : r.optional || r.status === "skipped" ? "SKIP" : "FAIL";
      const num = String(i + 1).padStart(2, "0");
      console.log(`${tag}  ${num} ${beat.id.padEnd(15)} ${secs(r.ms)}  ${beat.title}${r.status !== "passed" && r.note ? `  (${r.status}: ${r.note})` : ""}`);
    },
  });
  await restoreAfterAutoplay(env, memo).catch((e) => console.error("restore failed:", e));
  const failed = results.filter((r) => !r.optional && r.status !== "passed");
  const skipped = results.filter((r) => r.optional && r.status !== "passed");
  console.log(
    `\n${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} optional skipped, in ${secs(Date.now() - t0).trim()}.` +
      ` Autopilot put back to ${memo.autopilotBefore === null ? "(unchanged)" : memo.autopilotBefore ? "on" : "off"}.`,
  );
  try {
    const board = await env.board();
    const mine = board.ledger.filter((l) => l.actor.includes("(simulated)") && l.kind === "decision").length;
    console.log(`Ledger: ${mine} autoplay decisions; human_decisions metric = ${board.metrics.human_decisions} (autoplay and seeded rows excluded).`);
  } catch {
    // The summary line is a bonus.
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
