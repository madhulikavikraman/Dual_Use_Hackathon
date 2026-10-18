// Small shared pieces for /global/flood: the section frame (same as /global's), the focus ring, and inline source
// links. No hooks, so client components (the country switch) can use them too.
import type { ReactNode } from "react";
import type { Source, Swatch } from "@/lib/floods";
import { hostOf } from "@/components/global/content";

export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember";

export function Section({ id, title, lede, children }: { id: string; title: string; lede?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-16 border-t border-vf-ash/70">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <h2 id={`${id}-h`} className="font-display text-3xl font-bold leading-tight tracking-tight text-vf-bone sm:text-4xl">
            {title}
          </h2>
          {lede ? <p className="mt-3 text-base leading-relaxed text-vf-smoke sm:text-lg">{lede}</p> : null}
        </div>
        <div className="mt-8 lg:mt-10">{children}</div>
      </div>
    </section>
  );
}

/** Colours for colour-coded warning levels (red is the brand flare). */
export const SWATCH: Record<Swatch, string> = {
  green: "#22c55e",
  yellow: "#facc15",
  orange: "#fb923c",
  red: "var(--vf-flare)",
  blue: "#38bdf8",
};

/** "Sources: a.gov, b.org": one link per source, deduped by URL; a repeated host gets a number. */
export function SourceLinks({ src, className = "" }: { src: Source[]; className?: string }) {
  const seen = new Set<string>();
  const list = src.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
  if (!list.length) return null;
  const hostCount = new Map<string, number>();
  return (
    <p className={`text-xs leading-relaxed text-vf-smoke ${className}`}>
      <span>{list.length > 1 ? "Sources: " : "Source: "}</span>
      {list.map((s, i) => {
        const host = hostOf(s.url);
        const n = (hostCount.get(host) ?? 0) + 1;
        hostCount.set(host, n);
        return (
          <span key={s.url}>
            {i ? ", " : ""}
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              title={s.claim}
              className={`rounded underline decoration-vf-smoke/40 underline-offset-2 hover:text-vf-bone ${focusRing}`}
            >
              {n > 1 ? `${host} (${n})` : host}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </span>
        );
      })}
    </p>
  );
}
