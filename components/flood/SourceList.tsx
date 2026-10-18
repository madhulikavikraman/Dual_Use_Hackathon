// Every source the flood page uses, by country, as links. India (the anchor) starts open.
import { FLOODS, FLOOD_CODES } from "@/lib/floods";
import { hostOf } from "@/components/global/content";
import { focusRing } from "./ui";

export default function SourceList() {
  return (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      {FLOOD_CODES.map((c, i) => {
        const p = FLOODS[c];
        return (
          <details key={c} open={i === 0} className="vff-details rounded-2xl border border-vf-ash bg-vf-coal">
            <summary
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3.5 sm:px-5 ${focusRing}`}
            >
              <span className="min-w-0">
                <span className="font-display text-base font-semibold text-vf-bone">{p.country}</span>
                <span className="ml-2 text-sm text-vf-smoke">
                  {p.place} · {p.sources.length} sources
                </span>
              </span>
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                focusable="false"
                className="vff-chevron h-4 w-4 shrink-0 text-vf-smoke transition-transform motion-reduce:transition-none"
              >
                <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <ol className="space-y-2.5 border-t border-vf-ash px-4 py-4 text-sm leading-relaxed sm:px-5">
              {p.sources.map((s) => (
                <li key={s.url} className="min-w-0">
                  <span className="text-vf-bone/85">{s.claim}. </span>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded text-vf-smoke underline decoration-vf-smoke/40 underline-offset-2 hover:text-vf-bone ${focusRing}`}
                  >
                    {hostOf(s.url)}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ol>
          </details>
        );
      })}
    </div>
  );
}
