// The first screen: the VoiceFlare logo as the name, the promise in one line, one supporting sentence, the three
// ways in, and, on the right, a live replay of the hold (the product's core moment). The entrance is one short CSS
// stagger (.vf-rise) so the text is painted by the server and needs no JavaScript to appear.
import Image from "next/image";
import { FIRES, STATS } from "@/lib/stories";
import { HoldReplay } from "./HoldReplay";
import { SignalArcs } from "./SignalArcs";
import { Container, Cta, ExternalLink, PlayIcon, hostOf } from "./ui";

const ON_THIS_PAGE = [
  { href: "#dual-use", label: "Dual-use" },
  { href: "#how", label: "How it works" },
  { href: "#screens", label: "Screens" },
  { href: "#global", label: "Any country" },
  { href: "#collections", label: "Collections" },
];

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

export function Hero() {
  // The sourced fact behind the headline's "10 million phones", when the research has it; else the first story.
  const proof = STATS.find((s) => /10 million/i.test(s.value));
  const story = FIRES[0];
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-56 -top-56 -z-10 size-[820px] rounded-full bg-[radial-gradient(closest-side,rgba(255,42,18,0.2),rgba(255,42,18,0.05)_60%,transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-72 -right-48 -z-10 size-[760px] rounded-full bg-[radial-gradient(closest-side,rgba(255,107,61,0.1),transparent)]"
      />
      <Container className="pb-20 pt-5 sm:pb-24 lg:pb-28">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-vf-smoke">
            <span>Synthetic residents and 6 volunteer phones. Nothing reaches a real alert system.</span>
          </p>
          <nav aria-label="On this page" className="hidden lg:block">
            <ul className="flex gap-7 text-sm">
              {ON_THIS_PAGE.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-vf-smoke transition-colors hover:text-vf-bone focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vf-ember"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 grid items-start gap-14 lg:mt-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <div className="vf-rise relative w-[min(64vw,240px)] sm:w-[260px]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-[44%] -z-10 size-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,42,18,0.3),rgba(255,42,18,0.08)_55%,transparent)]"
              />
              <SignalArcs className="pointer-events-none absolute left-1/2 top-[45%] w-[82%] -translate-x-1/2 -translate-y-1/2 text-vf-flare [filter:drop-shadow(0_0_5px_rgba(255,42,18,0.75))]" />
              <Image
                src="/brand/voiceflare-logo-transparent.png"
                alt="VoiceFlare"
                width={989}
                height={666}
                sizes="(min-width: 640px) 320px, 70vw"
                loading="eager"
                className="relative h-auto w-full"
              />
            </div>

            <h1
              id="hero-title"
              className="vf-rise mt-9 max-w-[17ch] text-balance font-display text-[clamp(2.2rem,1.25rem+2.9vw,3.6rem)] font-semibold leading-[1.03] tracking-[-0.025em] text-vf-bone"
              style={delay(90)}
            >
              Before an alert wakes 10 million phones, ask 4 neighbors at the edge of the zone.
            </h1>
            <p className="vf-rise mt-6 max-w-[56ch] text-lg leading-relaxed text-vf-smoke sm:text-[1.2rem]" style={delay(170)}>
              VoiceFlare holds an evacuation order 90 seconds for a named human, asks the people at the zone&rsquo;s edge what they
              see, and then calls residents in their own language with only the words that human approved.
            </p>
            <p className="vf-rise mt-5 flex max-w-[60ch] flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[15px] leading-relaxed text-vf-bone/90" style={delay(210)}>
              <span className="rounded-[3px] border border-vf-ember/60 px-1.5 py-0.5 text-[11px] font-black tracking-[0.12em] text-vf-ember">DUAL-USE</span>
              <span>
                One system, two days: <span aria-hidden="true">🔥</span> the rules that run a wildfire night also run{" "}
                <span aria-hidden="true">🌡️</span> a heat check-in line for older residents on an ordinary hot Tuesday.{" "}
                <a
                  href="#dual-use"
                  className="whitespace-nowrap text-vf-smoke underline decoration-white/25 underline-offset-4 transition-colors hover:text-vf-bone hover:decoration-vf-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember"
                >
                  See both days
                </a>
              </span>
            </p>

            <div id="hero-ctas" className="vf-rise mt-9 flex flex-wrap items-center gap-3" style={delay(250)}>
              <Cta href="/board?autoplay=1" icon={<PlayIcon />}>
                Play the full fire
              </Cta>
              <Cta href="/board?tour=1" variant="secondary">
                Start the guided tour
              </Cta>
              <Cta href="/phones" variant="secondary">
                Pick up a phone
              </Cta>
            </div>
            <p className="vf-rise mt-4 text-sm text-vf-smoke" style={delay(300)}>
              Play the full fire runs the whole demo fire on the real board in about 4 minutes. The tour explains each part of the screen.
            </p>

            {proof || story ? (
              <p className="vf-rise mt-10 max-w-[62ch] border-l-2 border-vf-flare/70 pl-4 text-[15px] leading-relaxed" style={delay(360)}>
                {proof ? (
                  <>
                    <span className="font-semibold text-vf-ember">{proof.value}</span> <span className="text-vf-bone/90">{proof.label}.</span>{" "}
                    {proof.source ? (
                      <ExternalLink href={proof.source} className="text-sm text-vf-smoke hover:text-vf-bone">
                        {hostOf(proof.source)}
                      </ExternalLink>
                    ) : null}
                  </>
                ) : story ? (
                  <>
                    <span className="text-vf-ember">{story.when}</span> <span className="text-vf-bone/90">{story.name}.</span>
                  </>
                ) : null}{" "}
                <a
                  href="#why"
                  className="whitespace-nowrap text-sm text-vf-smoke underline decoration-white/25 underline-offset-4 transition-colors hover:text-vf-bone hover:decoration-vf-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember"
                >
                  What went wrong
                </a>
              </p>
            ) : null}
          </div>

          <div className="vf-rise lg:col-span-5 lg:pt-3" style={delay(200)}>
            <p className="mb-3 text-sm text-vf-smoke">The hold, as the supervisor sees it</p>
            <HoldReplay />
          </div>
        </div>
      </Container>
    </section>
  );
}
