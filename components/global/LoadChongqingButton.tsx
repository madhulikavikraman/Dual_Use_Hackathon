"use client";

// "Load the Chongqing scenario": POST /api/demo/reset {scenario: "chongqing"}, then open /board. A reset wipes the run
// (calls, holds, registry, ledger) and keeps the twist log, so the first click asks once, inline.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import SignalGlyph from "./SignalGlyph";
import { motionTokens } from "./motion";

type Phase =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "loading"; started: number }
  | { kind: "done"; zones: number | null; households: number | null }
  | { kind: "error"; message: string };

interface ResetReply {
  ok?: boolean;
  zones?: number;
  households?: number;
  error?: string;
}

function Spinner() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="h-4 w-4 motion-safe:animate-spin">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const DEFAULT_NOTE = "Puts the Beibei scenario on the board. It replaces the current run; the twist log is kept.";

/** `note` is the line under the button while it is idle; false hides it. */
export default function LoadChongqingButton({ note = DEFAULT_NOTE }: { note?: ReactNode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const confirmBtn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const busy = phase.kind === "loading" || phase.kind === "done";
  const { duration, easing, distance, scale } = motionTokens;

  useEffect(() => {
    if (phase.kind !== "confirm") return;
    confirmBtn.current?.focus();
    router.prefetch("/board");
  }, [phase.kind, router]);

  useEffect(() => {
    if (phase.kind !== "loading") return;
    const started = phase.started;
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(t);
  }, [phase]);

  const cancel = () => {
    setPhase({ kind: "idle" });
    trigger.current?.focus();
  };

  async function load() {
    setElapsed(0);
    setPhase({ kind: "loading", started: Date.now() });
    try {
      const res = await fetch("/api/demo/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: "chongqing" }),
      });
      const j = (await res.json().catch(() => ({}))) as ResetReply;
      if (!res.ok || !j.ok) throw new Error(j.error ?? `the server answered HTTP ${res.status}`);
      setPhase({ kind: "done", zones: j.zones ?? null, households: j.households ?? null });
      router.push("/board");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setPhase({ kind: "error", message: message === "Failed to fetch" ? "the dev server did not answer" : message });
      trigger.current?.focus();
    }
  }

  const onTrigger = () => {
    if (busy) return;
    setPhase((p) => (p.kind === "confirm" ? { kind: "idle" } : { kind: "confirm" }));
  };

  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  const label = phase.kind === "loading" ? "Loading Chongqing" : phase.kind === "done" ? "Opening the board" : "Load the Chongqing scenario";

  return (
    <MotionConfig reducedMotion="user">
      <div className="max-w-md">
        <motion.button
          ref={trigger}
          type="button"
          onClick={onTrigger}
          aria-expanded={phase.kind === "confirm"}
          aria-controls={phase.kind === "confirm" ? `${id}-confirm` : undefined}
          aria-disabled={busy || undefined}
          whileTap={busy ? undefined : { scale: scale.press }}
          className={`inline-flex min-h-12 items-center gap-2.5 rounded-xl bg-vf-flare px-5 py-3 font-display text-base font-semibold text-vf-ink shadow-[0_0_40px_-12px_rgb(255_42_18/0.9)] transition-colors hover:bg-vf-ember focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vf-ember ${
            busy ? "cursor-progress opacity-90" : ""
          }`}
        >
          {busy ? <Spinner /> : <SignalGlyph className="h-4 w-8" />}
          {label}
        </motion.button>
        {note && phase.kind === "idle" ? <p className="mt-2 text-sm leading-relaxed text-vf-smoke">{note}</p> : null}

        <AnimatePresence mode="wait" initial={false}>
          {phase.kind === "confirm" && (
            <motion.div
              key="confirm"
              id={`${id}-confirm`}
              role="group"
              aria-labelledby={`${id}-q`}
              onKeyDown={onPanelKey}
              initial={{ opacity: 0, y: -distance.xs }}
              animate={{ opacity: 1, y: 0, transition: { duration: duration.fast, ease: easing.smooth } }}
              exit={{ opacity: 0, y: -distance.xs, transition: { duration: duration.instant, ease: easing.sharp } }}
              className="mt-3 rounded-xl border border-vf-flare/40 bg-vf-ink p-4"
            >
              <p id={`${id}-q`} className="text-sm text-vf-bone">
                This wipes the current run (calls, holds, registry, ledger) and loads Chongqing. The twist log is kept.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  ref={confirmBtn}
                  type="button"
                  onClick={load}
                  className="rounded-lg bg-vf-bone px-4 py-2 text-sm font-semibold text-vf-ink hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember"
                >
                  Load Chongqing
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  className="rounded-lg border border-vf-ash px-4 py-2 text-sm text-vf-smoke hover:text-vf-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Always mounted, so screen readers announce what is written into it. */}
        <p role="status" aria-live="polite" className="text-sm text-vf-smoke">
          {phase.kind === "loading" && <span className="mt-2 block">Wiping the run and seeding the Beibei zones. {elapsed} s</span>}
          {phase.kind === "done" && (
            <span className="mt-2 block">
              Loaded {phase.zones ?? "the"} zones{phase.households !== null ? ` and ${phase.households} households` : ""}. Opening the
              board.
            </span>
          )}
        </p>

        {phase.kind === "error" && (
          <div role="alert" className="mt-2 rounded-xl border border-vf-blood bg-vf-blood/15 p-4 text-sm text-vf-bone">
            <p>Could not load Chongqing: {phase.message}.</p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={load}
                className="font-semibold text-vf-ember underline underline-offset-4 hover:text-vf-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember"
              >
                Try again
              </button>
              <Link
                href="/demo"
                className="text-vf-smoke underline underline-offset-4 hover:text-vf-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember"
              >
                Use the demo console instead
              </Link>
            </p>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
