"use client";

// The hero's hold, replayed at 4x speed with the Westside scenario's own numbers and coordinates
// (lib/scenarios/westside.ts):
// - the Evacuation Order opens on a wrong, countywide polygon (about 9,800,000 people);
// - the Long Beach sentinel (the judge's phone) says "nothing here";
// - the supervisor edits the polygon to Culver City and Palms (about 41,000 people);
// - two sentinels on the zone's edge say yes, and the supervisor sends (simulated);
// - the canary just outside the zone confirms the alert did not reach it.
// It plays once when it scrolls into view and Replay runs it again. People who ask for reduced motion start on the
// finished state, and a replay they start has no tweens or zooms (MotionRoot sets reducedMotion="user").
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { animate, m, useInView, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { MotionRoot } from "./MotionRoot";
import { motionTokens as T } from "./motion";

const HOLD = 90; // the hold's clock, in seconds
const SPEED = 4; // the replay runs the clock 4 times faster than real time
const WRONG_DOSE = 9_800_000; // countywide polygon, estimate
const ZONE_DOSE = 41_000; // Culver City and Palms, estimate
const OVERSIZE = Math.round(WRONG_DOSE / ZONE_DOSE);
/** Seconds from the start: ringing, "nothing here", edit polygon, yes, yes, send, canary rings, canary clear. */
const AT = [0, 2, 3.4, 5.8, 6.8, 8.2, 9.4, 10.8];
const FINAL = AT.length - 1;
const SEND = 5;
const SENT_LEFT = HOLD - AT[SEND] * SPEED;

// The scenario's coordinates projected into a 360 x 150 box, twice: zoomed out to the countywide polygon, and zoomed
// in to the zone. Zooming from one to the other is the "Edit polygon" moment.
const COUNTY = "M117.6 10L242.4 10L242.4 93.6L228 111L199.2 134.2L180 140L168.5 131.9L158.9 107.5L158.9 101.7L132 105.2L117.6 99.4Z";
const ZONE_SMALL = "M167.9 103.4L169.6 101.8L171.6 101.1L173.4 102L173.1 104.6L171.6 107.2L169.9 107.5L168.7 106Z";
const ZONE_BIG = "M157.7 51L178.8 31.2L202.3 22.7L224.5 34L221 65.1L202.3 96.2L182.3 100.4L167.1 82.1Z";
const LONG_BEACH = { x: 190.2, y: 131.9 };
const EAST = { x: 218.1, y: 43.9 };
const SOUTH = { x: 192.9, y: 90.5 };
const CANARY = { x: 187.7, y: 129.5 };
const FIRE = { x: 141.3, y: 29.8 };
/** Where "The zone" sits in the zoomed-out view: just right of the zone's tiny shape. */
const ZONE_LABEL = { x: 177, y: 106.5 };
/** The zone's centre in each view, as a fraction of the box: the zoom pivots on it and pans between them. */
const PIVOT_OUT = { x: 0.474, y: 0.695 };
const PIVOT_IN = { x: 0.533, y: 0.402 };
const PAN = { x: `${((PIVOT_IN.x - PIVOT_OUT.x) * 100).toFixed(1)}%`, y: `${((PIVOT_IN.y - PIVOT_OUT.y) * 100).toFixed(1)}%` };
const PAN_BACK = { x: `${((PIVOT_OUT.x - PIVOT_IN.x) * 100).toFixed(1)}%`, y: `${((PIVOT_OUT.y - PIVOT_IN.y) * 100).toFixed(1)}%` };

const DOT = { ringing: "#60a5fa", yes: "#4ade80", no: "#fb923c", idle: "#71717a" };

type Answer = "ringing" | "yes" | "no";

const SENTINELS: { name: string; where: string; reply: string }[] = [
  { name: "Long Beach", where: "the judge's phone, far from the fire", reply: "Nothing here." },
  { name: "Culver City, east edge", where: "Phone 3", reply: "Yes, smoke to the west." },
  { name: "Culver City, south edge", where: "Phone 4", reply: "Yes, smoke to the west." },
];

const KEYS = [
  { id: "send", label: "Send now" },
  { id: "hold", label: "Hold once" },
  { id: "edit", label: "Edit polygon" },
  { id: "cancel", label: "Cancel" },
  { id: "handoff", label: "Hand off" },
] as const;

const SUMMARY =
  "What the replay shows: the hold opens on a countywide polygon that would wake about 9,800,000 people, 239 times the zone. " +
  "The sentinel in Long Beach answers “nothing here”. The supervisor edits the polygon to Culver City and Palms, about 41,000 people. " +
  "Two sentinels on Culver City’s edge answer “yes, smoke to the west”. The supervisor sends with 58 seconds left. " +
  "The canary phone in Westchester, outside the zone, did not get the alert, so delivery is clear. " +
  "If nobody had decided, the order would have sent on time at 0:00.";

const QUERY = "(prefers-reduced-motion: reduce)";
function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
/** The OS preference, read without a hydration mismatch (the server snapshot is "no preference"). */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}

const people = new Intl.NumberFormat("en-US");
function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function HoldReplay() {
  return (
    <MotionRoot>
      <Replay />
    </MotionRoot>
  );
}

function Replay() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduced = usePrefersReducedMotion();
  const [replays, setReplays] = useState(0);
  const [step, setStep] = useState(0);
  const left = useMotionValue(HOLD);
  const dose = useMotionValue(WRONG_DOSE);
  const clockText = useTransform(left, clock);
  const ring = useTransform(left, (v) => Math.max(0, v) / HOLD);
  const doseText = useTransform(dose, (v) => people.format(Math.round(v / 1000) * 1000));

  // Which run is playing: 0 none yet, 1 the automatic first run, 2 and up one per Replay press.
  const run = replays > 0 ? replays + 1 : inView && !reduced ? 1 : 0;
  // Reduced motion: show the finished state until the visitor asks for a replay.
  const settled = reduced && replays === 0;
  const s = settled ? FINAL : step;

  useEffect(() => {
    if (!settled) return;
    left.set(SENT_LEFT);
    dose.set(ZONE_DOSE);
  }, [settled, left, dose]);

  useEffect(() => {
    if (run === 0) return;
    left.set(HOLD);
    dose.set(WRONG_DOSE);
    const timers: number[] = [];
    const tweens = [animate(left, SENT_LEFT, { duration: AT[SEND], ease: "linear" })];
    AT.forEach((t, i) => {
      if (i === 0) return;
      timers.push(
        window.setTimeout(() => {
          setStep(i);
          if (i === 2) tweens.push(animate(dose, ZONE_DOSE, reduced ? { duration: 0 } : { duration: 1.1, ease: T.easing.smooth }));
        }, t * 1000),
      );
    });
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      tweens.forEach((tween) => tween.stop());
    };
  }, [run, reduced, left, dose]);

  const replay = () => {
    setStep(0);
    setReplays((n) => n + 1);
  };

  const answers: Answer[] = [s >= 1 ? "no" : "ringing", s >= 3 ? "yes" : "ringing", s >= 4 ? "yes" : "ringing"];
  const edited = s >= 2;
  const sent = s >= SEND;
  const canary = s >= 7 ? "clear" : s >= 6 ? "ringing" : "idle";
  const yes = answers.filter((a) => a === "yes").length;
  const no = answers.filter((a) => a === "no").length;

  return (
    <figure
      ref={ref}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-vf-coal shadow-[0_40px_120px_-40px_rgba(255,42,18,0.45)]"
    >
      <div aria-hidden="true">
        <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
          <div className="min-w-0">
            <p className="font-display text-[15px] font-semibold leading-tight text-vf-bone">Evacuation Order, on hold</p>
            <p className="mt-0.5 text-[13px] text-vf-smoke">Culver City and Palms</p>
          </div>
          <Status sent={sent} />
        </div>

        <MiniMap edited={edited} answers={answers} canary={canary} sent={sent} />

        <div className="flex items-center gap-4 px-4 pt-4 sm:px-5">
          <Ring ring={ring} clockText={clockText} sent={sent} />
          <div className="min-w-0">
            <p className="text-[13px] text-vf-smoke">Wakes about</p>
            <p className="font-display text-[clamp(1.6rem,1.25rem+1.2vw,2rem)] font-semibold leading-none tabular-nums text-vf-bone">
              <m.span>{doseText}</m.span> <span className="font-sans text-sm font-normal text-vf-smoke">people</span>
            </p>
            <p className="mt-1.5 min-h-[2.6em] text-[13px] leading-snug">
              {edited ? (
                <span className="text-vf-bone/85">Polygon: Culver City and Palms.</span>
              ) : (
                <span className="text-orange-300">Polygon: countywide, {OVERSIZE}&times; the zone. Check it.</span>
              )}
            </p>
          </div>
        </div>
        <p className="px-4 pb-4 pt-1 text-[13px] text-vf-smoke sm:px-5">If nobody decides, it sends on time at 0:00.</p>

        <div className="border-t border-white/10 px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-vf-bone">Sentinels at the edge</p>
            <p className="flex gap-1.5 text-[12px] font-semibold tabular-nums">
              <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-green-300">Yes {yes}</span>
              <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-orange-300">No {no}</span>
            </p>
          </div>
          <ul className="mt-1.5">
            {SENTINELS.map((x, i) => (
              <SentinelRow key={x.name} name={x.name} where={x.where} reply={x.reply} answer={answers[i]} />
            ))}
          </ul>
        </div>

        <ul className="flex flex-wrap gap-1 border-t border-white/10 px-4 py-3 sm:gap-1.5 sm:px-5">
          {KEYS.map((k) => {
            const used = (k.id === "edit" && edited) || (k.id === "send" && sent);
            const look =
              k.id === "send" && sent
                ? "border-vf-flare bg-vf-flare text-vf-ink"
                : used
                  ? "border-vf-ember/70 bg-vf-ember/15 text-vf-ember"
                  : "border-white/15 text-vf-smoke";
            return (
              <li key={k.id}>
                <m.span
                  className={`inline-flex h-7 items-center rounded-md border px-2 text-[12px] font-semibold transition-colors duration-300 ${look}`}
                  animate={used ? { scale: [1, 0.9, 1] } : { scale: 1 }}
                  transition={{ duration: T.duration.normal, ease: T.easing.sharp }}
                >
                  {k.label}
                </m.span>
              </li>
            );
          })}
        </ul>

        <div className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-x-2 border-t border-white/10 px-4 py-3 text-[13px] leading-snug sm:px-5">
          <span className="font-semibold text-vf-bone">Canary</span>
          <Swap
            show={canary}
            items={{
              idle: <span className="text-vf-smoke">After the send, a phone just outside the zone is asked whether the alert reached it.</span>,
              ringing: <span className="text-sky-300">Westchester, outside the zone: &ldquo;Did you just receive an evacuation order?&rdquo;</span>,
              clear: (
                <span className="text-vf-bone/90">
                  Westchester, outside the zone: &ldquo;No.&rdquo; <span className="font-semibold text-green-300">Delivery is clear.</span>
                </span>
              ),
            }}
          />
        </div>
      </div>

      <figcaption className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/30 px-4 py-2.5 text-[12px] leading-snug text-vf-smoke sm:px-5">
        <span>
          Replay of the demo&rsquo;s hold at 4&times; speed, with the Westside scenario&rsquo;s estimates.
          <span className="sr-only"> {SUMMARY}</span>
        </span>
        <button
          type="button"
          onClick={replay}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-white/15 px-3 text-[12px] font-semibold text-vf-bone transition-colors hover:border-vf-ember hover:text-vf-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" focusable="false">
            <path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5v2.8h2.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Replay
        </button>
      </figcaption>
    </figure>
  );
}

/**
 * One of several variants in the same spot. Every variant stays mounted in a single grid cell, so the box always has
 * the size of the largest one and a change is a plain opacity crossfade: no exit sequencing, no layout shift.
 */
function Swap<K extends string>({ show, items, className = "" }: { show: K; items: Record<K, ReactNode>; className?: string }) {
  return (
    <span className={`grid ${className}`}>
      {(Object.keys(items) as K[]).map((k) => (
        <m.span
          key={k}
          className="[grid-area:1/1]"
          initial={false}
          animate={{ opacity: k === show ? 1 : 0 }}
          transition={{ duration: T.duration.normal, ease: T.easing.smooth }}
        >
          {items[k]}
        </m.span>
      ))}
    </span>
  );
}

function Status({ sent }: { sent: boolean }) {
  return (
    <Swap
      className="shrink-0 justify-items-end"
      show={sent ? "sent" : "holding"}
      items={{
        holding: (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-vf-flare/15 px-2.5 py-1 text-[12px] font-semibold text-[#ff8b78]">
            <span className="relative flex size-1.5">
              <span className="vf-ping absolute inline-flex size-full rounded-full bg-vf-flare" />
              <span className="relative inline-flex size-1.5 rounded-full bg-vf-flare" />
            </span>
            Holding
          </span>
        ),
        sent: (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-green-500/15 px-2.5 py-1 text-[12px] font-semibold text-green-300">
            Sent
          </span>
        ),
      }}
    />
  );
}

function Ring({ ring, clockText, sent }: { ring: MotionValue<number>; clockText: MotionValue<string>; sent: boolean }) {
  return (
    <div className="relative size-[76px] shrink-0">
      <svg viewBox="0 0 80 80" className="size-full -rotate-90">
        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="6" />
        <m.circle
          cx="40"
          cy="40"
          r="34"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={`transition-[stroke] duration-500 ${sent ? "stroke-green-400" : "stroke-vf-flare"}`}
          style={{ pathLength: ring }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <m.span className="font-display text-[19px] font-semibold tabular-nums text-vf-bone">{clockText}</m.span>
        <span className="mt-1 text-[10px] text-vf-smoke">{sent ? "sent" : "left"}</span>
      </div>
    </div>
  );
}

function SentinelRow({ name, where, reply, answer }: { name: string; where: string; reply: string; answer: Answer }) {
  const tone = answer === "yes" ? "text-green-300" : answer === "no" ? "text-orange-300" : "text-sky-300";
  return (
    <li className="grid min-h-[2.6rem] grid-cols-[1.25rem_minmax(0,1fr)_9rem] items-center gap-x-2.5 py-1">
      <SignalIcon answer={answer} />
      <span className="min-w-0 leading-tight">
        <span className="block text-[13px] text-vf-bone">{name}</span>
        <span className="block text-[11px] text-vf-smoke">{where}</span>
      </span>
      <Swap
        className={`justify-items-end text-right text-[12.5px] font-medium leading-tight transition-colors duration-300 ${tone}`}
        show={answer === "ringing" ? "ringing" : "answered"}
        items={{ ringing: "Ringing", answered: `“${reply}”` }}
      />
    </li>
  );
}

/** A sentinel's phone: the emblem's arcs, pulsing while it rings (.vf-ring), then the answer's colour. */
function SignalIcon({ answer }: { answer: Answer }) {
  const color = DOT[answer];
  return (
    <svg viewBox="0 0 24 24" className="size-5" focusable="false">
      <g className={answer === "ringing" ? "vf-ring" : undefined} stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M8.6 8.4a5 5 0 0 0 0 7.2" />
        <path d="M15.4 8.4a5 5 0 0 1 0 7.2" />
        <path d="M5.8 5.8a9 9 0 0 0 0 12.4" />
        <path d="M18.2 5.8a9 9 0 0 1 0 12.4" />
      </g>
      <circle cx="12" cy="12" r="2.4" fill={color} />
    </svg>
  );
}

function MiniMap({
  edited,
  answers,
  canary,
  sent,
}: {
  edited: boolean;
  answers: Answer[];
  canary: "idle" | "ringing" | "clear";
  sent: boolean;
}) {
  const zoom = { duration: 1.1, ease: T.easing.smooth };
  const canaryColor = canary === "clear" ? DOT.yes : canary === "ringing" ? DOT.ringing : DOT.idle;
  return (
    <div className="relative aspect-[360/150] overflow-hidden border-y border-white/10 bg-[#08080a]">
      <svg viewBox="0 0 360 150" className="absolute inset-0 size-full">
        <defs>
          <pattern id="vf-map-dots" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="rgba(255,255,255,0.08)" />
          </pattern>
          <radialGradient id="vf-fire-glow">
            <stop offset="0" stopColor="#ffb08f" />
            <stop offset="0.35" stopColor="#ff6b3d" stopOpacity="0.85" />
            <stop offset="1" stopColor="#ff2a12" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="360" height="150" fill="url(#vf-map-dots)" />
      </svg>

      {/* Zoomed out: the countywide polygon the alert was about to use. */}
      <m.div
        className="absolute inset-0"
        style={{ originX: PIVOT_OUT.x, originY: PIVOT_OUT.y }}
        initial={false}
        animate={edited ? { scale: 12, x: PAN.x, y: PAN.y, opacity: 0 } : { scale: 1, x: "0%", y: "0%", opacity: 1 }}
        transition={zoom}
      >
        <svg viewBox="0 0 360 150" className="size-full">
          <path d={COUNTY} fill="rgba(255,42,18,0.1)" stroke="#ff2a12" strokeWidth="1.3" strokeDasharray="5 3" strokeLinejoin="round" />
          <path d={ZONE_SMALL} fill="#ff6b3d" />
          <MapDot {...LONG_BEACH} color={answers[0] === "no" ? DOT.no : DOT.ringing} pulse={answers[0] === "ringing"} />
          <text x={LONG_BEACH.x + 7} y={LONG_BEACH.y + 3} className="fill-vf-smoke text-[8px]">
            Long Beach
          </text>
          <text x={ZONE_LABEL.x} y={ZONE_LABEL.y} className="fill-vf-bone text-[8px]">
            The zone
          </text>
        </svg>
      </m.div>

      {/* Zoomed in: the zone's own polygon, its edge sentinels, the fire and the canary outside. */}
      <m.div
        className="absolute inset-0"
        style={{ originX: PIVOT_IN.x, originY: PIVOT_IN.y }}
        initial={false}
        animate={
          edited ? { scale: 1, x: "0%", y: "0%", opacity: 1 } : { scale: 1 / 12, x: PAN_BACK.x, y: PAN_BACK.y, opacity: 0 }
        }
        transition={zoom}
      >
        <svg viewBox="0 0 360 150" className="size-full">
          <path
            d={ZONE_BIG}
            fill="#ff2a12"
            fillOpacity={sent ? 0.3 : 0.12}
            stroke="#ff2a12"
            strokeWidth="1.6"
            strokeLinejoin="round"
            className="transition-[fill-opacity] duration-700"
          />
          <circle cx={FIRE.x} cy={FIRE.y} r="10" fill="url(#vf-fire-glow)" />
          <circle cx={FIRE.x} cy={FIRE.y} r="2.4" fill="#ffd2c2" />
          <text x={FIRE.x - 26} y={FIRE.y + 3} className="fill-[#ffb08f] text-[8px]">
            Fire
          </text>
          <MapDot {...EAST} color={answers[1] === "yes" ? DOT.yes : DOT.ringing} pulse={answers[1] === "ringing"} />
          <MapDot {...SOUTH} color={answers[2] === "yes" ? DOT.yes : DOT.ringing} pulse={answers[2] === "ringing"} />
          <MapDot {...CANARY} color={canaryColor} pulse={canary === "ringing"} />
          <text x={CANARY.x + 7} y={CANARY.y + 3} className="fill-vf-smoke text-[8px]">
            Canary, outside the zone
          </text>
        </svg>
      </m.div>

      <span className="absolute left-3 top-2.5 inline-flex items-center gap-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[11px] text-vf-bone/85">
        <svg viewBox="0 0 14 8" className="h-2 w-3.5" focusable="false">
          <path d="M1 4h12" stroke="#ff2a12" strokeWidth="1.6" strokeDasharray={edited ? undefined : "3 2"} />
        </svg>
        {edited ? "Edited to the zone" : "Countywide polygon"}
      </span>
    </div>
  );
}

function MapDot({ x, y, color, pulse }: { x: number; y: number; color: string; pulse?: boolean }) {
  return (
    <g>
      {pulse ? <circle cx={x} cy={y} r="3.4" fill="none" stroke={color} strokeWidth="1.2" className="vf-ping" /> : null}
      <circle cx={x} cy={y} r="3.4" fill={color} stroke="#08080a" strokeWidth="1.2" />
    </g>
  );
}
