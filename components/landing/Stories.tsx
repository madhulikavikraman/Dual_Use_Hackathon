// Why VoiceFlare exists: the real incidents in lib/stories.ts (FIRES), each as what went wrong, what VoiceFlare does
// about it (feature by feature), what it would not have changed, and the sources. STATS render only when the
// research has filled them in; an empty damage line or limits line is simply left out.
import { FIRES, STATS, type FireStory } from "@/lib/stories";
import { ExternalLink, Section, hostOf } from "./ui";

export function Stories() {
  if (FIRES.length === 0 && STATS.length === 0) return null;
  return (
    <Section
      id="why"
      title="When the alerts failed"
      lede="Real incidents behind the build, with sources. For each one: what went wrong, what VoiceFlare does about it, and what it would not have changed."
    >
      {STATS.length > 0 ? (
        <dl className="mt-12 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={`${s.value}-${s.label}`} className="flex flex-col bg-vf-ink p-5">
              <dt className="order-2 mt-2 text-sm leading-snug text-vf-smoke">{s.label}</dt>
              <dd className="order-1 font-display text-3xl font-semibold tabular-nums text-vf-bone">{s.value}</dd>
              {s.source ? (
                <dd className="order-3 mt-3 text-xs text-vf-smoke">
                  <ExternalLink href={s.source}>{hostOf(s.source)}</ExternalLink>
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-14 space-y-16 sm:space-y-20">
        {FIRES.map((story) => (
          <Story key={story.id} story={story} />
        ))}
      </div>
    </Section>
  );
}

function Story({ story }: { story: FireStory }) {
  const headingId = `story-${story.id}`;
  return (
    <article aria-labelledby={headingId} className="grid gap-8 border-t border-white/10 pt-8 lg:grid-cols-12 lg:gap-10">
      <header className="lg:col-span-4">
        <p className="text-sm">
          <span className="text-vf-ember">{story.when}</span>
          {story.where ? <span className="text-vf-smoke"> in {story.where}</span> : null}
        </p>
        <h3 id={headingId} className="mt-2 text-balance font-display text-[clamp(1.6rem,1.3rem+1vw,2.1rem)] font-semibold leading-[1.1] tracking-[-0.015em] text-vf-bone">
          {story.name}
        </h3>
        {story.damage ? <p className="mt-3 text-[15px] leading-relaxed text-vf-smoke">{story.damage}</p> : null}
        {story.sources.length > 0 ? (
          <div className="mt-5 text-sm text-vf-smoke">
            <p>Sources</p>
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-vf-bone/85">
              {story.sources.map((href) => (
                <li key={href}>
                  <ExternalLink href={href}>{hostOf(href)}</ExternalLink>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </header>

      <div className="grid gap-8 md:grid-cols-2 lg:col-span-8 lg:gap-10">
        <div>
          <h4 className="font-display text-base font-semibold text-vf-ember">What went wrong</h4>
          <ul className="mt-3 space-y-3">
            {story.what_went_wrong.map((line) => (
              <li key={line} className="flex gap-3 text-[15px] leading-relaxed text-vf-bone/90">
                <span aria-hidden="true" className="mt-[0.6em] h-px w-3 shrink-0 bg-vf-flare" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-display text-base font-semibold text-vf-bone">What VoiceFlare does</h4>
          <dl className="mt-3 space-y-4">
            {story.voiceflare.map((v) => (
              <div key={`${v.feature}-${v.how}`}>
                <dt className="text-[15px] font-semibold text-vf-bone">{v.feature}</dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-vf-smoke">{v.how}</dd>
              </div>
            ))}
          </dl>
        </div>
        {story.limits ? (
          <p className="text-[15px] leading-relaxed text-vf-smoke md:col-span-2">
            <span className="font-semibold text-vf-bone">What it would not change. </span>
            {story.limits}
          </p>
        ) : null}
      </div>
    </article>
  );
}
