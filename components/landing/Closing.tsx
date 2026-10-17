// The close: who pays for it (Twist 1, the federal funding pathway, from docs/DEVPOST.md and PRD 17.1), the
// two-line responsible-use note verbatim from docs/DEVPOST.md, and the footer links.
import Image from "next/image";
import Link from "next/link";
import { Container, Cta, ExternalLink } from "./ui";

const REPO = "https://github.com/madhulikavikraman/Dual_Use_Hackathon";

export function Closing() {
  return (
    <section aria-label="Funding and responsible use" className="border-t border-white/10 bg-vf-coal/70 py-20 sm:py-24">
      <Container className="grid gap-14 lg:grid-cols-2 lg:gap-20">
        <div id="funding" className="scroll-mt-16">
          <p className="text-sm text-vf-ember">Twist 1: the federal funding pathway</p>
          <h2 className="mt-2 font-display text-[clamp(1.75rem,1.35rem+1.5vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-vf-bone">
            Who pays for it
          </h2>
          <p className="mt-5 max-w-[58ch] text-[17px] leading-relaxed text-vf-bone/90">
            NSF SBIR Phase I (NSF 26-510, up to $305,000, no equity) pays to prove the 90-second edge read, multilingual distress
            classification and the canary, in drills with a county emergency office.
          </p>
          <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-vf-smoke">
            Counties buy it with FEMA UASI and EMPG grants, since public alert and warning systems are on FEMA&rsquo;s Authorized
            Equipment List. Installations come through DoD SBIR and the Defense Innovation Unit.
          </p>
          <div className="mt-8">
            <Cta href="/evidence" variant="secondary">
              See the Phase I milestones, measured live
            </Cta>
          </div>
        </div>

        <div>
          <h2 className="font-display text-[clamp(1.75rem,1.35rem+1.5vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-vf-bone lg:mt-7">
            Responsible use
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-vf-smoke">
            <span className="font-semibold text-vf-bone">Misuse: </span>a wrong or compromised zone directive would be relayed to
            everyone in it, a colluding sentinel panel could delay a real warning, and the registry is a list of real people at real
            locations.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-vf-smoke">
            <span className="font-semibold text-vf-bone">Limits: </span>the agent reads only the directive a named human approved for
            the zone the phone is in and can change nothing else; the hold is capped and never blocks a send; every refusal and every
            human decision is in a ledger; the registry stores phone, zone, needs and last location, is visible only to the response
            team, and is purged 72 hours after the incident closes.
          </p>
        </div>
      </Container>
    </section>
  );
}

const FOOTER_LINK =
  "text-vf-bone/90 underline decoration-white/20 underline-offset-4 transition-colors hover:text-vf-ember hover:decoration-vf-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember";

export function Footer() {
  return (
    <footer className="border-t border-white/10">
      <Container className="flex flex-col gap-10 py-12 md:flex-row md:items-end md:justify-between">
        <div className="max-w-md">
          <div className="flex items-center gap-3">
            <Image src="/brand/voiceflare-mark.png" alt="" width={822} height={822} sizes="36px" className="size-9" />
            <Image src="/brand/voiceflare-wordmark.png" alt="VoiceFlare" width={941} height={94} sizes="150px" className="h-auto w-[150px]" />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-vf-smoke">
            Built at the USC x InnovateLA Dual-Use Hackathon, Resilience Comms track, October 2026. Residents are synthetic except
            the volunteer phones, and every send is simulated.
          </p>
        </div>
        <nav aria-label="More pages">
          <ul className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm sm:flex sm:flex-wrap sm:gap-x-8">
            <li>
              <Link href="/twists" className={FOOTER_LINK}>
                Twist log
              </Link>
            </li>
            <li>
              <Link href="/demo" className={FOOTER_LINK}>
                Operator console
              </Link>
            </li>
            <li>
              {/* A route handler, not a page: a plain link, no client-side navigation or prefetch. */}
              <a href="/api/health" className={FOOTER_LINK}>
                Health check
              </a>
            </li>
            <li>
              <ExternalLink href={REPO} className="text-vf-bone/90 hover:text-vf-ember">
                Source code
              </ExternalLink>
            </li>
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
