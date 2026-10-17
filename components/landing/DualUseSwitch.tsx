"use client";

// The day switch for the dual-use section (components/landing/DualUse.tsx). Below lg it is a two-tab switch, the
// fire night or a hot Tuesday, and the ladder under it stays in place while each rung's text changes. The server
// renders both days' cells as children; this island only sets data-day (and data-switched after the first switch)
// on the panel, so CSS shows the chosen day's cells and fades them in. From lg up both days show side by side, so
// the switch hides and the panel drops its tab roles. The pill slides with motion/react (LazyMotion via MotionRoot);
// reduced motion keeps only the colour change.
import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { m } from "motion/react";
import { MotionRoot } from "./MotionRoot";
import { motionTokens as T } from "./motion";

export type Day = "fire" | "tuesday";
export type DayTab = { id: Day; emoji: string; label: string; tone: string };

/** Tailwind's lg breakpoint. From here up both days show at once, so there is nothing to switch. */
const WIDE = "(min-width: 64rem)";
function subscribe(onChange: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const isWide = () => window.matchMedia(WIDE).matches;
// The server renders the narrow (tabs) semantics; the client corrects it after hydration on wide screens.
const serverWide = () => false;

export function DualUseSwitch({ tabs, label, children }: { tabs: readonly [DayTab, DayTab]; label: string; children: ReactNode }) {
  const [active, setActive] = useState(0);
  const [switched, setSwitched] = useState(false);
  const wide = useSyncExternalStore(subscribe, isWide, serverWide);
  const uid = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabId = (i: number) => `${uid}-tab-${i}`;
  const panelId = `${uid}-panel`;
  const current = tabs[active];

  function select(i: number, focus: boolean) {
    if (i !== active) {
      setActive(i);
      setSwitched(true);
    }
    if (focus) refs.current[i]?.focus();
  }

  // Arrow keys move between the tabs and select (automatic activation); Home and End jump to the ends.
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = active === last ? 0 : active + 1;
    else if (e.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    select(next, true);
  }

  return (
    <MotionRoot>
      <div role="tablist" aria-label={label} className="relative mt-10 grid grid-cols-2 rounded-xl border border-white/10 bg-vf-ink p-1 lg:hidden">
        <m.span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg"
          initial={false}
          animate={{ x: `${active * 100}%`, backgroundColor: current.tone }}
          transition={{ duration: T.duration.normal, ease: T.easing.smooth }}
        />
        {tabs.map((t, i) => {
          const selected = i === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={tabId(i)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(i, false)}
              onKeyDown={onKeyDown}
              className={`relative z-10 flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 py-2 text-center text-sm font-semibold leading-tight transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember sm:text-[15px] ${
                selected ? "text-vf-ink" : "text-vf-smoke hover:text-vf-bone"
              }`}
            >
              <span aria-hidden="true" className="vf-emoji text-lg">
                {t.emoji}
              </span>
              <span className="text-balance">{t.label}</span>
            </button>
          );
        })}
      </div>
      <div
        id={panelId}
        role={wide ? undefined : "tabpanel"}
        aria-labelledby={wide ? undefined : tabId(active)}
        data-day={current.id}
        data-switched={switched ? "true" : undefined}
        className="group/dual"
      >
        {children}
      </div>
    </MotionRoot>
  );
}
