// Motion tokens for the guided tours (motion-foundations): every duration, easing, distance and spring the
// tour uses comes from here, so the spotlight, the card and the progress pill move as one system.
import type { Transition } from "motion/react";

type Bezier = [number, number, number, number];

export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.18,
    normal: 0.35,
    slow: 0.6,
    crawl: 1.0,
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1] as Bezier,
    sharp: [0.4, 0, 0.2, 1] as Bezier,
  },
  distance: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 48,
  },
  scale: {
    subtle: 0.98,
    press: 0.95,
    pop: 1.04,
  },
  /** Gap between the rings of the landing ping (seconds); inside the 0.05 to 0.10 stagger rule. */
  stagger: 0.09,
} as const;

export const springs = {
  snappy: { type: "spring", stiffness: 300, damping: 30 },
  gentle: { type: "spring", stiffness: 120, damping: 14 },
  bouncy: { type: "spring", stiffness: 400, damping: 10 },
  instant: { type: "spring", stiffness: 600, damping: 35 },
  release: { type: "spring", stiffness: 200, damping: 20, restDelta: 0.001 },
} satisfies Record<string, Transition>;

/** Reduced motion: no travel, at most a short fade. */
export const NO_MOTION: Transition = { duration: 0 };
