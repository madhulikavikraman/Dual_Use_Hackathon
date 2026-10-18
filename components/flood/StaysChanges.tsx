// What stays the same everywhere (the six invariants) and what changes (the six adapters), said for floods.
// From lib/floods.ts; each place's value is shown in its own script with a lang tag.
import { FLOODS, FLOOD_ADAPTERS, FLOOD_CODES, FLOOD_INVARIANTS } from "@/lib/floods";
import LocalText from "@/components/global/LocalText";

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="mt-1 h-3.5 w-3.5 shrink-0 text-vf-bone/70">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export default function StaysChanges() {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
      <div className="min-w-0">
        <h3 className="font-display text-xl font-semibold text-vf-bone">Stays the same everywhere</h3>
        <ol className="mt-5 space-y-5">
          {FLOOD_INVARIANTS.map((v) => (
            <li key={v.title} className="flex gap-3 border-t border-vf-bone/20 pt-4">
              <LockIcon />
              <div className="min-w-0">
                <p className="font-display text-base font-semibold text-vf-bone">{v.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-vf-smoke">{v.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="min-w-0">
        <h3 className="font-display text-xl font-semibold text-vf-bone">Changes with the country</h3>
        <ul className="mt-5 grid gap-4 md:grid-cols-2">
          {FLOOD_ADAPTERS.map((a) => (
            <li key={a.name} className="rounded-2xl border border-vf-ash bg-vf-coal p-4 sm:p-5">
              <p className="flex items-center gap-2 font-display text-base font-semibold text-vf-bone">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-vf-flare" />
                {a.name}
              </p>
              {a.byPlace ? (
                <dl className="mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                  {FLOOD_CODES.filter((c) => a.byPlace?.[c]).map((c) => (
                    <div key={c} className="contents">
                      <dt className="text-vf-smoke">{FLOODS[c].country.replace(" (EU)", "")}</dt>
                      <dd className={`min-w-0 text-vf-bone/90 ${a.name === "Emergency number" ? "font-display font-semibold text-vf-flare" : ""}`}>
                        <LocalText text={a.byPlace?.[c] ?? ""} lang={FLOODS[c].lang} />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {a.body ? <p className="mt-3 text-sm leading-relaxed text-vf-smoke">{a.body}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
