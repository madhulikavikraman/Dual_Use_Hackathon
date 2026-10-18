"use client";

// Six countries, one ladder: accessible tabs (arrow keys, Home, End; roving tabindex) over the six flood profiles in
// lib/floods.ts. The panel fades in on a switch; with reduced motion it only fades. Same marker spring as /global.
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { MotionConfig, motion } from "motion/react";
import type { JurisdictionCode } from "@/lib/jurisdictions";
import { FLOODS, FLOOD_CODES } from "@/lib/floods";
import { motionTokens, springs } from "@/components/global/motion";
import CountryPanel from "./CountryPanel";

export default function CountrySwitch({ initial = "IN" }: { initial?: JurisdictionCode }) {
  const [code, setCode] = useState<JurisdictionCode>(initial);
  // The first panel is visible from the server render; only a switch animates (no blank panel before hydration).
  const [switched, setSwitched] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const { duration, easing, distance } = motionTokens;

  const choose = (c: JurisdictionCode) => {
    setSwitched(true);
    setCode(c);
  };

  const select = (i: number) => {
    choose(FLOOD_CODES[i]);
    tabs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = FLOOD_CODES.length;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % n
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + n) % n
      : e.key === "Home" ? 0
      : e.key === "End" ? n - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    select(next);
  };

  const p = FLOODS[code];

  return (
    <MotionConfig reducedMotion="user">
      <div className="rounded-2xl border border-vf-ash bg-vf-coal/95 shadow-[0_0_90px_-40px_rgb(56_189_248/0.45)]">
        <div className="border-b border-vf-ash p-3 sm:p-4">
          <div role="tablist" aria-label="Country" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {FLOOD_CODES.map((c, i) => {
              const on = c === code;
              const f = FLOODS[c];
              return (
                <button
                  key={c}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${id}-tab-${c}`}
                  aria-selected={on}
                  aria-controls={`${id}-panel`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => choose(c)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={`relative min-h-12 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember ${
                    on
                      ? "border-vf-flare/60 bg-vf-ash text-vf-bone"
                      : "border-vf-ash bg-vf-ink/60 text-vf-smoke hover:border-vf-smoke/40 hover:text-vf-bone"
                  }`}
                >
                  <span className="block font-display text-sm font-semibold leading-tight">{f.country}</span>
                  <span className="block text-xs leading-tight opacity-80">{f.place}</span>
                  {on && (
                    <motion.span
                      layoutId="vff-tab-marker"
                      aria-hidden="true"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-vf-flare"
                      transition={springs.snappy}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-tab-${code}`}
          tabIndex={0}
          className="rounded-b-2xl p-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-vf-ember sm:p-6 lg:p-8"
        >
          <motion.div
            key={code}
            initial={switched ? { opacity: 0, y: distance.sm } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.normal, ease: easing.smooth }}
          >
            <CountryPanel p={p} headingId={`${id}-h-${code}`} />
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  );
}
