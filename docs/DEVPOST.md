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

VoiceFlare is the gentlest alert that still works, on a ladder: watch, ask, slow, hold, hand to a person. It is one
system for two days: the fire night, and an ordinary hot Tuesday.

- **Zones with a human key.** A map of Los Angeles zones on California's standard evacuation ladder (Warning,
  Order, Shelter in Place, Lifted). A toy fire-spread model and a call-pattern watcher *propose* changes; only a
  named supervisor approves, with a reason, and the approval carries the exact directive, route and evacuation
  point the agent may read.
- **Edge-first calls in eight languages.** A Claude voice agent calls residents from the edge nearest the hazard
  inward, in their language (English, Spanish, Korean, Mandarin, Hindi, French, Armenian, Tagalog). It reads only
  the approved text, confirms every answer back, asks a teach-back question, and records answers through eight
  tools. It has no tool to change a zone, send an alert or give an ETA, and it never says anyone is safe.
- **The hold.** Before an Order is broadcast, VoiceFlare holds for 90 seconds, shows the dose ("wakes about
  41,000 people", or "9.8 million" for a wrong polygon), and rings sentinels at the polygon's edges: "does this
  match what you see?" The supervisor can Send, Hold once, Edit the polygon, Cancel or Hand to the authority. At
  0:00 it sends on time: the machine can delay an alert, never stop one.
- **The canary.** Fifteen seconds after the send, a phone just outside the zone is asked "did you just receive an
  evacuation order?" A "yes" outside or a "no" inside is flagged as a transport failure: the mechanism that would
  have caught January 9.
- **Block by block, not the whole zone at once.** Under an Order, the zone is cut into patches about half a mile
  (800 m) on a side. Several patches leave per wave, nearest the fire first, each on an assigned exit road, and no
  road gets more cars in a wave than it carries. The Order itself is never delayed: people in later waves hear
  "get ready" plus "if you see fire or smoke, or feel unsafe, leave right away", the fire model can pull a block
  forward at any time, and "Everyone go now" is always one click.
- **Who needs a person.** A help registry with each person's need and last-seen location (stated in the call and
  geocoded), pickup runs that send wheelchairs and oxygen to accessible vans first, call backs, and silence rules:
  retry, then the linked contact ("have you heard from your neighbor?"), then the door-knock list. A tower going
  dark shows up as a silence cluster. No answer is never treated as safe.
- **Live location, with consent, and a helper at the spot.** When someone needs help, the agent asks once whether
  it may text a link that shares their live location with the response team. One tap shares GPS; the supervisor
  sends a helper, whose page shows the spot, the needs and a Navigate button. Sharing stops when help reaches them,
  when they stop it, or after 4 hours, and the exact point never appears in public feeds.
- **A ledger.** Every human decision and every refusal ("asked for an ETA") is logged with a name and a time. The
  allowlist is printed on screen.
- **The same board on an ordinary hot Tuesday.** Heat mode turns the board into a heat check-in line for older
  residents: live Open-Meteo readings and National Weather Service heat alerts per neighborhood, calls to seniors
  who opted in (people who live alone or have no air conditioning first), a ride to a cooling center or a wellness
  visit through the same helper flow, and "hang up and call 911 now" for heat-stroke warning signs. Base mode covers
  an installation's lockdown desk.
- **Collections line.** Museums, libraries, archives, galleries and collectors keep a short grab list of what cannot
  be replaced. At Warning only, the call asks once whether they need help moving it while there is time; the request
  is a P4 salvage row that never outranks a person. Under an Order the call says leave now. Lives first, always.
- **Any country.** Six things never change (a named human approves, the edge is asked, the dose shows and the hold
  sends on time, verbatim relay with an AI disclosure, a canary, the ledger); six adapters do (ladder words, decider,
  emergency number, public channel, voice and model, privacy and maps). A Chongqing scenario runs on China's own
  ladder, with 119 and grid-worker sentinels.
- **Easy to see.** A left-sidebar board (Map, Calls, Help, Ledger, Feed, Ask), a one-minute guided tour, and "Play
  the full fire" (`/board?autoplay=1`), which plays the whole demo on the real board with captions. The landing page
  shows both days side by side, rung by rung.

## How we built it

Next.js 16 (App Router) and TypeScript; one storage interface over Supabase or a local file store; the engine
(dispatch queue, holds, canaries, registry, block plans and their wave clock, simulator) advances on each board poll,
so it needs no long-lived timers. Claude Haiku 5.5 runs the in-call turns with strict tool schemas; Claude Sonnet 5.5
classifies every finished call with structured output and reconciles it with what was confirmed in the call ("needs
help now" always surfaces). Retell AI carries the same prompt and eight tools over the phone network; a generated
Retell kit (request bodies, a conversation flow and a copy-by-hand page, from `scripts/retell-export.ts`) puts the
agent on the dashboard. The browser phone page is the fallback and the path for deaf and hard-of-hearing callers.
Turf for geometry (the block grid, edge distances, point-in-polygon); Leaflet for the map; lane counts from
OpenStreetMap for road capacity; Open-Meteo and the NWS API for the heat line; GeoJSON feeds and CAP 1.2 export for
the response team's own tools (ArcGIS). Autoplay calls the same HTTP routes the board's buttons call.

## Challenges

Binding instructions to a human approval without making the agent useless: the agent may say "leave now," but
only by reading the directive a named human approved for the zone the person is in. Phasing an evacuation without
making anyone in danger wait: every wait message carries "leave right away if you feel unsafe," a block can only
ever move sooner, and "Everyone go now" is one click. Making silence mean something without making it a "no."
Sharing a live location only with consent, only with the response team, and only until help arrives. Keeping the
demo honest: every resident is synthetic except six volunteer phones, nothing reaches a real alert system, the heat
line labels its demo heat wave when live temperatures are mild, and the metrics count real phones only.

## Accomplishments

The full path runs end to end, tested in-process (`scripts/e2e.ts`, 38 checks in our latest run): approve a zone,
edge-first calls, a life-safety caller surfaced at priority 1, a linked contact accounting for a neighbor, a hold on
the wrong polygon caught by a sentinel's "nothing here," an edited polygon, quorum in under 90 seconds, the send, a
clear canary, the Order relayed, a silent block flagged as a possible tower loss, and consented live location with
a helper sent to the spot. Separate checks cover block-by-block evacuation (`scripts/blocks-check.ts`: road
capacity, nearest first, pull-forward, Everyone go now) and the heat line (`scripts/heat-check.ts`, with the network
switched off).

## What we learned

The hard part of emergency AI is not talking; it is what the machine must never do on its own, and showing that
on the screen.

## What's next

NSF SBIR Phase I (NSF 26-510, up to $305,000; Project Pitch first) to prove the 90-second edge read, multilingual
distress classification and the canary in drills, on a fire night and on a hot day; a city or county heat check-in
line as the everyday pilot; counties buying with FEMA UASI and EMPG grants (public alert and warning systems are on
FEMA's Authorized Equipment List); DoD SBIR and the Defense Innovation Unit for installations.

## Built with

Claude (Haiku 5.5, Sonnet 5.5), Retell AI, Next.js, TypeScript, Tailwind, Supabase, Leaflet, Turf.js, ArcGIS
(GeoJSON feeds), National Weather Service API, Open-Meteo, OpenStreetMap, USGS feed format, Esri World Light Gray
basemap, motion.

## Responsible use (two lines)

Misuse: a wrong or compromised zone directive would be relayed to everyone in it, a colluding sentinel panel could
delay a real warning, and the registry and live locations describe real people at real places.
Limits: the agent reads only the words a named human approved and can change nothing; the hold is capped and never
blocks a send; live location is shared only with consent, only with the response team, stops at handoff or after
4 hours and never appears in public feeds; phased evacuation never makes anyone in danger wait (leave right away if
unsafe; "Everyone go now" is one click); every decision is in the ledger, and the registry is purged 72 hours after
the incident closes.

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
  - an in-country, CAC-filed model sits behind the same eight tools, because Claude is not offered in mainland China;
  - PIPL consent and GCJ-02 maps.

  Japan (Ōfunato 2025), Greece (Rhodes 2023), India (Cyclone Dana 2024) and Australia (Black Summer) are profiled too.
  Proof: a live Mandarin call reads the Chinese directive word for word and files a "needs help leaving" row. A flood
  page (`/global/flood`) is being built as a second screen for the same answer on a different hazard.
- **Twist 3 (poster):** a 24 x 36 inch poster built from the live app (the /poster page renders it from the same data
  as the product; exported to PDF for print and JPG for this gallery): the problem, the ladder, the board, one call in
  any language, global, the collections line, who pays, results and responsible use.
