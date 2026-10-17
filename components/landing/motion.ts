// Motion tokens for the landing page (ecc motion-foundations): every duration, easing, distance and stagger used by
// the landing's client components comes from here, so the page moves as one system. Plain data, safe to import from
// server and client files.

type Bezier = [number, number, number, number];

export const motionTokens = {
  duration: { instant: 0.08, fast: 0.18, normal: 0.35, slow: 0.6, crawl: 1.0 },
  easing: {
    smooth: [0.22, 1, 0.36, 1] as Bezier,
    sharp: [0.4, 0, 0.2, 1] as Bezier,
  },
  distance: { xs: 4, sm: 8, md: 16, lg: 24 },
  /** Between list items; the motion skills keep this between 0.05 and 0.10 s. */
  stagger: 0.08,
};
