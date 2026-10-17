"use client";

// The hero's adapter switch: pick a place and the six adapter slots (red) re-fill in that country's words, while the
// six invariants (white) stay where they are. That is Twist 2's answer in one gesture: the product does not change,
// six adapters do. Every value comes from lib/jurisdictions.ts or its short forms in ./content.
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { JURISDICTIONS, type JurisdictionCode } from "@/lib/jurisdictions";
import { CODES, INVARIANTS, PLACES, SHORT, SLOTS, type SlotKey } from "./content";
import LocalText from "./LocalText";
import SignalGlyph from "./SignalGlyph";
import { motionTokens, springs } from "./motion";

const SERVICE: Record<"fire" | "medical" | "police", string> = { fire: "fire", medical: "ambulance", police: "police" };

/** The other emergency numbers a caller may need, e.g. "120 ambulance, 110 police"; "" when one number covers all. */
function otherNumbers(code: JurisdictionCode): string {
  const j = JURISDICTIONS[code];
  return (Object.keys(SERVICE) as (keyof typeof SERVICE)[])
    .filter((k) => j.emergency[k] && j.emergency[k] !== j.call_now)
    .map((k) => `${j.emergency[k]} ${SERVICE[k]}`)
    .join(", ");
}

function SlotValue({ code, slot }: { code: JurisdictionCode; slot: SlotKey }) {
  const j = JURISDICTIONS[code];
  const lang = PLACES[code].script;
  if (slot === "ladder") {
    return (
      <span className="font-display text-lg font-semibold leading-snug text-vf-bone sm:text-xl">
        <LocalText text={j.labels.order} lang={lang} />
      </span>
    );
  }
  if (slot === "number") {
    const others = otherNumbers(code);
    return (
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="font-display text-2xl font-bold leading-none text-vf-flare sm:text-[1.75rem]">{j.call_now}</span>
        <span className="text-sm text-vf-smoke">{others ? `also ${others}` : "one number for fire, ambulance and police"}</span>
      </span>
    );
  }
  return (
    <span className="text-sm leading-relaxed text-vf-bone/90">
      <LocalText text={SHORT[code][slot]} lang={lang} />
    </span>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-vf-bone/70">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export default function AdapterSwitch({ initial = "CN" }: { initial?: JurisdictionCode }) {
  const [code, setCode] = useState<JurisdictionCode>(initial);
  const reduce = useReducedMotion();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const { duration, easing, distance, stagger } = motionTokens;

  const select = (i: number) => {
    setCode(CODES[i]);
    tabs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = CODES.length;
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

  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-labelledby={`${id}-title`}
        className="vfg-rise relative overflow-hidden rounded-2xl border border-vf-ash bg-vf-coal/95 shadow-[0_0_90px_-30px_rgb(255_42_18/0.55)]"
        style={{ "--vfg-delay": "120ms" } as CSSProperties}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-vf-flare/70 to-transparent"
        />
        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <SignalGlyph key={code} pulse className="mt-1 h-5 w-10 shrink-0 text-vf-flare" />
            <div>
              <h2 id={`${id}-title`} className="font-display text-lg font-semibold text-vf-bone">
                Six adapters, six places
              </h2>
              <p className="mt-0.5 text-sm text-vf-smoke">Pick a place. The red slots change; the white rules never do.</p>
            </div>
          </div>

          <div role="tablist" aria-label="Place" className="mt-4 grid grid-cols-3 gap-1.5">
            {CODES.map((c, i) => {
              const on = c === code;
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
                  onClick={() => setCode(c)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={`relative rounded-lg border px-2 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember sm:px-3 ${
                    on
                      ? "border-vf-flare/60 bg-vf-ash text-vf-bone"
                      : "border-vf-ash bg-vf-ink/60 text-vf-smoke hover:border-vf-smoke/40 hover:text-vf-bone"
                  }`}
                >
                  <span className="block font-display text-[0.8rem] font-semibold leading-tight sm:text-sm">{PLACES[c].place}</span>
                  <span className="block text-[0.7rem] leading-tight opacity-80 sm:text-xs">{PLACES[c].country}</span>
                  {on && (
                    <motion.span
                      layoutId="vfg-tab-marker"
                      aria-hidden="true"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-vf-flare"
                      transition={springs.snappy}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`${id}-panel`}
            aria-labelledby={`${id}-tab-${code}`}
            tabIndex={0}
            className="mt-4 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vf-ember"
          >
            <dl>
              {SLOTS.map((s, i) => (
                <div key={s.key} className="grid gap-x-4 gap-y-1 border-t border-vf-ash py-2.5 sm:grid-cols-[10.5rem_minmax(0,1fr)]">
                  <dt className="flex items-center gap-2 text-xs font-medium text-vf-smoke sm:text-[0.8rem]">
                    <span
                      key={code}
                      aria-hidden="true"
                      className="vfg-socket h-2 w-2 shrink-0 rounded-full bg-vf-flare"
                      style={{ "--vfg-i": i } as CSSProperties}
                    />
                    {s.name}
                  </dt>
                  <dd className="grid">
                    {CODES.map((c) => {
                      const on = c === code;
                      return (
                        <motion.div
                          key={c}
                          className="col-start-1 row-start-1 min-w-0"
                          aria-hidden={on ? undefined : true}
                          inert={!on}
                          initial={false}
                          animate={on ? "on" : "off"}
                          variants={{
                            on: {
                              opacity: 1,
                              y: 0,
                              transition: {
                                duration: duration.normal,
                                ease: easing.smooth,
                                delay: reduce ? 0 : duration.fast + i * stagger,
                              },
                            },
                            off: { opacity: 0, y: distance.sm, transition: { duration: duration.fast, ease: easing.sharp } },
                          }}
                        >
                          <SlotValue code={c} slot={s.key} />
                        </motion.div>
                      );
                    })}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-2 rounded-xl border border-vf-bone/15 bg-vf-ink/70 p-3 sm:p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-vf-bone">Never changes, in any country</h3>
              <a
                href="#invariants"
                className="text-xs text-vf-smoke underline decoration-vf-smoke/40 underline-offset-4 hover:text-vf-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember"
              >
                The six rules in full
              </a>
            </div>
            <ul className="mt-2 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
              {INVARIANTS.map((v) => (
                <li key={v.short} className="flex gap-2 text-[0.8rem] leading-snug text-vf-bone/85">
                  <LockIcon />
                  {v.short}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
