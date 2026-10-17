"use client";

// The tour engine: a modal <dialog> in the browser's top layer (above the map and its controls) that dims
// the screen, cuts a spotlight around each step's target and explains it in a card. Arrow keys and Enter
// step through, Escape closes, focus stays in the card, and every step is read out by a live region.
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  closedHole,
  holeFor,
  placeCard,
  resolveTarget,
  revealTarget,
  ScrollMemory,
  useTargetBox,
  useViewport,
  type Box,
  type CardSpot,
  type Size,
} from "./geometry";
import { motionTokens, NO_MOTION, springs } from "./motion";
import { isTourActive, markTourSeen, stopTour, useActiveTour } from "./store";
import type { TourStep } from "./types";

export interface TourProps {
  /** startTour(id) opens it; "seen" is remembered under it. */
  id: string;
  /** A short name at the top of the card, e.g. "Board tour". */
  label: string;
  steps: TourStep[];
  /**
   * Runs once as the tour opens, before the first step's onEnter. It may return a function that puts back
   * what the steps changed (the tab that was open); the tour keeps it and calls it on close.
   */
  onOpen?: () => void | (() => void);
  /** Runs as the tour closes. */
  onClose?: () => void;
}

const CARD_WIDTH = 384;
const RADIUS = 14;
const DIM = 0.74;
const DOT_PITCH = 12; // progress dot (6 px) plus gap (6 px)

/** Mounted wherever the tour belongs; renders nothing until startTour(id). */
export function Tour(props: TourProps) {
  const active = useActiveTour();
  const open = active !== null && active.id === props.id && props.steps.length > 0;
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>{open ? <TourDialog key={active.run} run={active.run} {...props} /> : null}</AnimatePresence>
    </MotionConfig>
  );
}

// Literal class names (Tailwind only sees whole strings); 384 px is CARD_WIDTH, the opening card is wider.
const CARD_MODE: Record<CardSpot["mode"], string> = {
  float: "left-0 top-0",
  "dock-bottom": "inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
  "dock-top": "inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))]",
};

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember";

function TourDialog({ id, run, label, steps, onOpen, onClose }: TourProps & { run: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const scrolls = useRef<ScrollMemory>(null);
  const undoOpen = useRef<(() => void) | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [index, setIndex] = useState(0);
  const [card, setCard] = useState<Size>({ w: CARD_WIDTH, h: 230 });
  const reduce = useReducedMotion() ?? false;
  const vp = useViewport();
  const reactId = useId();
  const maskId = `vf-tour-mask-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const titleId = `${maskId}-title`;
  const bodyId = `${maskId}-body`;

  const total = steps.length;
  const at = Math.min(index, total - 1);
  const step = steps[at];
  const isLast = at === total - 1;
  const { box, status } = useTargetBox(step.target, step.id);
  const hole = box ? holeFor(box, step.padding ?? 8, vp) : null;
  const lit = hole !== null && status !== "missing";
  const spotlight: Box = lit ? hole : closedHole(vp);
  const spot = placeCard(lit ? hole : null, card, vp, step.placement ?? "bottom");
  const body = status === "missing" && step.bodyWhenMissing ? step.bodyWhenMissing : step.body;

  const finish = () => {
    markTourSeen(id);
    stopTour(id);
  };
  const next = () => (isLast ? finish() : setIndex(at + 1));
  const back = () => setIndex(Math.max(0, at - 1));

  // Open the dialog as a modal (the board behind it goes inert) and run the tour's open hook, once per run.
  // On close: the hook's undo, every scroll position and the focus go back where they were. A cleanup that
  // runs while this run is still active is React re-running effects (Strict Mode, Fast Refresh): skip it.
  const opened = useEffectEvent(() => {
    const dialog = dialogRef.current;
    const memory = (scrolls.current ??= new ScrollMemory());
    if (!undoOpen.current) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const undo = onOpen?.();
      undoOpen.current = typeof undo === "function" ? undo : () => {};
    }
    if (dialog && !dialog.open) dialog.showModal();
    primaryRef.current?.focus({ preventScroll: true });
    return () => {
      if (isTourActive(id, run)) return;
      undoOpen.current?.();
      onClose?.();
      memory.restore();
      if (dialog?.open) dialog.close();
      if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
    };
  });
  useEffect(() => opened(), []);

  // Each step: its enter hook (switch a tab, unfold the legend), then the target scrolled into view once
  // the change has rendered; the hook's undo and the leave hook when the step closes.
  const entered = useEffectEvent(() => {
    const current = step;
    const undo = current.onEnter?.();
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const el = resolveTarget(current.target);
        if (el) revealTarget(el, !reduce, (scrolls.current ??= new ScrollMemory()));
      });
    });
    // Back on the first step hides Back, and the last step's links leave with it: keep focus in the card.
    const refocus = window.setTimeout(() => {
      if (!cardRef.current?.contains(document.activeElement)) primaryRef.current?.focus({ preventScroll: true });
    }, 250);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(refocus);
      if (typeof undo === "function") undo();
      current.onLeave?.();
    };
  });
  useEffect(() => entered(), [step.id]);

  // The card's real size, so it can be placed beside the spotlight without covering it.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setCard((c) => (c.w === el.offsetWidth && c.h === el.offsetHeight ? c : { w: el.offsetWidth, h: el.offsetHeight })),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLDialogElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      finish();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      back();
    } else if (e.key === "Enter" && !(e.target instanceof Element && e.target.closest("a, button"))) {
      // A focused button or link does its own job on Enter.
      e.preventDefault();
      next();
    } else if (e.key === "Tab") {
      trapFocus(e);
    }
  }

  function trapFocus(e: KeyboardEvent) {
    const el = cardRef.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")).filter(
      (item) => item.getClientRects().length > 0 && getComputedStyle(item).visibility !== "hidden",
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const now = document.activeElement;
    if (e.shiftKey && (now === first || !el.contains(now))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (now === last || !el.contains(now))) {
      e.preventDefault();
      first.focus();
    }
  }

  const travel = reduce ? NO_MOTION : springs.snappy;
  const lift = reduce ? 0 : motionTokens.distance.sm;
  const cardX = spot.mode === "float" ? spot.x : 0;
  const cardY = spot.mode === "float" ? spot.y : 0;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      data-tour-step={step.id}
      data-tour-target={lit ? "found" : status === "missing" ? "missing" : "pending"}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        finish();
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-hidden overscroll-contain border-0 bg-transparent p-0 text-vf-bone outline-none backdrop:bg-transparent"
    >
      {/* The dimmed board with the spotlight cut out of it; the flare ring marks the edge. */}
      <svg className="pointer-events-none fixed inset-0 h-full w-full" width={vp.w} height={vp.h} aria-hidden="true">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={vp.w} height={vp.h}>
            <rect x={0} y={0} width={vp.w} height={vp.h} fill="#fff" />
            <motion.rect
              rx={RADIUS}
              fill="#000"
              initial={false}
              animate={{ attrX: spotlight.x, attrY: spotlight.y, width: spotlight.w, height: spotlight.h }}
              transition={travel}
            />
          </mask>
        </defs>
        <motion.rect
          x={0}
          y={0}
          width={vp.w}
          height={vp.h}
          mask={`url(#${maskId})`}
          className="fill-vf-ink"
          initial={{ opacity: 0 }}
          animate={{ opacity: DIM }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.sharp } }}
          transition={{ duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth }}
        />
        <motion.rect
          rx={RADIUS}
          fill="none"
          strokeWidth={2}
          className="stroke-vf-flare [filter:drop-shadow(0_0_10px_rgb(255_107_61/0.6))]"
          initial={{ attrX: spotlight.x, attrY: spotlight.y, width: spotlight.w, height: spotlight.h, opacity: 0 }}
          animate={{ attrX: spotlight.x, attrY: spotlight.y, width: spotlight.w, height: spotlight.h, opacity: lit ? 1 : 0 }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
          transition={{ ...travel, opacity: { duration: motionTokens.duration.fast } }}
        />
        {lit && !reduce ? <LandingPing key={step.id} hole={hole} /> : null}
      </svg>

      <motion.div
        ref={cardRef}
        tabIndex={-1}
        className={`fixed z-10 rounded-2xl border border-vf-ash bg-vf-coal p-5 text-vf-bone shadow-[0_28px_80px_-24px_rgb(0_0_0/0.9),0_0_64px_-16px_rgb(255_42_18/0.4)] outline-none ${CARD_MODE[spot.mode]} ${
          spot.mode !== "float" ? "" : step.hero ? "w-[min(440px,calc(100vw-32px))]" : "w-[min(384px,calc(100vw-32px))]"
        }`}
        initial={{ opacity: 0, x: cardX, y: cardY + lift }}
        animate={{ opacity: 1, x: cardX, y: cardY }}
        exit={{ opacity: 0, y: cardY + lift, transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.sharp } }}
        transition={{ x: travel, y: travel, opacity: { duration: motionTokens.duration.fast } }}
      >
        {/* A flare seam along the top edge. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 -top-px h-px bg-linear-to-r from-transparent via-vf-flare to-transparent"
        />
        <div className="flex items-center gap-2.5">
          {step.hero ? null : <Image src="/brand/voiceflare-mark.png" alt="" width={24} height={24} className="size-6 shrink-0" />}
          <span className="min-w-0 truncate text-[13px] font-medium text-vf-smoke">{label}</span>
          <span className="ml-auto shrink-0 text-[13px] tabular-nums text-vf-smoke">
            {at + 1} of {total}
          </span>
          {isLast ? null : (
            <button
              type="button"
              onClick={finish}
              className={`-mr-1.5 shrink-0 rounded-md px-1.5 py-0.5 text-[13px] font-medium text-vf-smoke transition-colors hover:text-vf-bone ${FOCUS_RING}`}
            >
              Skip tour
            </button>
          )}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: motionTokens.duration.fast } }}
            exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
          >
            {step.hero ? <HeroLogo reduce={reduce} /> : null}
            <h2 id={titleId} className="mt-3 font-display text-[22px] font-semibold leading-tight text-vf-bone">
              {step.title}
            </h2>
            <p id={bodyId} className="mt-2 text-[15px] leading-relaxed text-vf-bone/75">
              {body}
            </p>
            {step.actions?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {step.actions.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full bg-white/5 px-4 text-sm font-semibold text-vf-bone ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/10 ${FOCUS_RING}`}
                  >
                    {a.label}
                    <span aria-hidden="true" className="text-vf-ember">
                      ↗
                    </span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>

        <div className="mt-5 flex items-center gap-3">
          <Progress total={total} at={at} reduce={reduce} />
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={back}
              disabled={at === 0}
              className={`h-9 rounded-full px-4 text-sm font-semibold text-vf-bone/80 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/5 hover:text-vf-bone ${FOCUS_RING} ${
                at === 0 ? "invisible" : ""
              }`}
            >
              Back
            </button>
            <motion.button
              ref={primaryRef}
              type="button"
              onClick={next}
              whileTap={{ scale: motionTokens.scale.press }}
              transition={springs.snappy}
              className={`h-9 min-w-[84px] rounded-full bg-vf-flare px-5 text-sm font-semibold text-vf-ink shadow-[0_0_24px_-6px_rgb(255_42_18/0.85)] transition-colors hover:bg-vf-ember ${FOCUS_RING}`}
            >
              {isLast ? "Done" : at === 0 ? "Start tour" : "Next"}
            </motion.button>
          </div>
        </div>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {`Step ${at + 1} of ${total}. ${step.title}. ${body}`}
        </p>
      </motion.div>
    </dialog>
  );
}

/** Where you are in the tour: a flare pill gliding along a row of dots. Decorative; the card says "3 of 14". */
function Progress({ total, at, reduce }: { total: number; at: number; reduce: boolean }) {
  return (
    <div aria-hidden="true" className="relative flex h-1.5 items-center gap-1.5">
      {Array.from({ length: total }, (_, k) => (
        <span key={k} className={`size-1.5 shrink-0 rounded-full ${k < at ? "bg-vf-ember/70" : "bg-vf-bone/20"}`} />
      ))}
      <motion.span
        className="absolute left-0 top-0 h-1.5 w-4 rounded-full bg-vf-flare shadow-[0_0_10px_rgb(255_42_18/0.8)]"
        initial={false}
        animate={{ x: at * DOT_PITCH - 5 }}
        transition={reduce ? NO_MOTION : springs.snappy}
      />
    </div>
  );
}

/** The opening card's logo: the emblem above the wordmark, glowing in once on an ember halo. */
function HeroLogo({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      className="relative mt-4 flex justify-center"
      initial={{ opacity: 0, scale: reduce ? 1 : motionTokens.scale.subtle }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduce ? motionTokens.duration.fast : motionTokens.duration.slow, ease: motionTokens.easing.smooth }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-12 -inset-y-2 bg-[radial-gradient(closest-side,rgb(255_42_18/0.22),transparent)]"
      />
      <Image
        src="/brand/voiceflare-logo-transparent.png"
        alt="VoiceFlare"
        width={989}
        height={666}
        sizes="180px"
        className="relative h-[116px] w-auto"
      />
    </motion.div>
  );
}

/**
 * When the spotlight lands, two rings leave its edge and fade, like the signal arcs in the emblem.
 * Once per step; never under reduced motion.
 */
function LandingPing({ hole }: { hole: Box }) {
  const [from] = useState(hole);
  const reach = motionTokens.distance.lg;
  return [0, 1].map((ring) => (
    <motion.rect
      key={ring}
      rx={RADIUS + 6}
      fill="none"
      strokeWidth={1.5}
      className="stroke-vf-ember"
      initial={{ attrX: from.x, attrY: from.y, width: from.w, height: from.h, opacity: 0 }}
      animate={{
        attrX: from.x - reach,
        attrY: from.y - reach,
        width: from.w + reach * 2,
        height: from.h + reach * 2,
        opacity: [0, 0.9, 0],
      }}
      transition={{
        duration: motionTokens.duration.crawl,
        ease: motionTokens.easing.smooth,
        delay: motionTokens.duration.normal + ring * motionTokens.stagger,
      }}
    />
  ));
}
