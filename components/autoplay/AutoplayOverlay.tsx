"use client";

// "Play the full fire" on the real board: a caption card docked at the map's lower right (clear of the hold strip,
// the registry and the middle of the map), the five ladder rungs with the current one lit, Pause, Skip, speed and
// Exit, plus a ring around what the caption talks about. Not modal: the board stays live and clickable underneath.
// The spotlight geometry comes from the guided tour (components/tour), imported, not copied.
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { useBoard } from "@/components/board/BoardContext";
import { DOCK_BELOW, holeFor, useTargetBox, useViewport } from "@/components/tour/geometry";
import { motionTokens, NO_MOTION, springs } from "@/components/tour/motion";
import { BEATS, RUNGS, VISIBLE_BEATS, type Beat, type Rung } from "@/lib/autoplay/script";
import { plain } from "@/lib/ui/display";
import { autoplay, exitOnPageHide, useAutoplay, type AutoplayState } from "./controller";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember";
const BTN = `inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-vf-bone ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/10 disabled:opacity-40 ${FOCUS_RING}`;
const PRIMARY = `inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-vf-flare px-5 text-sm font-semibold text-vf-ink shadow-[0_0_24px_-6px_rgb(255_42_18/0.85)] transition-colors hover:bg-vf-ember ${FOCUS_RING}`;
const MAP = '[data-tour="map"]';

/** Mounted on /board inside the board's provider. Renders nothing until the header button or ?autoplay=1. */
export function AutoplayOverlay() {
  const { snap, refresh } = useBoard();
  const s = useAutoplay();

  useEffect(() => {
    autoplay.attach(refresh);
    return () => autoplay.detach();
  }, [refresh]);

  useEffect(() => {
    autoplay.pushSnapshot(snap);
  }, [snap]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("autoplay") !== "1") return;
    // A moment for the map to draw first; once per page load.
    const timer = window.setTimeout(() => autoplay.autoStart(), 600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", exitOnPageHide);
    return () => window.removeEventListener("pagehide", exitOnPageHide);
  }, []);

  if (s.status === "closed") return null;
  const beat = s.shown !== null ? BEATS[s.shown] : null;
  return (
    <MotionConfig reducedMotion="user">
      {s.status === "running" && beat?.focus?.target ? <Spotlight target={beat.focus.target} id={beat.id} /> : null}
      {s.status === "end" ? <EndCard s={s} /> : <Dock s={s} beat={beat} />}
    </MotionConfig>
  );
}

// ---------- Spotlight: a ring, no dimming (the board stays readable) ----------

function Spotlight({ target, id }: { target: string | string[]; id: string }) {
  const { box } = useTargetBox(target, `autoplay-${id}`);
  const vp = useViewport();
  const reduce = useReducedMotion() ?? false;
  const hole = box ? holeFor(box, 5, vp) : null;
  const travel = reduce ? NO_MOTION : springs.snappy;
  return (
    <AnimatePresence>
      {hole ? (
        <motion.div
          key="ring"
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 z-[1090] rounded-xl border-2 border-vf-flare shadow-[0_0_0_4px_rgb(255_42_18/0.16),0_0_28px_rgb(255_42_18/0.45)]"
          initial={{ opacity: 0, x: hole.x, y: hole.y, width: hole.w, height: hole.h }}
          animate={{ opacity: 1, x: hole.x, y: hole.y, width: hole.w, height: hole.h }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.fast } }}
          transition={{ ...travel, opacity: { duration: reduce ? 0 : motionTokens.duration.fast } }}
        />
      ) : null}
    </AnimatePresence>
  );
}

// ---------- The docked caption card ----------

/**
 * Over the map's lower right, above the map credits: on the Westside map that is South LA, away from the zones, the
 * legend (lower left), the feed cards (upper left) and the right column (hold strip, registry). Null below the dock
 * width: then it sits at the bottom of the screen.
 */
function useDockStyle(): CSSProperties | null {
  const { box } = useTargetBox(MAP, "autoplay-dock");
  const vp = useViewport();
  if (vp.w < DOCK_BELOW) return null;
  if (!box) return { right: 16, bottom: 16 };
  const bottom = Math.max(12, vp.h - (box.y + box.h) + 26);
  const right = Math.max(12, vp.w - (box.x + box.w) + 12);
  return { right, bottom, maxHeight: Math.max(200, box.h - 26 - 12) };
}

function Badge() {
  return (
    <span className="shrink-0 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-950">
      Demo · autoplay
    </span>
  );
}

function Ladder({ current }: { current: Rung | null }) {
  return (
    <ol aria-label="The ladder" className="flex flex-wrap gap-1">
      {RUNGS.map((r) => {
        const on = r.id === current;
        return (
          <li
            key={r.id}
            aria-current={on ? "step" : undefined}
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors motion-reduce:transition-none ${
              on ? "bg-vf-flare text-vf-ink shadow-[0_0_14px_-2px_rgb(255_42_18/0.8)]" : "bg-white/5 text-vf-smoke ring-1 ring-inset ring-white/10"
            }`}
          >
            {r.label}
          </li>
        );
      })}
    </ol>
  );
}

function Dock({ s, beat }: { s: AutoplayState; beat: Beat | null }) {
  const style = useDockStyle();
  const reduce = useReducedMotion() ?? false;
  const titleId = useId();
  const total = VISIBLE_BEATS + s.extraShown;
  const n = Math.max(1, s.shownCount);
  const progress = s.status === "running" ? Math.min(100, Math.round(((Math.max(0, s.shownCount - 1) + s.frac) / total) * 100)) : 0;
  const place = style ? "" : "inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))]";
  const enter = reduce ? NO_MOTION : { duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth };
  const lift = reduce ? 0 : motionTokens.distance.sm;

  if (s.collapsed && s.status === "running") {
    return (
      <motion.section
        aria-label="Autoplay"
        style={style ? { right: style.right, bottom: style.bottom } : undefined}
        className={`fixed z-[1100] flex items-center gap-2 rounded-full border border-vf-ash bg-vf-coal py-1.5 pl-2 pr-1.5 text-vf-bone shadow-[0_18px_50px_-18px_rgb(0_0_0/0.9)] ${place}`}
        initial={{ opacity: 0, y: lift }}
        animate={{ opacity: 1, y: 0 }}
        transition={enter}
      >
        <Badge />
        <span className="text-[13px] tabular-nums text-vf-smoke">
          {n}/{total}
          {beat ? ` · ${RUNGS.find((r) => r.id === beat.rung)?.label}` : ""}
        </span>
        <button type="button" className={BTN} onClick={() => autoplay.togglePause()} aria-pressed={s.paused}>
          {s.paused ? "Resume" : "Pause"}
        </button>
        <button type="button" className={BTN} onClick={() => autoplay.setCollapsed(false)} aria-expanded={false}>
          Show captions
        </button>
        <LiveRegion s={s} beat={beat} />
      </motion.section>
    );
  }

  return (
    <motion.section
      aria-labelledby={titleId}
      style={style ?? undefined}
      className={`fixed z-[1100] flex w-[min(392px,calc(100vw-1.5rem))] flex-col overflow-y-auto rounded-2xl border border-vf-ash bg-vf-coal p-4 text-vf-bone shadow-[0_28px_80px_-24px_rgb(0_0_0/0.9),0_0_48px_-16px_rgb(255_42_18/0.35)] ${place}`}
      initial={{ opacity: 0, y: lift }}
      animate={{ opacity: 1, y: 0 }}
      transition={enter}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-8 -top-px h-px bg-linear-to-r from-transparent via-vf-flare to-transparent" />
      <div className="flex items-center gap-2">
        <Image src="/brand/voiceflare-mark.png" alt="" width={20} height={20} className="size-5 shrink-0" />
        <Badge />
        {s.status === "running" ? (
          <span className="ml-auto shrink-0 text-[12px] tabular-nums text-vf-smoke">
            Beat {n} of {total}
          </span>
        ) : (
          <span className="ml-auto" />
        )}
        {s.status === "running" ? (
          <button
            type="button"
            onClick={() => autoplay.setCollapsed(true)}
            aria-expanded={true}
            title="Fold the captions into a small bar"
            className={`-mr-1 shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-vf-smoke transition-colors hover:text-vf-bone ${FOCUS_RING}`}
          >
            Hide
          </button>
        ) : null}
      </div>

      {s.status === "intro" ? (
        <Intro titleId={titleId} />
      ) : (
        <>
          <div className="mt-3">
            <Ladder current={beat?.rung ?? null} />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={beat?.id ?? "starting"}
              initial={{ opacity: 0, y: reduce ? 0 : motionTokens.distance.xs }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: reduce ? 0 : motionTokens.duration.instant } }}
              transition={reduce ? NO_MOTION : { duration: motionTokens.duration.fast, ease: motionTokens.easing.smooth }}
            >
              <h2 id={titleId} className="mt-3 font-display text-[19px] font-semibold leading-tight text-vf-bone">
                {plain(beat?.title) ?? "Starting the run"}
              </h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-vf-bone/80">{plain(beat?.caption) ?? "Resetting the Westside Fire scenario."}</p>
            </motion.div>
          </AnimatePresence>
          <StatusLine s={s} />
          <div
            role="progressbar"
            aria-label="Run progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10"
          >
            <div
              className="h-full rounded-full bg-vf-flare transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <Controls s={s} />
          <LiveRegion s={s} beat={beat} />
        </>
      )}
    </motion.section>
  );
}

function Intro({ titleId }: { titleId: string }) {
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => startRef.current?.focus(), []);
  return (
    <div>
      <h2 id={titleId} className="mt-3 font-display text-[20px] font-semibold leading-tight text-vf-bone">
        Play the full fire
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-vf-bone/80">
        Resets the Westside Fire and plays the whole run on this board in about 4 minutes, with captions. Autopilot answers
        for the six volunteer phones. Nothing reaches a real alert system, and autoplay&apos;s decisions are not counted as human ones.
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-vf-smoke">This wipes the current run. The twist log is kept.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button ref={startRef} type="button" className={PRIMARY} onClick={() => autoplay.start()}>
          Start
        </button>
        <button type="button" className={`${BTN} h-9 px-4`} onClick={() => void autoplay.exit()}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function StatusLine({ s }: { s: AutoplayState }) {
  let text: ReactNode = null;
  let tone = "text-vf-smoke";
  if (s.paused) {
    text = "Paused. The run keeps going on the server, so a hold still sends on time.";
    tone = "text-amber-300";
  } else if (s.line) {
    text = plain(s.line.text);
    tone =
      s.line.kind === "outcome" ? "text-vf-bone" : s.line.kind === "timeout" ? "text-amber-300" : s.line.kind === "error" ? "text-red-300" : "text-vf-smoke";
  } else if (s.waiting) {
    text = "Waiting for the board…";
  }
  return (
    <p className={`mt-2 min-h-[1.25rem] text-[13px] leading-snug ${tone}`}>
      {s.line?.kind === "outcome" && !s.paused ? (
        <span aria-hidden="true" className="mr-1 text-vf-ember">
          ↳
        </span>
      ) : null}
      {text}
    </p>
  );
}

function Controls({ s }: { s: AutoplayState }) {
  const running = s.status === "running";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <button type="button" className={BTN} onClick={() => autoplay.togglePause()} aria-pressed={s.paused} disabled={!running}>
        {s.paused ? "Resume" : "Pause"}
      </button>
      <button type="button" className={BTN} onClick={() => autoplay.skip()} disabled={!running || s.shown === null} title="Move on to the next beat now">
        Skip
      </button>
      <div role="group" aria-label="Speed" className="flex items-center rounded-full ring-1 ring-inset ring-white/15">
        {([1, 2, 4] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={s.speed === v}
            onClick={() => autoplay.setSpeed(v)}
            title={v === 4 ? "Quarter the reading time; the run itself goes in real time" : v === 2 ? "Half the reading time; the run itself goes in real time" : "Normal reading time"}
            className={`h-8 min-w-10 rounded-full px-2.5 text-[13px] font-semibold tabular-nums transition-colors ${FOCUS_RING} ${
              s.speed === v ? "bg-vf-bone text-vf-ink" : "text-vf-bone/80 hover:bg-white/10"
            }`}
          >
            {v}x
          </button>
        ))}
      </div>
      <button type="button" className={`${BTN} ml-auto`} onClick={() => void autoplay.exit()}>
        Exit
      </button>
    </div>
  );
}

/** Reads each beat out once, and its result line (not the per-second progress). */
function LiveRegion({ s, beat }: { s: AutoplayState; beat: Beat | null }) {
  const result = s.line && s.line.kind !== "progress" ? s.line.text : "";
  return (
    <>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {beat ? plain(`${beat.title}. ${beat.caption}`) : ""}
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {s.paused ? "Paused." : result}
      </p>
    </>
  );
}

// ---------- End card ----------

function EndCard({ s }: { s: AutoplayState }) {
  const titleId = useId();
  const replayRef = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion() ?? false;
  useEffect(() => replayRef.current?.focus(), []);
  const lines = autoplay.recap();
  const required = s.results.filter((r) => !r.optional);
  const played = required.filter((r) => r.status === "passed").length;
  const late = required.filter((r) => r.status === "timeout").length;
  const failed = required.filter((r) => r.status === "failed").length;
  const extra = s.results.filter((r) => r.optional && r.status === "passed").length;
  const secs = s.startedAt && s.endedAt ? Math.round((s.endedAt - s.startedAt) / 1000) : null;
  const took = secs === null ? "" : ` in ${Math.floor(secs / 60)} min ${secs % 60} s`;

  return (
    <div className="fixed inset-0 z-[1100] grid place-items-center overflow-y-auto bg-vf-ink/55 p-3">
      <motion.section
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === "Escape") void autoplay.exit();
        }}
        className="relative w-[min(560px,100%)] rounded-2xl border border-vf-ash bg-vf-coal p-5 text-vf-bone shadow-[0_28px_80px_-24px_rgb(0_0_0/0.9),0_0_64px_-16px_rgb(255_42_18/0.4)]"
        initial={{ opacity: 0, y: reduce ? 0 : motionTokens.distance.md }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? NO_MOTION : springs.snappy}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-10 -top-px h-px bg-linear-to-r from-transparent via-vf-flare to-transparent" />
        <div className="flex items-center gap-2">
          <Image src="/brand/voiceflare-mark.png" alt="" width={24} height={24} className="size-6 shrink-0" />
          <Badge />
        </div>
        <h2 id={titleId} className="mt-3 font-display text-[24px] font-semibold leading-tight">
          The whole ladder, one fire
        </h2>
        <p className="mt-1 text-[14px] text-vf-smoke">
          {played} of {required.length} beats played as scripted{took}
          {late ? `; ${late} moved on after a wait` : ""}
          {failed ? `; ${failed} did not go through` : ""}
          {extra ? `; ${extra} extra` : ""}.
        </p>
        <ol className="mt-4 flex flex-col gap-2.5">
          {RUNGS.map((r) => (
            <li key={r.id} className="grid grid-cols-[8.5rem_1fr] items-baseline gap-3 max-[420px]:grid-cols-1 max-[420px]:gap-0.5">
              <span className="font-display text-[15px] font-semibold text-vf-ember">{r.label}</span>
              <span className="text-[14px] leading-relaxed text-vf-bone/85">{plain(lines[r.id])}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[13px] leading-relaxed text-vf-smoke">
          Autoplay signed its decisions as a stand-in supervisor; the board counts none of them as human decisions.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button ref={replayRef} type="button" className={PRIMARY} onClick={() => autoplay.start()}>
            Replay
          </button>
          <Link href="/evidence" target="_blank" rel="noreferrer" className={`${BTN} h-9 px-4`}>
            Open evidence
            <span aria-hidden="true" className="text-vf-ember">
              ↗
            </span>
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
          <button type="button" className={`${BTN} ml-auto h-9 px-4`} onClick={() => void autoplay.exit()}>
            Exit
          </button>
        </div>
      </motion.section>
    </div>
  );
}
