/** Where the card sits next to its target. "center" ignores the target and centers the card. */
export type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

/** A CSS selector (e.g. [data-tour="map"]) or a function that finds the element. */
export type TourTargetRef = string | (() => Element | null);

/** One target, or several tried in order: the first one on screen is highlighted. */
export type TourTarget = TourTargetRef | TourTargetRef[];

export interface TourAction {
  label: string;
  href: string;
}

export interface TourStep {
  /** Stable id: keys the step's animations and its enter and leave hooks. */
  id: string;
  /** What to highlight. Without one, or when none is on screen, the card is centered. */
  target?: TourTarget;
  title: string;
  /** One or two short sentences. Plain text, so the live region can read it out. */
  body: string;
  /** Read instead of `body` when the target is not on screen (a panel that only shows up later). */
  bodyWhenMissing?: string;
  placement?: TourPlacement;
  /**
   * Runs as the step opens, before the target is measured: switch a tab, unfold a legend. It may return a
   * function that undoes it when the step closes (kept by the tour, so a hot reload cannot lose it).
   */
  onEnter?: () => void | (() => void);
  /** Runs as the step closes. */
  onLeave?: () => void;
  /** The opening card: the VoiceFlare logo above the title. */
  hero?: boolean;
  /** Links under the body, opened in a new tab (the last step's "pick up a phone"). */
  actions?: TourAction[];
  /** Space between the target and the spotlight's edge, in px. */
  padding?: number;
}
