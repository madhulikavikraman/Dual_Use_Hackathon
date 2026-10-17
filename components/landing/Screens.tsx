// What's on the screens: the demo's setup guide. A map of the booth (which screen is where and who holds it), then
// the setup in order, then the guided tour. Phone roles are the Westside scenario's (lib/scenarios/westside.ts);
// /phones shows them live for whichever scenario is loaded.
import Link from "next/link";
import type { ReactNode } from "react";
import { BoardMini, BrowserMini, EvidenceMini, LaptopMini, PhoneMini, TabletMini, type PhoneTone } from "./Devices";
import { Cta, PlayIcon, Route, Section } from "./ui";

const PHONES: { n: number; role: string; note: string; tone: PhoneTone }[] = [
  { n: 1, role: "Resident", note: "speaks Spanish", tone: "resident" },
  { n: 2, role: "Resident", note: "husband uses a wheelchair", tone: "resident" },
  { n: 3, role: "Sentinel", note: "east edge", tone: "sentinel" },
  { n: 4, role: "Sentinel", note: "south edge", tone: "sentinel" },
  { n: 5, role: "Judge", note: "Long Beach sentinel", tone: "sentinel" },
  { n: 6, role: "Canary", note: "Westchester, outside", tone: "canary" },
];

const SMALL: { href: string; name: string; what: string; who: string; art: ReactNode }[] = [
  {
    href: "/qrt",
    name: "Quick response team",
    what: "The help registry as a map and a list, pickup runs and a printable door-knock sheet.",
    who: "A tablet, for the team in the field.",
    art: <TabletMini />,
  },
  {
    href: "/call",
    name: "Public line",
    what: "Anyone can call the line from a browser, in 8 languages.",
    who: "Anyone, on their own phone or laptop.",
    art: <BrowserMini />,
  },
  {
    href: "/demo",
    name: "Operator console",
    what: "Resets a scenario (Westside LA, the heat wave, Altadena, Norte or Chongqing) and fires simulator events.",
    who: "The operator’s laptop.",
    art: <LaptopMini />,
  },
  {
    href: "/evidence",
    name: "Phase I evidence",
    what: "The NSF SBIR Phase I milestones, measured live from the run.",
    who: "A second screen, if there is one.",
    art: <EvidenceMini />,
  },
];

const STEPS: ReactNode[] = [
  <>
    Reset a scenario in <Route>/demo</Route>.
  </>,
  <>
    Put <Route>/board</Route> on the big screen. First time? Start the guided tour.
  </>,
  <>
    Open <Route>/phones</Route>. Each volunteer scans their QR code, taps &ldquo;Tap to enable sound&rdquo; and keeps the screen on.
  </>,
  <>
    Give the quick response team <Route>/qrt</Route> on a tablet.
  </>,
  <>
    Anyone else can ring the public line at <Route>/call</Route>.
  </>,
];

/** A screen in the booth map. The whole card is the link (the name's ::after covers it); the outline shows on focus. */
function Device({ href, route, name, what, who, art, children }: { href: string; route: string; name: string; what: string; who: string; art: ReactNode; children?: ReactNode }) {
  return (
    <div className="group relative flex flex-col rounded-xl has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-8 has-[a:focus-visible]:outline-vf-ember">
      <div className="transition-transform duration-300 ease-out group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        {art}
      </div>
      <div className="mt-4">
        <Route>{route}</Route>
        <h3 className="mt-1 font-display text-xl font-semibold leading-tight text-vf-bone">
          <Link href={href} className="transition-colors after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-hover:text-vf-ember">
            {name}
          </Link>
        </h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-vf-smoke">{what}</p>
        <p className="mt-2 text-sm leading-relaxed">
          <span className="text-vf-smoke">Who holds it: </span>
          <span className="text-vf-bone/90">{who}</span>
        </p>
        {children}
      </div>
    </div>
  );
}

export function Screens() {
  return (
    <Section
      id="screens"
      title="What's on the screens"
      className="bg-[radial-gradient(rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:26px_26px]"
      lede="The demo runs on 4 kinds of screen. Here is what each one shows, who holds it, and how to set the room up."
    >
      <div className="mt-14 grid gap-x-10 gap-y-14 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Device
            href="/board"
            route="/board"
            name="Supervisor board"
            what="Zones colored by ladder state, the metrics, live calls, the hold strip, the feed and Ask the board, with zones, proposals, the help registry and the ledger in the side panel."
            who="The big screen. The supervisor drives it."
            art={
              <div>
                <div className="rounded-xl border border-white/10 bg-[#141418] p-2 shadow-[0_30px_90px_-40px_rgba(255,42,18,0.45)] sm:p-2.5">
                  <div className="overflow-hidden rounded-md">
                    <BoardMini />
                  </div>
                </div>
                <div aria-hidden="true" className="mx-auto h-3 w-20 bg-[#141418]" />
                <div aria-hidden="true" className="mx-auto h-1.5 w-40 rounded-full bg-[#1c1c21]" />
              </div>
            }
          />
        </div>

        <div className="lg:col-span-4">
          <Device
            href="/phones"
            route="/phones"
            name="Volunteer phones"
            what="QR codes for 6 phones. Each one opens a browser phone and plays a part in the scenario."
            who="6 volunteers, one phone each."
            art={
              <ul className="grid grid-cols-3 gap-x-4 gap-y-4 px-2 sm:px-6 lg:px-0">
                {PHONES.map((p) => (
                  <li key={p.n} className="mx-auto w-full max-w-[92px]">
                    <PhoneMini tone={p.tone} />
                  </li>
                ))}
              </ul>
            }
          >
            <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
              {PHONES.map((p) => (
                <div key={p.n} className="contents">
                  <dt className="tabular-nums text-vf-smoke">Phone {p.n}</dt>
                  <dd className="text-vf-bone/90">
                    {p.role}, {p.note}
                  </dd>
                </div>
              ))}
            </dl>
          </Device>
        </div>

        <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:col-span-12 lg:grid-cols-4">
          {SMALL.map((d) => (
            <li key={d.href}>
              <Device href={d.href} route={d.href} name={d.name} what={d.what} who={d.who} art={d.art} />
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-20 grid gap-10 rounded-2xl border border-white/10 bg-vf-coal/80 p-6 sm:p-8 lg:grid-cols-12 lg:gap-12 lg:p-10">
        <div className="lg:col-span-7">
          <h3 className="font-display text-2xl font-semibold text-vf-bone">Set up the room in 5 steps</h3>
          <ol className="mt-6 space-y-4">
            {STEPS.map((step, i) => (
              <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 text-[16px] leading-relaxed text-vf-bone/90">
                <span aria-hidden="true" className="font-display text-xl font-semibold leading-[1.45] tabular-nums text-vf-flare">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[15px] leading-relaxed text-vf-smoke">
            Rehearsing without volunteers? Turn on autopilot in <Route>/demo</Route> and the simulator answers for all 6 phones.
          </p>
        </div>
        <div className="flex flex-col justify-center border-t border-white/10 pt-8 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
          <p className="font-display text-xl font-semibold leading-snug text-vf-bone">Not sure what you are looking at?</p>
          <p className="mt-2 text-[15px] leading-relaxed text-vf-smoke">The tour opens the board and explains each part of the screen.</p>
          <div className="mt-6">
            <Cta href="/board?tour=1" icon={<PlayIcon />}>
              Start the guided tour
            </Cta>
          </div>
        </div>
      </div>
    </Section>
  );
}
