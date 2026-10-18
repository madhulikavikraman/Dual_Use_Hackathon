// The hero's anchor: the July 2026 Pimpri-Chinchwad floods, sourced numbers only (lib/floods.ts PUNE_2026).
// The wave at the bottom is decoration; it stops under reduced motion.
import type { CSSProperties } from "react";
import { PUNE_2026 } from "@/lib/floods";
import { SourceLinks } from "./ui";

function Wave() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-12 overflow-hidden text-[var(--vff-water)]">
      <svg viewBox="0 0 1200 40" preserveAspectRatio="none" className="vff-wave absolute bottom-0 left-0 h-12 w-[200%] opacity-25">
        <path
          d="M0 20 Q75 6 150 20 T300 20 T450 20 T600 20 T750 20 T900 20 T1050 20 T1200 20 V40 H0 Z"
          fill="currentColor"
        />
      </svg>
      <svg viewBox="0 0 1200 40" preserveAspectRatio="none" className="vff-wave absolute bottom-0 left-0 h-9 w-[200%] opacity-15" style={{ animationDuration: "23s" } as CSSProperties}>
        <path
          d="M0 22 Q75 34 150 22 T300 22 T450 22 T600 22 T750 22 T900 22 T1050 22 T1200 22 V40 H0 Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

export default function AnchorCard() {
  const { title, stats, timeline, gap } = PUNE_2026;
  const statSources = stats.flatMap((s) => s.src);
  const timelineSources = timeline.flatMap((t) => t.src);
  return (
    <section
      aria-labelledby="anchor-title"
      className="vfg-rise relative min-w-0 overflow-hidden rounded-2xl border border-vf-ash bg-vf-coal/95 shadow-[0_0_90px_-30px_rgb(56_189_248/0.45)]"
      style={{ "--vfg-delay": "120ms" } as CSSProperties}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[var(--vff-water)]/70 to-transparent"
      />
      <div className="p-4 pb-16 sm:p-6 sm:pb-16">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-vf-smoke">The anchor</p>
        <h2 id="anchor-title" className="mt-1 flex items-center gap-2 font-display text-xl font-semibold text-vf-bone">
          <span aria-hidden="true">🌧️</span>
          {title}
        </h2>

        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.value} className="flex flex-col rounded-xl border border-vf-ash bg-vf-ink/70 p-3">
              <dt className="order-2 mt-1 text-xs leading-snug text-vf-smoke">{s.label}</dt>
              <dd className="order-1 font-display text-3xl font-bold leading-none text-vf-bone">{s.value}</dd>
            </div>
          ))}
        </dl>
        <SourceLinks src={statSources} className="mt-2" />

        <h3 className="mt-6 font-display text-sm font-semibold text-vf-bone">How the month went</h3>
        <ol className="mt-3 space-y-2.5 border-l border-vf-ash pl-4">
          {timeline.map((t) => (
            <li key={t.when} className="relative text-sm leading-relaxed text-vf-bone/90">
              <span aria-hidden="true" className="absolute -left-[1.3rem] top-[0.5em] h-2 w-2 rounded-full bg-[var(--vff-water)]" />
              <span className="font-display font-semibold text-vf-bone">{t.when}</span> {t.what}
            </li>
          ))}
        </ol>
        <SourceLinks src={timelineSources} className="mt-2" />

        <p className="mt-6 border-l-2 border-vf-flare pl-3 text-[0.95rem] leading-relaxed text-vf-bone">{gap.text}</p>
      </div>
      <Wave />
    </section>
  );
}
