# VoiceFlare

The gentlest alert that still works, for the overnight supervisor of an emergency call line.
USC Viterbi x InnovateLA Dual-Use Hackathon, October 2026 — Resilience Comms track (Retell AI).

Before an automated system wakes a zone, VoiceFlare asks the people at the zone's edge, shows the supervisor
how many phones it will wake, and relays only the instruction a named human approved for that zone. Afterwards
it checks that the message landed, moves the zone out block by block, keeps a live list of who said they need help
and where they were last heard from, and hands the pattern of calls to the response team's map. The ladder: watch,
ask, slow, hold, hand to a person.

**One system, two days.** On the fire night it runs evacuation calls. On an ordinary hot Tuesday the same board runs
a heat check-in line for older residents (heat mode).

**Demo honesty.** Every resident is synthetic except the six volunteer phones in the room. The broadcast send
reaches no real alert system. On the heat line, a labeled demo heat wave stands in when live temperatures are below
the thresholds. The screen and the script say so.

## What it does

| Rung | Feature |
| --- | --- |
| Watch | Zones on the Cal OES ladder (Monitor, Watch, Warning, Order, Shelter in Place, Lifted); a toy fire-envelope model and call-pattern watch *propose* changes, drawn dashed; only a named human approves |
| Ask | Staged calls to residents in their language (English, Spanish, Korean, Mandarin, Hindi, French, Armenian, Tagalog); sentinels at the polygon's edges are asked "does this match what you see?" |
| Slow | Edge-first sweep from the hazard side, five calls at a time; the dose preview ("wakes about 41,000") before any phone rings; block-by-block evacuation in waves under an Order |
| Hold | Before an Order is broadcast: a 90-second hold with sentinel reads, Send now / Hold once / Edit polygon / Cancel / Hand to authority; at 0:00 it sends on time — the machine can delay an alert, never stop one |
| Hand to a person | Help registry with last-seen locations for the quick response team, live location with consent, a helper sent to the exact spot, pickup runs, call backs; a ledger of every human decision and every refusal; a delivery canary after the send |

The agent can only read the directive, route and evacuation point a human approved for the zone the person is
in. It has eight tools and no others: `record_status`, `report_hazard`, `request_human`, `end_call`,
`lookup_zone`, `read_observation`, `received_alert`, `share_live_location`. It cannot change a zone, send or
cancel an alert, give an ETA, say anyone is safe, or tell a caller where another person is.

### Features

- **Block-by-block evacuation.** Under an Order the zone is cut into patches about half a mile (800 m) on a side.
  Several leave per wave, nearest the fire first, each on an assigned exit road; no road gets more cars in a wave
  than it carries (lane counts from OpenStreetMap; the planning assumptions are shown on screen). Safety rules: the
  Order is never delayed for anyone in danger; every "get ready" message says "If you see fire or smoke, or feel
  unsafe, leave right away. Do not wait for your wave."; the fire model or a person can pull a block forward at any
  time; "Everyone go now" is always one click; inside each wave, people who need extra help are called first.
  `lib/engine/blocks.ts`, `lib/engine/plans.ts`.
- **Live location, with consent.** The agent asks once ("Can I text you a link that shares your phone's live
  location with the response team?"). The person taps Share on `/l/<token>`; each GPS fix updates their registry
  row. The supervisor sends a helper, whose page (`/helper/<token>`) shows the spot, the needs and a Navigate button.
  Sharing stops when help reaches them, when they stop it, or after 4 hours. Public feeds keep only a hex cell.
  `lib/engine/locate.ts`.
- **Heat check-in line (the everyday customer).** Six San Fernando Valley demo zones; live Open-Meteo readings and
  National Weather Service alerts per zone propose a heat level, and a named person approves it. Calls go to older
  residents who opted in, people who live alone or have no air conditioning first: a ride to a cooling center, a
  wellness visit through the same helper flow, "hang up and call 911 now" for heat-stroke warning signs, and the
  silence rules (no answer twice: the linked contact, then a door knock). `lib/scenarios/heat.ts`,
  `lib/engine/weather.ts`.
- **The board.** A left sidebar with six views (🗺️ Map, 📞 Calls, 🆘 Help, 📜 Ledger, 📰 Feed, 💬 Ask), live
  numbers, and the scenario switch. A one-minute guided tour: `/board?tour=1`.
- **Play the full fire.** `/board?autoplay=1` (or the button on the board) plays the whole demo on the real board
  with captions, in about four minutes. Autoplay signs its decisions as a stand-in supervisor; the board never
  counts them as human decisions.
- **Retell kit.** `docs/retell/` holds the prompt, the eight functions, a conversation flow and a copy-by-hand page,
  generated from the code by `npx tsx scripts/retell-export.ts`. See [`docs/retell/README.md`](docs/retell/README.md).
- **Pitch deck.** `ppt/voiceflare_pitch.html`: 13 slides, 3 minutes. F for fullscreen, N for speaker notes, arrow
  keys to move. See [`ppt/README.md`](ppt/README.md).
- **Collections line, base mode, any country.** Grab lists for museums, archives and collectors (at Warning only,
  always below people); an installation's lockdown desk; six jurisdiction profiles and a Chongqing scenario
  (`/global`).

## Pages

| Page | What it is |
| --- | --- |
| `/` | Landing page: the live Norte Fire strip, the hold replay, and the dual-use section (the fire night and an ordinary hot Tuesday, rung by rung) |
| `/board` | The supervisor's board (`?tour=1` guided tour, `?autoplay=1` Play the full fire) |
| `/phones` | QR codes for the six volunteer phones; each opens `/phone/<id>` |
| `/call` | The public line on the browser (pick a language) |
| `/qrt` | Response team: registry map, pickup runs, door-knock sheet |
| `/l/<token>`, `/helper/<token>` | The person's live-location link; the helper's page |
| `/demo` | Scenario reset, presets (wrong polygon, tower down), autopilot |
| `/evidence` | Twist 1: Phase I milestones measured live (JSON and CSV at `/api/evidence`) |
| `/global` | Twist 2: six adapters side by side, the Chongqing scenario. A flood page, `/global/flood`, is being built as a second screen |
| `/twists`, `/poster` | The twist log; the 24 x 36 in poster (Twist 3) |
| `/api/health` | Health check |

## Run it

Requirements: Node 22+ (supabase-js crashes on Node 20: no native WebSocket; `.nvmrc` says 22) and an Anthropic API
key. Supabase and Retell are optional.

```bash
npm install
cp .env.example .env.local      # set ANTHROPIC_API_KEY at minimum
npm run dev                     # http://localhost:3000
npm run seed                    # loads the Westside Fire (or: npm run seed heat | norte | altadena | chongqing)
```

- **No Supabase?** The server keeps data in `.data/secondkey.json` (one machine, one process). `STORAGE=local`
  forces the file store.
- **Supabase:** follow [`db_setup.md`](db_setup.md): run `supabase/schema.sql`, then the migrations in
  `supabase/migrations/` in order (`002` to `005`), set the three Supabase variables, then `STORAGE=auto`.
- **No Retell?** Calls ring the browser phone page (`/phone/<id>`) on the volunteers' phones, with Claude Haiku as
  the agent and the browser's speech engines. With Retell, see [`docs/RETELL.md`](docs/RETELL.md): the same agent
  contract runs over the phone network, and a failed Retell call falls back to the browser phone.
- **Rehearsing alone?** Open `/board?autoplay=1`, or on `/demo` turn on *autopilot*: the simulator answers for the
  six device phones too.

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key (required) |
| `AGENT_MODEL` / `ANALYSIS_MODEL` | In-call model (`claude-haiku-5-5`) / post-call classifier (`claude-sonnet-5-5`) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Optional Supabase store |
| `STORAGE` | `local`, `supabase` or `auto` |
| `RETELL_API_KEY`, `RETELL_FROM_NUMBER`, `RETELL_AGENT_ID_EN` … `_FR` | Optional phone-network transport |
| `DEVICE_PHONE_1` … `DEVICE_PHONE_6` | Volunteer phone numbers (E.164) for Retell calls |
| `APP_BASE_URL` | Public URL (tunnel or deploy) for QR codes, links and Retell webhooks |
| `FEED_TOKEN` | Token for the GeoJSON feeds read by ArcGIS (default `demo`) |
| `CALLBACK_NUMBER`, `VERIFICATION_PHRASE` | Read at the start of every call (scam resistance) |

## Checks

```bash
npm run typecheck
npx tsx --conditions=react-server scripts/e2e.ts           # the whole demo path in-process, no API calls
npx tsx --conditions=react-server scripts/blocks-check.ts  # block-by-block evacuation: capacity, nearest first, everyone go now
npx tsx --conditions=react-server scripts/heat-check.ts    # the heat check-in line, with the network switched off
npx tsx scripts/autoplay-check.ts <url>                    # Play the full fire against a dev server with its own data file (it resets the run)
npx tsx --conditions=react-server scripts/agent-check.ts   # two live Claude calls (Spanish, English) and the post-call pass
```

Each in-process check writes its own data file under `.data/`, so the dev server is untouched.

## The demo path (about 3.5 minutes)

1. Map: Santa Monica red (Order, its blocks already leaving in waves), Venice orange (Warning), Culver City and West
   LA dashed (model proposals).
2. Approve Culver City to Near-Crisis: name, reason, the Warning text, the route, Westchester as the evacuation
   point. Stage 1 sweeps from the north-west edge.
3. Phone 1 (Spanish) is leaving with the kids; Phone 2 says her husband uses a wheelchair, no car, at Venice and
   Sepulveda — a priority-2 row with a stated location — and agrees to share her live location. Walter Hale does not
   answer twice; his linked contact (Phone 1) says he is leaving with her.
4. Compose the Order: the hold opens on the wrong, countywide polygon — "wakes 9.8 million". The judge's phone
   (a Long Beach sentinel) says "nothing here". Edit polygon: "wakes 41,000". Phones 3 and 4 at Culver City's
   edges: "yes, smoke to the west". Send now. Fifteen seconds later the Westchester canary is asked "did you just
   receive an evacuation order?" — "No": canary clear.
5. The block plan: blocks nearest the fire go first, each on its own road. Stage 3 relays the Order; a helper goes
   to Phone 2's exact spot; tower down on the Palms block turns ten pins silent and raises a silence cluster.
6. The ledger: approvals, the send, sentinel reads, refusals ("asked for an ETA"). Then switch the scenario to the
   heat wave: the same board on an ordinary hot Tuesday.

Full runbook: [`docs/DEMO.md`](docs/DEMO.md).

## Architecture

Next.js 16 (App Router) with route handlers; one storage interface (`lib/db`) over a local file store or
Supabase; the board and phones poll about once a second and each board poll advances the engine's timers
(`lib/engine/tick.ts`: dispatch, simulator, ring timeouts, holds, canaries, block-plan wave clock, pattern watch).
Claude Haiku runs the in-call turns on the browser transport (`lib/agent/turn.ts`, strict tool schemas); Claude
Sonnet runs the post-call classifier with structured output and reconciles it with the in-call answers
(`lib/agent/postcall.ts`). Retell carries the same prompt template and eight tools over the phone network
(`lib/retell`, `app/api/retell`). Product requirements: [`docs/PRD.md`](docs/PRD.md); decisions:
[`docs/decisions.md`](docs/decisions.md); Devpost text: [`docs/DEVPOST.md`](docs/DEVPOST.md).

## Twist 1: the federal funding pathway

Primary: NSF SBIR/STTR Phase I (NSF 26-510, up to $305,000, no equity; Project Pitch first; deadlines
Nov 4, 2026 and Mar 4, 2027). Alternatives: counties buy with FEMA UASI and EMPG grants (public alert and warning
systems are on FEMA's Authorized Equipment List); DoD SBIR and the Defense Innovation Unit for installations.
The build change: `/evidence` reports the Phase I milestones live from the run. Details: PRD section 17.1.

## Responsible use

Misuse: a wrong or compromised zone directive would be relayed to everyone in it, a colluding sentinel panel
could delay a real warning, and the registry and live locations describe real people at real places. Limits: the
agent reads only the directive a named human approved for the zone the phone is in and can change nothing else;
the hold is capped and never blocks a send; live location is shared only with consent, only with the response team,
stops at handoff or after 4 hours and never appears in public feeds; phased evacuation never makes anyone in danger
wait; every refusal and every human decision is in a ledger; the registry stores phone, zone, needs and last
location, is visible only to the response team, and is purged 72 hours after the incident closes.
