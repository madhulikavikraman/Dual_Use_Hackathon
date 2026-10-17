"use client";

// Measuring for the tour: where the target is (tracked every frame, because the board re-renders every
// second and panels open and close), where the spotlight goes, where the card fits, and how to scroll a
// target into view and put every scroll position back afterwards.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TourPlacement, TourTarget } from "./types";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

/** Below this width the card docks to the top or bottom edge instead of floating next to the target. */
export const DOCK_BELOW = 640;
const MARGIN = 16; // card to viewport edge
const GAP = 16; // card to spotlight
const INSET = 4; // spotlight to viewport edge
/** About 130 ms: a tab switch or a fold-out renders its target before the target is called missing. */
const GRACE_FRAMES = 8;

// ---------- Viewport ----------

function subscribeViewport(callback: () => void) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}
// The layout viewport without scrollbars: what fixed elements and getBoundingClientRect measure against.
const readViewport = () => `${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`;
const readServerViewport = () => "1440x900";

export function useViewport(): Size {
  const [w, h] = useSyncExternalStore(subscribeViewport, readViewport, readServerViewport).split("x").map(Number);
  return { w, h };
}

// ---------- Target ----------

/** The first target that exists and has a size (a `hidden` panel measures 0 × 0 and is skipped). */
export function resolveTarget(target: TourTarget | undefined): Element | null {
  if (!target) return null;
  for (const ref of Array.isArray(target) ? target : [target]) {
    let el: Element | null = null;
    try {
      el = typeof ref === "function" ? ref() : document.querySelector(ref);
    } catch {
      el = null; // an invalid selector is a missing target, not a crash
    }
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 1 && r.height > 1) return el;
  }
  return null;
}

export type TargetStatus = "pending" | "found" | "missing";

interface Tracked {
  key: string;
  box: Box | null;
  status: TargetStatus;
}

const near = (a: Box, b: Box) =>
  Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;

/**
 * The target's box in viewport coordinates, re-measured every animation frame while the step is open.
 * While a new step's target is being looked for, it reports "pending" with the previous box, so the
 * spotlight waits where it is instead of flashing to the center.
 */
export function useTargetBox(target: TourTarget | undefined, key: string): { box: Box | null; status: TargetStatus } {
  const targetRef = useRef(target);
  useLayoutEffect(() => {
    targetRef.current = target;
  });
  const [tracked, setTracked] = useState<Tracked>({ key: "", box: null, status: "pending" });

  useEffect(() => {
    let raf = 0;
    let missingFrames = 0;
    let last: Tracked | null = null;
    const tick = () => {
      const current = targetRef.current;
      const el = resolveTarget(current);
      if (el) {
        missingFrames = 0;
        const r = el.getBoundingClientRect();
        const box = { x: r.left, y: r.top, w: r.width, h: r.height };
        if (!last || last.status !== "found" || !last.box || !near(last.box, box)) {
          last = { key, box, status: "found" };
          setTracked(last);
        }
      } else if (++missingFrames >= (current ? GRACE_FRAMES : 1) && last?.status !== "missing") {
        last = { key, box: null, status: "missing" };
        setTracked(last);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key]);

  if (!target) return { box: null, status: "missing" };
  if (tracked.key !== key) return { box: tracked.box, status: "pending" };
  return tracked;
}

// ---------- Spotlight and card ----------

/** The spotlight: the target plus padding, kept on screen. Null when almost none of it is on screen. */
export function holeFor(box: Box, pad: number, vp: Size): Box | null {
  const x1 = Math.max(INSET, box.x - pad);
  const y1 = Math.max(INSET, box.y - pad);
  const x2 = Math.min(vp.w - INSET, box.x + box.w + pad);
  const y2 = Math.min(vp.h - INSET, box.y + box.h + pad);
  if (x2 - x1 < 8 || y2 - y1 < 8) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** A zero-size hole in the middle of the screen: the spotlight closed, for centered steps. */
export const closedHole = (vp: Size): Box => ({ x: vp.w / 2, y: vp.h / 2, w: 0, h: 0 });

export interface CardSpot {
  mode: "float" | "dock-top" | "dock-bottom";
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number) => (hi < lo ? lo : Math.min(hi, Math.max(lo, v)));

type Side = Exclude<TourPlacement, "center">;
const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

/**
 * Where the card goes: on the preferred side of the spotlight, else the opposite side, else whichever
 * side has room; centered when there is no target. On narrow screens it docks to the edge away from the
 * target, so it never sits on top of what it describes.
 */
export function placeCard(hole: Box | null, card: Size, vp: Size, placement: TourPlacement = "bottom"): CardSpot {
  if (vp.w < DOCK_BELOW) {
    const targetLow = hole !== null && hole.y + hole.h / 2 > vp.h * 0.55;
    return { mode: targetLow ? "dock-top" : "dock-bottom", x: 0, y: 0 };
  }
  const centered: CardSpot = {
    mode: "float",
    x: clamp((vp.w - card.w) / 2, MARGIN, vp.w - card.w - MARGIN),
    y: clamp((vp.h - card.h) / 2, MARGIN, vp.h - card.h - MARGIN),
  };
  if (!hole || placement === "center") return centered;

  const room: Record<Side, number> = {
    top: hole.y - MARGIN - GAP,
    bottom: vp.h - (hole.y + hole.h) - MARGIN - GAP,
    left: hole.x - MARGIN - GAP,
    right: vp.w - (hole.x + hole.w) - MARGIN - GAP,
  };
  const fits = (s: Side) => room[s] >= (s === "top" || s === "bottom" ? card.h : card.w);
  const others = (["bottom", "right", "left", "top"] as Side[])
    .filter((s) => s !== placement && s !== OPPOSITE[placement])
    .sort((a, b) => room[b] - room[a]);
  const side = [placement, OPPOSITE[placement], ...others].find(fits);

  const cx = clamp(hole.x + hole.w / 2 - card.w / 2, MARGIN, vp.w - card.w - MARGIN);
  const cy = clamp(hole.y + hole.h / 2 - card.h / 2, MARGIN, vp.h - card.h - MARGIN);
  switch (side) {
    case "bottom":
      return { mode: "float", x: cx, y: hole.y + hole.h + GAP };
    case "top":
      return { mode: "float", x: cx, y: hole.y - GAP - card.h };
    case "right":
      return { mode: "float", x: hole.x + hole.w + GAP, y: cy };
    case "left":
      return { mode: "float", x: hole.x - GAP - card.w, y: cy };
    default:
      // The target fills the screen: the card floats over its lower right corner.
      return {
        mode: "float",
        x: clamp(hole.x + hole.w - card.w - GAP, MARGIN, vp.w - card.w - MARGIN),
        y: clamp(hole.y + hole.h - card.h - GAP, MARGIN, vp.h - card.h - MARGIN),
      };
  }
}

// ---------- Scrolling ----------

/** Every scroll position the tour moved, put back when it ends. */
export class ScrollMemory {
  private saved = new Map<Element, { left: number; top: number }>();

  remember(el: Element) {
    if (!this.saved.has(el)) this.saved.set(el, { left: el.scrollLeft, top: el.scrollTop });
  }

  restore() {
    for (const [el, at] of this.saved) {
      if (el.isConnected) el.scrollTo({ left: at.left, top: at.top, behavior: "instant" });
    }
    this.saved.clear();
  }
}

/** Scrolls the target into view if any part of it is hidden; "nearest" leaves a visible target alone. */
export function revealTarget(el: Element, smooth: boolean, memory: ScrollMemory) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1) memory.remember(node);
  }
  if (document.scrollingElement) memory.remember(document.scrollingElement);
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: smooth ? "smooth" : "instant" });
}
