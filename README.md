# Second Key

The gentlest response that still works, for the overnight supervisor of an emergency call line.
USC Viterbi x InnovateLA Dual-Use Hackathon, October 2026 — Resilience Comms track (Retell AI).

Before an automated system wakes a zone, Second Key asks the people at the zone's edge, shows the supervisor
how many phones it will wake, and relays only the instruction a named human approved for that zone. Afterwards
it checks that the message landed, keeps a live list of who said they need help and where they were last heard
from, and hands the pattern of calls to the response team's map. The ladder: watch, ask, slow, hold, hand to a
person.

**Demo honesty.** Every resident is synthetic except the volunteer phones in the room. Every broadcast send is
simulated; it reaches no real alert system. The screen and the script say so.

## What it does

| Rung | Feature |
| --- | --- |
| Watch | Zones on the Cal OES ladder (Monitor, Watch, Warning, Order, Shelter in Place, Lifted); a toy fire-envelope model and call-pattern watch *propose* changes, drawn dashed; only a named human approves |
| Ask | Staged calls to residents in their language (English, Spanish, Korean, Mandarin, Hindi, French, Armenian, Tagalog); sentinels at the polygon's edges are asked "does this match what you see?" |
| Slow | Edge-first sweep from the hazard side, five calls at a time; the dose preview ("wakes about 41,000") before any phone rings |
| Hold | Before an Order is broadcast: a 90-second hold with sentinel reads, Send now / Hold once / Edit polygon / Cancel / Hand to authority; at 0:00 it sends on time — the machine can delay an alert, never stop one |
| Hand to a person | Help registry with last-seen locations for the quick response team, pickup runs, call backs; a ledger of every human decision and every refusal; a delivery canary after the send |

The agent can only read the directive, route and evacuation point a human approved for the zone the person is
in. It has seven tools and no others: `record_status`, `report_hazard`, `request_human`, `end_call`,
`lookup_zone`, `read_observation`, `received_alert`. It cannot change a zone, send or cancel an alert, give an
ETA, say anyone is safe, or tell a caller where another person is.

## Run it

Requirements: Node 20.9+ and an Anthropic API key. Supabase and Retell are optional.

```bash
npm install
cp .env.example .env.local      # set ANTHROPIC_API_KEY at minimum
npm run dev                     # http://localhost:3000
npm run seed                    # loads the Westside Fire scenario (or: npm run seed usc | altadena)
```

Open `/board` (the supervisor's screen), `/phones` (QR codes for the six volunteer phones), `/demo` (simulator
and rehearsal controls), `/qrt` (response team), `/evidence` (Twist 1: Phase I milestones measured live),
`/twists`, and `/api/health`.

- **No Supabase?** The server keeps data in `.data/secondkey.json` (one machine, one process). With Supabase,
  run `supabase/schema.sql` then `supabase/migrations/002_second_key.sql` in the SQL editor and set the three
  Supabase variables; the app switches automatically (`STORAGE=local` forces the file store).
- **No Retell?** Calls ring the browser phone page (`/phone/<id>`) on the volunteers' phones, with Claude Haiku as
  the agent and the browser's speech engines. With Retell, see [`docs/RETELL.md`](docs/RETELL.md): the same agent
  contract runs over the phone network, and a failed Retell call falls back to the browser phone.
- **Rehearsing alone?** On `/demo`, turn on *autopilot*: the simulator answers for the six device phones too.

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key (required) |
| `AGENT_MODEL` / `ANALYSIS_MODEL` | In-call model (`claude-haiku-5-5`) / post-call classifier (`claude-sonnet-5-5`) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Optional Supabase store |
| `RETELL_API_KEY`, `RETELL_FROM_NUMBER`, `RETELL_AGENT_ID_EN` … `_FR` | Optional phone-network transport |
| `DEVICE_PHONE_1` … `DEVICE_PHONE_6` | Volunteer phone numbers (E.164) for Retell calls |
| `APP_BASE_URL` | Public URL (tunnel or deploy) for QR codes and Retell webhooks |
| `FEED_TOKEN` | Token for the GeoJSON feeds read by ArcGIS (default `demo`) |
| `CALLBACK_NUMBER`, `VERIFICATION_PHRASE` | Read at the start of every call (scam resistance) |

## Checks

```bash
npm run typecheck
npx tsx --conditions=react-server scripts/e2e.ts          # the whole demo path in-process, simulated (no API calls)
npx tsx --conditions=react-server scripts/agent-check.ts  # two live Claude calls (Spanish, English) and the post-call pass
```

## The demo path (about 3.5 minutes)

1. Map: Santa Monica red (Order), Venice orange (Warning), Culver City and West LA dashed (model proposals).
2. Approve Culver City to Near-Crisis: name, reason, the Warning text, the route, Westchester as the evacuation
   point. Stage 1 sweeps from the north-west edge.
3. Phone 1 (Spanish) is leaving with the kids; Phone 2 says her husband uses a wheelchair, no car, at Venice and
   Sepulveda — a priority-2 row with a stated location. Walter Hale does not answer twice; his linked contact
   (Phone 1) says he is leaving with her.
4. Compose the Order: the hold opens on the wrong, countywide polygon — "wakes 9.8 million". The judge's phone
   (a Long Beach sentinel) says "nothing here". Edit polygon: "wakes 41,000". Phones 3 and 4 at Culver City's
   edges: "yes, smoke to the west". Send (simulated). Fifteen seconds later the Westchester canary is asked "did
   you just receive an evacuation order?" — "No": canary clear.
5. Stage 3 relays the Order; tower down on the Palms block turns ten pins silent and raises a silence cluster.
6. The ledger: approvals, the send, sentinel reads, refusals ("asked for an ETA"). Then flip to USC DPS mode.

## Architecture

Next.js 16 (App Router) with route handlers; one storage interface (`lib/db`) over a local file store or
Supabase; the board and phones poll about once a second and each board poll advances the engine's timers
(`lib/engine/tick.ts`: dispatch, simulator, ring timeouts, holds, canaries, pattern watch). Claude Haiku runs the
in-call turns on the browser transport (`lib/agent/turn.ts`, strict tool schemas); Claude Sonnet runs the
post-call classifier with structured output and reconciles it with the in-call answers (`lib/agent/postcall.ts`).
Retell carries the same prompt template and seven tools over the phone network (`lib/retell`,
`app/api/retell`). Product requirements: [`docs/PRD.md`](docs/PRD.md); decisions: [`docs/decisions.md`](docs/decisions.md).

## Twist 1: the federal funding pathway

Primary: NSF SBIR/STTR Phase I (NSF 26-510, up to $305,000, no equity; Project Pitch first; deadlines
Nov 4, 2026 and Mar 4, 2027). Alternatives: counties buy with FEMA UASI and EMPG grants (public alert and warning
systems are on FEMA's Authorized Equipment List); DoD SBIR and the Defense Innovation Unit for installations.
The build change: `/evidence` reports the Phase I milestones live from the run. Details: PRD section 17.1.

## Responsible use

Misuse: a wrong or compromised zone directive would be relayed to everyone in it, a colluding sentinel panel
could delay a real warning, and the registry is a list of real people at real locations. Limits: the agent reads
only the directive a named human approved for the zone the phone is in and can change nothing else; the hold is
capped and never blocks a send; every refusal and every human decision is in a ledger; the registry stores phone,
zone, needs and last location, is visible only to the response team, and is purged 72 hours after the incident
closes.
