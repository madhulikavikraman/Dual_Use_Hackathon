// How it works, on the hackathon's ladder: watch, ask, slow, hold, hand to a person. Each rung says what VoiceFlare
// does and where to see it on the board, so the section doubles as a map for the guided tour. The rail colour rises
// from smoke to flare at "hold"; the last rung, the human exit, is bone white.
import { LANGUAGES } from "@/lib/languages";
import { RevealList } from "./RevealList";
import { Section } from "./ui";

type Rung = { word: string; tone: string; does: string; board: string; details?: { label: string; text: string }[] };

const RUNGS: Rung[] = [
  {
    word: "Watch",
    tone: "#a3a3ad",
    does: "Models and feeds only propose. A fire model or a pattern in the calls draws a dashed zone, and nothing calls anyone until a named human approves it, with a reason.",
    board: "Dashed zones on the map; model proposals in the Zones tab.",
  },
  {
    word: "Ask",
    tone: "#fbbf24",
    does: "Before an order goes out, sentinels at the zone’s edge get a call: does this alert match what you see? Yes, no or not sure.",
    board: "Sentinel answers in the hold strip.",
  },
  {
    word: "Slow",
    tone: "#ff8a3d",
    does: "The supervisor sees the dose before any phone rings: how many people the polygon wakes. Calls then go edge-first and needs-first, 5 at a time, instead of one blast.",
    board: "“Wakes about” in the hold strip; pins filling in from the edge.",
  },
  {
    word: "Hold",
    tone: "#ff2a12",
    does: "An Evacuation Order waits 90 seconds for Send now, Hold once, Edit polygon, Cancel or Hand off. If nobody decides, it sends on time: the machine can delay an alert, never stop one.",
    board: "The hold strip and its clock.",
  },
  {
    word: "Hand to a person",
    tone: "#f5f5f4",
    does: "Every exit is a named human, and every call carries only what that human approved.",
    board: "Live calls, the Help registry and the Ledger; the QRT tablet.",
    details: [
      {
        label: "Calls",
        text: "An AI voice (Retell AI on the phone network, Claude as the agent) says it is an AI and reads only the approved directive, route and shelter, in the person’s language.",
      },
      { label: "Delivery", text: "A canary phone inside the polygon and one outside report whether the alert arrived." },
      { label: "Silence", text: "No answer becomes a retry, then a call to a linked contact, then a door-knock row." },
      { label: "Help", text: "P1 needs help now, P2 needs help leaving, P3 not reached: the quick response team works the list." },
      { label: "Ledger", text: "Every human decision, with a name and a reason, and every AI refusal." },
    ],
  },
];

export function Ladder() {
  return (
    <Section
      id="how"
      title="How it works"
      className="bg-vf-coal/70"
      lede="The hackathon asked for the gentlest response that still works when an automated system misbehaves: watch, ask, slow, hold, hand to a person. VoiceFlare puts every rung on the supervisor's board."
    >
      <RevealList className="mt-14 list-none" itemClassName="relative">
        {RUNGS.map((rung, i) => (
          <RungRow key={rung.word} n={i + 1} rung={rung} next={RUNGS[i + 1]} />
        ))}
      </RevealList>
    </Section>
  );
}

function RungRow({ n, rung, next }: { n: number; rung: Rung; next?: Rung }) {
  return (
    <div className="relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 pb-12 sm:gap-x-6 lg:grid-cols-[2.75rem_minmax(0,13rem)_minmax(0,1fr)_minmax(0,15rem)] lg:gap-x-10">
      {next ? (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-[1.375rem] top-12 w-0.5 -translate-x-1/2 rounded-full opacity-60"
          style={{ background: `linear-gradient(${rung.tone}, ${next.tone})` }}
        />
      ) : null}
      <span
        aria-hidden="true"
        className="relative flex size-11 items-center justify-center rounded-full border-2 bg-vf-ink font-display text-lg font-semibold tabular-nums"
        style={{ borderColor: rung.tone, color: rung.tone, boxShadow: `0 0 28px -8px ${rung.tone}` }}
      >
        {n}
      </span>
      <h3 className="self-center font-display text-[clamp(1.75rem,1.35rem+1.5vw,2.5rem)] font-semibold leading-none tracking-[-0.02em] text-vf-bone lg:self-start lg:pt-1">
        {rung.word}
      </h3>
      <div className="col-start-2 mt-4 lg:col-start-3 lg:mt-1.5">
        <p className="max-w-[60ch] text-[17px] leading-relaxed text-vf-bone/90">{rung.does}</p>
        {rung.details ? (
          <>
            <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
              {rung.details.map((d) => (
                <div key={d.label} className="contents">
                  <dt className="text-[15px] font-semibold text-vf-bone">{d.label}</dt>
                  <dd className="-mt-2 text-[15px] leading-relaxed text-vf-smoke sm:mt-0">{d.text}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-sm text-vf-smoke">Calls in</p>
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Call languages">
              {LANGUAGES.map((l) => (
                <li key={l.code} lang={l.code} className="rounded-md border border-white/15 px-2.5 py-1 text-sm text-vf-bone">
                  {l.native}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <p className="col-start-2 mt-4 text-sm leading-relaxed lg:col-start-4 lg:mt-2">
        <span className="text-vf-smoke">On the board: </span>
        <span className="text-vf-bone/90">{rung.board}</span>
      </p>
    </div>
  );
}
