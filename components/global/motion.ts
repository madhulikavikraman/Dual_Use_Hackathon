// Motion tokens for /global (ecc motion-foundations): every duration, ease, distance and spring the page's client
// components use comes from here, so the motion reads as one system. Transform and opacity only. Reduced motion is
// handled where these are used (MotionConfig reducedMotion="user" plus useReducedMotion for delays). Client-safe.

export type Bezier = [number, number, number, number];

export const motionTokens = {
  duration: { instant: 0.08, fast: 0.18, normal: 0.35, slow: 0.6 },
  easing: {
    smooth: [0.22, 1, 0.36, 1] as Bezier,
    sharp: [0.4, 0, 0.2, 1] as Bezier,
  },
  distance: { xs: 4, sm: 8, md: 16 },
  scale: { press: 0.97 },
  /** Between the slots of the adapter switch: inside the 0.05-0.10 s rule. */
  stagger: 0.06,
};

export const springs = {
  /** Buttons, chips, the selected-tab marker. */
  snappy: { type: "spring", stiffness: 300, damping: 30 },
  /** The map dot settling onto the household. */
  gentle: { type: "spring", stiffness: 120, damping: 14 },
} as const;
