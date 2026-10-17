// The fire burning now, from lib/stories.ts (LIVE). Renders nothing until the research fills it in, and only the
// fields that are present. Every line carries its "as of" time so a stale status reads as stale.
import { LIVE } from "@/lib/stories";
import { Container, ExternalLink, hostOf } from "./ui";

export function LiveStrip() {
  if (!LIVE) return null;
  const live = LIVE;
  return (
    <aside aria-label="Live incident" className="border-b border-vf-blood/60 bg-[linear-gradient(90deg,rgba(168,18,10,0.32),rgba(168,18,10,0.06))]">
      <Container className="py-3 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <p className="flex items-center gap-2 font-semibold text-vf-bone">
            <span className="relative flex size-2.5 shrink-0 self-center" aria-hidden="true">
              <span className="vf-ping absolute inline-flex size-full rounded-full bg-vf-flare" />
              <span className="relative inline-flex size-2.5 rounded-full bg-vf-flare" />
            </span>
            <span>Live: {live.name}</span>
          </p>
          {live.status_line ? <p className="text-vf-bone/90">{live.status_line}</p> : null}
          {live.as_of ? <p className="text-vf-smoke">As of {live.as_of}</p> : null}
          {live.links.length > 0 ? (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-vf-bone/90">
              {live.links.map((href) => (
                <li key={href}>
                  <ExternalLink href={href}>{hostOf(href)}</ExternalLink>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {live.place || live.alert_notes ? (
          <p className="mt-1 max-w-[110ch] text-[13px] leading-relaxed text-vf-smoke">
            {[live.place, live.alert_notes].filter(Boolean).join(". ")}
          </p>
        ) : null}
      </Container>
    </aside>
  );
}
