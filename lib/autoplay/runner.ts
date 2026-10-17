// Runs the beat script (./script.ts): skip check, action, wait for the board with a timeout, then a minimum
// time on screen. Isomorphic, shared by the board's overlay and scripts/autoplay-check.ts. Pause freezes the run's
// clocks (the server's simulation keeps going); Skip cuts the current wait and dwell.
import { isAbort, sleep, type AutoplayEnv, type Beat, type BeatCtx, type Memo } from "./script";

export type BeatStatus = "passed" | "timeout" | "skipped" | "failed";

export interface BeatResult {
  id: string;
  title: string;
  status: BeatStatus;
  optional: boolean;
  /** Shown to the room (false for a quiet beat that did not apply). */
  shown: boolean;
  /** Why it was skipped or failed, or what happened. */
  note: string | null;
  ms: number;
}

export interface BeatLine {
  kind: "progress" | "outcome" | "timeout" | "error";
  text: string;
}

export interface RunHooks {
  /** False in the check script: no reading time, just the waits. */
  dwell?: boolean;
  speed?: () => number;
  paused?: () => boolean;
  /** The presenter pressed Skip. Returns true once per press. */
  takeSkip?: () => boolean;
  onShow?: (index: number, beat: Beat) => void;
  onLine?: (index: number, line: BeatLine | null) => void;
  /** About every 250 ms: how far the beat is (0..1 of its time on screen) and whether it is waiting on the board. */
  onTick?: (index: number, frac: number, waiting: boolean) => void;
  onResult?: (index: number, beat: Beat, result: BeatResult) => void;
  /** After an action: poll the board now. */
  afterAction?: () => void;
}

const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_AFTER = 3500;
const STEP = 250;

/** Milliseconds that passed while not paused. */
function activeClock(paused: () => boolean) {
  let last = Date.now();
  let total = 0;
  return {
    tick() {
      const now = Date.now();
      if (!paused()) total += now - last;
      last = now;
      return total;
    },
  };
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function freshBoard(env: AutoplayEnv, signal?: AbortSignal) {
  let last: unknown = null;
  for (let i = 0; i < 4; i++) {
    try {
      return await env.board(signal);
    } catch (e) {
      if (isAbort(e)) throw e;
      last = e;
      await sleep(1500, signal);
    }
  }
  throw last;
}

export async function runBeat(beat: Beat, index: number, env: AutoplayEnv, memo: Memo, hooks: RunHooks = {}, signal?: AbortSignal): Promise<BeatResult> {
  const t0 = Date.now();
  const paused = hooks.paused ?? (() => false);
  const speed = () => Math.max(0.25, hooks.speed?.() ?? 1);
  const dwellOn = hooks.dwell !== false;
  let skippedByPresenter = false;
  const takeSkip = () => {
    if (!skippedByPresenter && hooks.takeSkip?.()) skippedByPresenter = true;
    return skippedByPresenter;
  };
  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;
    hooks.onShow?.(index, beat);
  };
  const done = (status: BeatStatus, note: string | null): BeatResult => {
    const result: BeatResult = { id: beat.id, title: beat.title, status, optional: Boolean(beat.optional), shown, note, ms: Date.now() - t0 };
    hooks.onResult?.(index, beat, result);
    return result;
  };

  // Hold still while paused before anything happens.
  while (paused()) await sleep(STEP, signal);

  let snap;
  try {
    snap = await freshBoard(env, signal);
  } catch (e) {
    if (isAbort(e)) throw e;
    return done(beat.optional ? "skipped" : "failed", `Board unavailable: ${errText(e)}`);
  }
  memo.beatAt = snap.now;
  const ctx: BeatCtx = { env, memo, snap, signal };

  if (beat.skip) {
    let why: string | null;
    try {
      why = await beat.skip(ctx);
    } catch (e) {
      if (isAbort(e)) throw e;
      why = `Could not check: ${errText(e)}`;
    }
    if (why) return done("skipped", why);
  }
  if (!beat.quiet || beat.act) show();

  // Time on screen counts from when the beat is shown.
  let screen = activeClock(paused);
  let lineAt: number | null = null; // screen time when a result line appeared
  const say = (line: BeatLine | null, late = false) => {
    hooks.onLine?.(index, line);
    if (late && line) lineAt = screen.tick();
  };

  /** Keep the beat on screen until it has had its reading time (and any late result line its own). */
  const dwell = async () => {
    if (!dwellOn || !shown) return;
    for (;;) {
      const at = screen.tick();
      const need = Math.max(beat.dwellMs / speed(), lineAt === null ? 0 : lineAt + (beat.afterMs ?? DEFAULT_AFTER) / speed());
      hooks.onTick?.(index, Math.min(1, at / Math.max(1, need)), false);
      if (at >= need || takeSkip()) return;
      await sleep(STEP, signal);
    }
  };

  let note: string | null = null;
  if (beat.act) {
    try {
      note = (await beat.act(ctx)) || null;
      hooks.afterAction?.();
    } catch (e) {
      if (isAbort(e)) throw e;
      const msg = errText(e);
      if (beat.optional) return done("skipped", msg);
      say({ kind: "error", text: `That step did not go through (${msg}). Moving on.` }, true);
      await dwell();
      return done("failed", msg);
    }
    if (note) say({ kind: "outcome", text: note });
    try {
      ctx.snap = await freshBoard(env, signal); // what the action changed
    } catch (e) {
      if (isAbort(e)) throw e;
    }
  }

  let status: BeatStatus = "passed";
  if (beat.until) {
    const wait = activeClock(paused);
    let limit = DEFAULT_TIMEOUT;
    let firstCheck = true;
    for (;;) {
      if (firstCheck) {
        limit = typeof beat.timeoutMs === "function" ? beat.timeoutMs(ctx.snap, memo) : beat.timeoutMs ?? DEFAULT_TIMEOUT;
        firstCheck = false;
      }
      let met = false;
      try {
        met = await beat.until(ctx.snap, memo, ctx);
      } catch (e) {
        if (isAbort(e)) throw e;
        met = false;
      }
      if (met) break;
      if (takeSkip()) {
        status = "skipped";
        break;
      }
      const waited = wait.tick();
      if (waited >= limit) {
        status = "timeout";
        break;
      }
      if (shown && !paused()) {
        const line = beat.progress?.(ctx.snap, memo) ?? null;
        if (line) say({ kind: "progress", text: line });
        hooks.onTick?.(index, Math.min(0.95, screen.tick() / Math.max(1, beat.dwellMs / speed())), true);
      }
      try {
        ctx.snap = await env.next(signal);
      } catch (e) {
        if (isAbort(e)) throw e;
        await sleep(1000, signal);
      }
    }
  }

  if (beat.quiet && status !== "passed") return done("skipped", status === "timeout" ? "Not seen in this run" : "Skipped");
  if (!shown) {
    show();
    screen = activeClock(paused);
  }

  if (status === "passed") {
    let out: string | null = null;
    try {
      out = beat.outcome?.(ctx.snap, memo) ?? null;
    } catch {
      out = null;
    }
    const text = [note, out].filter(Boolean).join(" ");
    if (text) say({ kind: "outcome", text }, Boolean(beat.until));
    else if (beat.until) say(null);
  } else if (status === "timeout") {
    say({ kind: "timeout", text: beat.timeoutNote ?? "Still waiting on the board; going on." }, true);
  }
  await dwell();
  return done(status, status === "timeout" ? beat.timeoutNote ?? "timed out" : status === "skipped" ? "skipped by the presenter" : note);
}

/** Run every beat in order; a failed beat never stops the run. */
export async function runScript(beats: Beat[], env: AutoplayEnv, memo: Memo, hooks: RunHooks = {}, signal?: AbortSignal): Promise<BeatResult[]> {
  const results: BeatResult[] = [];
  for (let i = 0; i < beats.length; i++) {
    if (signal?.aborted) break;
    results.push(await runBeat(beats[i], i, env, memo, hooks, signal));
  }
  return results;
}
