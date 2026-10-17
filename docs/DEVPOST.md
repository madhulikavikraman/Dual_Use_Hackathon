# Devpost draft: VoiceFlare

Draft for the team to edit. Facts are from the PRD, the decisions log and the build; keep the numbers as they are
unless the build changes.

## Tagline

Before an alert wakes ten million phones, ask four neighbors at the edge of the zone.

## Inspiration

On January 9, 2025, an evacuation warning meant for a few Los Angeles neighborhoods reached about ten million
phones across the county and kept echoing into the next day; the desk that sent it found out from the callers.
The day before, warnings reached parts of west Altadena hours late. Automated alerting fails loudly, late, or for
the wrong reason, and the usual fix is another blunt instrument. We built for the person at the desk at 3:40 AM:
the overnight supervisor of an emergency call line, with too few people and a surge of unverified calls.

## What it does

VoiceFlare is the gentlest response that still works, on a ladder: watch, ask, slow, hold, hand to a person.

- **Zones with a human key.** A map of Los Angeles zones on California's standard evacuation ladder (Warning,
  Order, Shelter in Place, Lifted). A toy fire-spread model and a call-pattern watcher *propose* changes; only a
  named supervisor approves, with a reason, and the approval carries the exact directive, route and evacuation
  point the agent may read.
- **Edge-first calls in eight languages.** A Claude voice agent calls residents from the edge nearest the hazard
  inward, in their language (English, Spanish, Korean, Mandarin, Hindi, French, Armenian, Tagalog). It reads only
  the approved text, confirms every answer back, asks a teach-back question, and records answers through seven
  tools — it has no tool to change a zone, send an alert or give an ETA.
- **The hold.** Before an Order is broadcast, VoiceFlare holds for 90 seconds, shows the dose ("wakes about
  41,000 people", or "9.8 million" for a wrong polygon), and rings sentinels at the polygon's edges: "does this
  match what you see?" The supervisor can Send, Hold once, Edit the polygon, Cancel or Hand to the authority. At
  0:00 it sends on time: the machine can delay an alert, never stop one.
- **The canary.** Fifteen seconds after the send, a phone just outside the zone is asked "did you just receive an
  evacuation order?" A "yes" outside or a "no" inside is flagged as a transport failure — the mechanism that would
  have caught January 9.
- **Who needs a person.** A help registry with each person's need and last-seen location (stated in the call and
  geocoded), pickup runs that send wheelchairs and oxygen to accessible vans first, call backs, and silence rules:
  retry, then the linked contact ("have you heard from your neighbor?"), then the door-knock list. A tower going
  dark shows up as a silence cluster.
- **A ledger.** Every human decision and every refusal ("asked for an ETA") is logged with a time. The allowlist
  is printed on screen.
- **The same screen on an ordinary Tuesday.** USC DPS mode: buildings as zones, RAs and officers on post as
  sentinels, monthly test calls that keep the roster alive. Base mode: an installation's lockdown desk.
- **Collections line.** Museums, libraries, archives, galleries and collectors keep a short grab list of what cannot
  be replaced. At Warning only, the call asks once whether they need help moving it while there is time; the request
  is a P4 salvage row that never outranks a person. Under an Order the call says leave now. Lives first, always.
- **Any country.** Six things never change (a named human approves, the edge is asked, the dose shows and the hold
  sends on time, verbatim relay with an AI disclosure, a canary, the ledger); six adapters do (ladder words, decider,
  emergency number, public channel, voice and model, privacy and maps). A Chongqing scenario runs on China's own
  ladder, with 119 and grid-worker sentinels.

## How we built it

Next.js 16 and TypeScript; one storage interface over Supabase or a local file store; the engine (dispatch queue,
holds, canaries, registry, simulator) advances on each board poll, so it needs no long-lived timers. Claude Haiku
5.5 runs the in-call turns with strict tool schemas; Claude Sonnet 5.5 classifies every finished call with
structured output and reconciles it with what was confirmed in the call ("needs help now" always surfaces).
Retell AI carries the same prompt and tools over the phone network; the browser phone page is the fallback and the
path for deaf and hard-of-hearing callers. Turf for geometry; Leaflet for the map; GeoJSON feeds and CAP 1.2
export for the response team's own tools (ArcGIS).

## Challenges

Binding instructions to a human approval without making the agent useless: the agent may say "leave now," but
only by reading the directive a named human approved for the zone the person is in. Making silence mean something
without making it a "no." Keeping the demo honest: every resident is synthetic except six volunteer phones, every
send is simulated, and the metrics count real phones only.

## Accomplishments

The full path runs end to end, tested in-process: approve a zone, edge-first calls, a life-safety caller
surfaced at priority 1, a linked contact accounting for a neighbor, a hold on the wrong polygon caught by a
sentinel's "nothing here," an edited polygon, quorum in under 90 seconds, a simulated send, a clear canary, the
Order relayed, and a silent block flagged as a possible tower loss.

## What we learned

The hard part of emergency AI is not talking; it is what the machine must never do on its own, and showing that
on the screen.

## What's next

NSF SBIR Phase I (NSF 26-510, up to $305,000; Project Pitch first) to prove the 90-second edge read, multilingual
distress classification, and the canary in drills with USC DPS; counties buying with FEMA UASI and EMPG grants
(public alert and warning systems are on FEMA's Authorized Equipment List); DoD SBIR and the Defense Innovation
Unit for installations.

## Built with

Claude (Haiku 5.5, Sonnet 5.5), Retell AI, Next.js, TypeScript, Tailwind, Supabase, Leaflet, Turf.js, ArcGIS
(GeoJSON feeds), National Weather Service API, USGS feed format, Esri World Light Gray basemap, motion.

## Responsible use (two lines)

Misuse: a wrong or compromised zone directive would be relayed to everyone in it, a colluding sentinel panel could
delay a real warning, and the registry is a list of real people at real locations. Limits: the agent reads only the
directive a named human approved for the zone the phone is in and can change nothing else; the hold is capped and
never blocks a send; every refusal and every human decision is in a ledger; the registry stores phone, zone, needs
and last location, is visible only to the response team, and is purged 72 hours after the incident closes.

## Twists

- **Twist 1 (federal funding pathway):** primary NSF SBIR Phase I; alternatives FEMA UASI/EMPG (customer money) and
  DoD SBIR/DIU (installations). Build change: the `/evidence` page measures the Phase I milestones live from the run.
- **Twist 2 (make it global; "how can firefighters in China implement it?"):** the product does not change; six
  adapters do. The six things that stay everywhere:
  - a named human approves every directive;
  - the edge is asked first;
  - the dose shows before the send, and the hold sends on time;
  - the agent reads only approved text, with an AI-voice disclosure;
  - a canary checks delivery;
  - every decision goes in the ledger.

  What changes per country is the ladder words, the decider, the emergency number, the public channel and dose source,
  the voice platform and AI model, and privacy and maps. The Chongqing scenario (Beibei, on the August 2022 fire's
  ground) runs that way:
  - China's colour warnings are hazard levels, and only a relocation order (转移指令) moves people; a red warning is
    never auto-promoted;
  - calls say 119;
  - the dose counts 12379 and carrier SMS audiences;
  - the sentinels are the grid workers China already asks to acknowledge (叫应);
  - an in-country, CAC-filed model sits behind the same seven tools, because Claude is not offered in mainland China;
  - PIPL consent and GCJ-02 maps.

  Japan (Ōfunato 2025), Greece (Rhodes 2023), India (Cyclone Dana 2024) and Australia (Black Summer) are profiled too.
  Proof: a live Mandarin call reads the Chinese directive word for word and files a "needs help leaving" row.
- **Twist 3 (poster):** a 24 x 36 inch poster built from the live app (the /poster page renders it from the same data
  as the product; exported to PDF for print and JPG for this gallery): the problem, the ladder, the board, one call in
  any language, global, the collections line, who pays, results and responsible use.
