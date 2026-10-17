import Link from "next/link";

const PAGES: { href: string; label: string; note: string }[] = [
  { href: "/board", label: "Supervisor board", note: "Zones, the hold, the help registry and the ledger on one screen" },
  { href: "/qrt", label: "Quick response team", note: "Registry map and list, pickup runs, printable door-knock sheet" },
  { href: "/phones", label: "Phones", note: "The volunteer devices that play residents, sentinels and the canary" },
  { href: "/demo", label: "Demo console", note: "Reset a scenario and fire simulator events" },
  { href: "/evidence", label: "Evidence", note: "The Phase I milestones, measured from this run" },
  { href: "/twists", label: "Twist log", note: "What changed in the build for each twist, and the proof" },
  { href: "/api/health", label: "Health check", note: "Environment, storage and model status (JSON)" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 p-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black tracking-tight">Second Key</h1>
          <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-black tracking-widest text-slate-950">SIMULATED</span>
        </div>
        <p className="mt-3 text-lg leading-relaxed">
          Before an automated system wakes a zone, Second Key asks the people at its edge, shows how many phones it will wake, and relays
          only the instruction a named human approved.
        </p>
      </div>
      <nav aria-label="Pages">
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
          {PAGES.map((p) => {
            const body = (
              <>
                <span className="font-semibold text-blue-700 dark:text-blue-400">{p.label}</span>
                <span className="text-right text-sm opacity-70">{p.note}</span>
              </>
            );
            const className = "flex items-baseline justify-between gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900";
            return (
              <li key={p.href}>
                {/* Route handlers are not pages: a plain link, no client-side navigation or prefetch. */}
                {p.href.startsWith("/api/") ? (
                  <a href={p.href} className={className}>
                    {body}
                  </a>
                ) : (
                  <Link href={p.href} className={className}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="text-sm leading-relaxed opacity-80">
        A hackathon demonstration (USC x InnovateLA Dual-Use Hackathon, Resilience Comms track). Residents are synthetic except a few
        volunteer phones, and every send is simulated: nothing reaches a real alert system.
      </p>
    </main>
  );
}
