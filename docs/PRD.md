# Second Key: Product Requirements Document

**Version 1.0, draft for team review.** Friday, October 16, 2026, 10:30 PM PDT. USC Viterbi x InnovateLA Dual-Use Hackathon, Resilience Comms track (sponsor Retell AI). Team of four (P1 backend and data, P2 AI and Retell, P3 frontend and demo, P4 product, twists and pitch).

"Second Key" is the working name. The name is decision D-01 in `decisions.md`; the alternates are "Lookout" and keeping "AllClear". Nothing in this document depends on the name.

**Builds on** the team's current documents and code: the AllClear Project Document (Oct 16, @Madhu: the 45-item backlog, the Claude agent with a browser phone page, the Supabase schema) and the Phase 0 commit in the team repo `madhulikavikraman/Dual_Use_Hackathon` (Next.js 16 scaffold, `supabase/schema.sql`, the synthetic west Altadena seed, env validation, health check). It carries forward the earlier AllClear + AllFound plan and the teammate feedback, and folds in the ideation verdict (Second Key) and tonight's new requirements: zones with directives set by a human or a prediction model, staged calls along the polygon edge, an intent classifier, a geo-tagged help registry, and an ArcGIS feed. Section 1.1 lists exactly what changes.

**One line.** Before an automated system wakes a zone, Second Key asks the people at the zone's edge, shows the human how many phones it will wake, and relays only the instruction a named human approved for that zone. Afterwards it checks that the message landed, keeps a live list of who said they need help and where they were last heard from, and hands the pattern of calls to the response team's own map.

## 1. Summary

The problem revealed at 6:15 PM: automated systems act on their own, misbehave, or go quiet when they should be talking, and the usual answer is a bang (shut it down, call everyone). Our seat is the Comms track's overnight supervisor of a call line, facing a surge of unverified calls with too few people. The ladder is watch, ask, slow, hold, hand to a person.

Second Key is one system with five parts, all run from one screen by that supervisor:

1. **Zones.** A map of Los Angeles and its neighbors (Santa Monica, Venice, Mar Vista, Culver City, Palms, West LA, Mid-City, Koreatown, Downtown) divided into zones. Each zone has a state on a ladder (Monitor, Watch, Near-Crisis, Crisis, Shelter in Place, Lifted) and a directive in California's standard evacuation vocabulary. A human sets zone states. A prediction model may propose them. Nothing calls anyone until a named human approves.
2. **Edge calls.** When a zone enters Near-Crisis (Evacuation Warning), the agent calls residents in two or three stages, starting at the edge of the polygon nearest the hazard and sweeping inward. Calls go over the phone network through Retell AI; the browser phone page from the Project Document stays as the fallback transport and the text path. The agent reads the approved directive for the zone the person is in: leave, prepare to leave, stay indoors, or move toward a named evacuation point. It never invents an instruction.
3. **Intent pipeline.** Every answered call runs through an intent classifier: in-call structured functions first, then an LLM classification of the transcript. "I need help" produces a geo-tagged entry in the help registry, with the phone number, the need, and the last known location, for the quick response team to act on.
4. **Hold and canary.** Before the alert that escalates a zone to Crisis (Evacuation Order) sends, the line holds for up to 90 seconds and rings enrolled sentinels at the polygon's far edges: "does this match what you see?" The screen shows how many phones the alert will wake. After the send, one phone outside the polygon is asked "did you just receive this?" The machine can delay an alert, never stop one.
5. **Pattern watch.** Geo-tagged reports and help calls are clustered on a map. In an earthquake, a pattern in the calls proposes zone changes to the human and is published as a live GeoJSON feed into ArcGIS, where LA's emergency planners already work.

A sixth part, AllFound (shelter intake that works offline and a reunification callback line), is kept from the teammate's plan as a stretch lane. See section 14 and decision D-04.

**Opening sentence for the pitch.** "On January 9, 2025, an alert meant for three cities woke ten million phones and kept echoing into the next day, and the desk that sent it found out from the callers. Second Key asks four neighbors before the send button, relays only what a human approved, and rings one phone outside the zone afterwards, so the desk knows in ninety seconds."

### 1.1 What changes against the Project Document

| | Component |
| --- | --- |
| Keep | Next.js App Router on Vercel, Supabase (Postgres, Realtime, presence), the Claude agent loop (Haiku in call, Sonnet after), the 45-item backlog and its P0 order, the synthetic seed and simulator presets, teach-back and % understood, household memory, calm mode, linked-contact fallback, pickup runs, silence clusters, the hazard layer, base mode, text mode, NWS alert polygons, the twist log, the verification phrase and callback number |
| Add | A `zones` table with states and directives, approvals and a ledger; model proposals (fire envelope, call pattern); Retell AI as the phone-network transport with the same tools; staged edge calls (Ready Check becomes Stage 1 of 3) with edge-first ordering; the hold with sentinels, the dose preview and the canary; an `intents` table with reconciliation; a cross-campaign help registry with last-seen locations; GeoJSON feeds and an ArcGIS web map; a Westside seed preset |
| Change | The agent may tell a resident to leave, prepare, stay indoors or move, but only by reading the directive a named human approved for that zone (the Project Document's "never asks a resident to stay or go look" becomes "never says anything a human did not approve for that zone, and never asks anyone to move toward a hazard"); campaigns reference a zone; the seat is the overnight supervisor, on the coordinator's screen; the demo geography moves to the Westside with the Altadena preset kept; USC DPS is the Tuesday customer on stage, with senior-living and home-health operators in the business slide |

## 2. Problem, seat and moment

**The failure we build against.** Alerts and call-outs are automated systems. When they misbehave they do it at scale: the January 9, 2025 Kenneth Fire evacuation warning reached about 10 million phones across Los Angeles County instead of a few neighborhoods, repeated through the night and into the next day, and the originating desk learned the scope from the callers. Rep. Robert Garcia's May 2025 oversight report ("Sounding the Alarm") traced it to the polygon never reaching the distribution system. The opposite failure also happened that week: in Altadena, warnings reached parts of the west side hours late. And on August 2, 2018, one 911 call during a drill at Wright-Patterson Air Force Base produced an hours-long base-wide lockdown with about 50 armed responders. Too loud, too late, or loud for the wrong reason: all three are "the bang."

**The seat.** The overnight supervisor of a county or city alert and information line. 3:40 AM. Two things can be on the desk: a request to warn or order a zone, or eleven calls in twenty minutes from one neighborhood reporting smoke, shaking, or an injury. Too few people to answer, no way to verify, and the blunt tools are "alert everyone" or "send it all to a human who isn't there."

**The moment.** A zone is about to change state. The supervisor must decide, within minutes, whether the change is right, who inside the zone needs a person now, what to tell everyone else, and what to do about the people who did not pick up.

**The second customer (an ordinary Tuesday).** USC's Department of Public Safety before a TrojansAlert. Campus zones are buildings and quads; sentinels are resident assistants and officers already on post; the directive vocabulary is "avoid the area," "shelter in place," "all clear"; a monthly test call keeps the roster alive. The same shape fits a hospital's night nursing supervisor before a ward page.

**The defense customer.** An installation command post before a base-wide lockdown: zones are housing areas, gates and the flight line; sentinels are gate posts and housing phones; the registry uses the personnel-accountability vocabulary of ADPAAS, NFAAS and AFPAAS.

## 3. Goals, non-goals and success metrics

### Goals

- G1. Replace "alert everyone" with the gentlest response that still works, on the ladder's Ask, Slow and Hold rungs, with Hand-to-a-person as the only exit.
- G2. Give the supervisor three things in ninety seconds: a read from people at the edge, a count of how many phones the action wakes, and a clear record of who needs a person now.
- G3. Make "what must never be automated" visible as a function allowlist and a ledger, not as prompt text.
- G4. Relay instructions people can act on (leave, prepare, stay, move toward a point), bound to a human-approved zone, in the resident's language.
- G5. Produce a live, geo-tagged help registry and a pattern feed the response team can use in their own tools (ArcGIS).
- G6. Work when the network is weak, when people speak other languages, and when nobody picks up.

### Non-goals

- Replacing 911, Wireless Emergency Alerts (WEA), IPAWS, or the county's alert-origination system. Our broadcast "send" is simulated and labeled.
- Real resident data. The roster is synthetic and labeled, plus four to six volunteer phones.
- Deciding anything. The model proposes, the agent relays, the human decides.
- Dispatching responders. The registry is a list for humans to act on.
- Logins, roles, admin settings, citywide scale, hardware.

### Success metrics (demo-measurable, real phones only)

| Metric | Target |
| --- | --- |
| Zone approved to first resident phone ringing | under 60 s |
| Hold opened to quorum read on screen (2 sentinel answers) | under 90 s |
| Call ended to intent classified and registry row visible | under 15 s |
| Scripted calls classified with the right intent and need | 9 of 10, across 3 languages |
| "Needs help now" calls surfaced to the registry | 10 of 10, regardless of classifier confidence |
| Simulated send to canary phone ringing | under 20 s |
| Cluster from seeded reports visible in the ArcGIS web map | within one refresh interval (60 s) |
| Volunteer phones accounted for after Stage 1 | all, within 3 min; synthetic rows labeled and excluded from the count |
| Ledger | every human decision and every refused action listed with a timestamp |

## 4. People

| Who | Role in Second Key | What they see |
| --- | --- | --- |
| Overnight supervisor (the decider) | Opens holds, approves or rejects zone changes proposed by the model, starts call stages, decides Send / Hold once / Edit / Cancel / Hand off | The one screen: map, hold strip, dose preview, tally, registry, ledger |
| Alert authority / duty officer | Receives the hand-off with the evidence; owns the real alert-origination system | Hand-off card: zone, read, count, clock, recommendation |
| Quick response team (QRT) lead and field teams (pickup vans, door-knock teams, CERT) | Work the help registry: assign, en route, reached, closed; receive pickup runs and silence-cluster cards | Registry map and list, pickup-run panel, callback button, printable door-knock sheet, export |
| Linked contacts (relatives, caregivers) | Called when a resident cannot be reached | A short call: "Have you heard from your mother? Is she leaving?" |
| EOC planning / GIS analyst | Consumes the pattern feed and zone layer | ArcGIS web map and dashboard fed by our GeoJSON |
| Residents in a zone | Receive staged calls in their language; can call the public line | A phone call that reads the approved directive and asks fixed questions |
| Sentinels | Enrolled residents, RAs, officers, nurses at the polygon's edges | A 30-second call: "does this match what you see?" |
| Canary | One or two enrolled phones just outside the polygon | A 15-second call: "did you just receive an alert?" |
| Shelter intake volunteer and the out-of-state relative (AllFound lane) | Register evacuees offline; get a callback when a match is confirmed | Offline intake PWA; a Retell callback |

## 5. The demo scenario: Westside Fire (synthetic)

The geography is stylized for the demo. The mechanics do not depend on it; any zone set with directives works.

**Story.** 3:40 AM, Tuesday. A wind-driven fire is burning in Santa Monica with offshore winds pushing it east along the I-10 corridor toward Downtown Los Angeles. Santa Monica is under an Evacuation Order. The prediction model projects the three-hour envelope into Venice, Mar Vista, West LA, Palms and Culver City and proposes Near-Crisis (Evacuation Warning) for them; the supervisor approves Culver City and Palms first. Staged calls sweep Culver City from its north-west edge inward, relaying the Warning and the evacuation point. A resident in Palms says her husband uses a wheelchair and they have no car: a red pin appears in the registry at her stated location, with her number. Forty minutes later the envelope reaches Culver City's edge; the duty officer requests an Order. Second Key holds 90 seconds, rings four sentinels at Culver City's edges, shows "wakes 41,000" (not 9.8 million), gets two "yes, I see smoke to the west" reads, and the supervisor clicks Send (simulated). Fifteen seconds later a canary phone in Westchester is asked "did you just receive an evacuation order?" and says no, correctly. Stage 3 calls relay the Order to Culver City; a resident who says he cannot leave goes to the top of the registry.

### Zone set for the demo

| Zone ID | Name (LA and neighbors) | State at demo start | Directive (California standard vocabulary) | Evacuation point | Population (dose preview) |
| --- | --- | --- | --- | --- | --- |
| LA-SM | Santa Monica | Crisis | Evacuation Order: leave now; move south via Lincoln Blvd toward Playa Vista; avoid I-10 eastbound | Westchester Recreation Center | about 93,000 (2020 census, rounded) |
| LA-VN | Venice and Mar Vista | Near-Crisis | Evacuation Warning: prepare to leave; if you need extra time or have pets, leave now toward Westchester | Westchester Recreation Center | computed at build |
| LA-WL | West LA and Sawtelle | Near-Crisis (proposed by model) | Evacuation Warning | Jesse Owens Community Regional Park | computed at build |
| LA-CC | Culver City and Palms | Near-Crisis, escalates to Crisis in the demo | Evacuation Warning, then Evacuation Order: leave now; move south via Sepulveda Blvd or La Cienega Blvd toward Westchester | Westchester Recreation Center | about 41,000 for Culver City alone (2020 census, rounded) |
| LA-MC | Mid-City and West Adams | Watch | Advisory: be aware, no action required; we will call if that changes | none yet | computed at build |
| LA-KT | Koreatown and Pico-Union | Watch | Advisory | none yet | computed at build |
| LA-DT | Downtown Los Angeles | Monitor | none | none | computed at build |
| Outside | Westchester, Inglewood (canary phones) | n/a | n/a | n/a | n/a |

Shelters and routes above are demo choices and are labeled as such on screen. In production the list comes from the county or city.

**Seed presets.** `westside` (this scenario: the 40 synthetic households spread across Culver City and Palms with a few in Venice and Mar Vista, the six volunteer devices placed at the polygon edges so real phones play the sentinels and canaries) and `altadena` (the Project Document's west Altadena roster, kept for the Eaton-fire framing in the problem slide and as a one-zone fallback). The seeder is deterministic; the preset only changes the center, the streets and the polygon set.

## 6. The zone model

A zone is a polygon with a state, a directive, a source, and an approval record.

### 6.1 Zone states and directives

The ladder from the problem statement maps onto zone states. Directives use the terminology Cal OES standardized statewide in May 2020, read verbatim by the agent.

| State | Ladder rung | Directive text the agent may read | Color | What the system does |
| --- | --- | --- | --- | --- |
| Monitor | watch | none | grey | Nothing. Pattern watch runs in the background. |
| Watch | watch, ask | "Be aware. No action is required right now. We will call again if that changes." | yellow | Sentinel roster warmed; one optional advisory call to flagged-vulnerable residents. |
| Near-Crisis | ask, slow | Evacuation Warning: "Potential threat to life and/or property. Those who require additional time to evacuate, and those with pets and livestock, should leave now." plus the approved move text and evacuation point | orange | Pre-emergency protocol starts: Stage 1 calls edge-first, registry triage, Stage 2 at the interval. |
| Crisis | hold, hand to a person | Evacuation Order: "Immediate threat to life. This is a lawful order to leave now. The area is lawfully closed to public access." plus move text and evacuation point | red | The Hold runs before the Order broadcast; canary after; Stage 3 relay calls; roll call. |
| Shelter in Place | hold | "Go indoors. Shut and lock doors and windows. Prepare to self-sustain until further notice and/or contacted by emergency personnel for additional direction." | purple | Earthquake, hazmat or active-threat mode; registry prioritizes trapped or injured. |
| Lifted | hand to a person | "Evacuation orders for [zone] are lifted." | green | Human-only verb. Optional closing call (P2). |

Stored values: `monitor`, `watch`, `warning`, `order`, `shelter_in_place`, `lifted`. The schema's campaign stages (`checkin`, `warning`, `order`, `all_clear`) map onto them: a Near-Crisis zone runs `warning` campaigns, a Crisis zone runs `order` campaigns, Lifted runs `all_clear`, and `checkin` is the Tuesday test call.

Rules:

- Only a named human moves a zone up or down the ladder. The approval records who, when, and why, and lands in the ledger.
- The move text and evacuation point are part of the approval. The agent reads them verbatim and may paraphrase nothing.
- A zone may skip states upward (Monitor to Crisis) when the incident commander orders it; the Hold still runs unless the approver marks "IC order, bypass hold," which is itself logged.
- "Lifted" and "safe" are human-only words. The agent never says a zone is clear or a person is safe.

### 6.2 Zone sources: human and model

**Human.** The supervisor loads a saved zone set (GeoJSON), draws or edits a polygon, or adopts a live National Weather Service alert polygon in one click (backlog item 8), picks a state, and enters or accepts the directive, move text and evacuation point.

**Model (advisory).** A prediction model proposes zone changes; proposals are drawn as dashed outlines with a "Proposed by model, needs a human" badge and a one-line reason. Two models are in scope:

| Model | Inputs | Output | MVP form |
| --- | --- | --- | --- |
| Fire spread envelope | Fire perimeter or hotspot cluster (NASA FIRMS VIIRS near-real-time detections, about 3 h latency, or a seeded perimeter), hourly wind speed and direction from the National Weather Service API (api.weather.gov gridpoint hourly forecast) | A downwind ellipse at 1 h, 3 h and 6 h; zones intersecting the 1 h envelope are proposed Crisis, 3 h Near-Crisis, 6 h Watch | Seeded perimeter plus live or seeded wind; a simple wind-driven ellipse (length-to-breadth grows with wind speed). Labeled "toy model" on screen. |
| Call pattern (earthquake mode) | Geo-tagged intents (hazard reports, help requests), inbound call volume per zone against a rolling baseline, seeded 911-style reports, USGS earthquake GeoJSON feed as a trigger | Clusters per hex cell; zones with a corroborated cluster are proposed Watch or Shelter in Place | Seeded reports plus live intents from the demo calls. See section 12. |

A proposal never calls anyone. The human may approve, edit, or reject it. Rejections are logged with a reason so the model's record is visible.

### 6.3 Geometry and population

- Zone building blocks: LA City Neighborhood Council boundaries (official, from data.lacity.org), LA County community "Places" polygons (unofficial, for names), and city boundaries for Santa Monica and Culver City. For the demo, seven hand-simplified polygons are enough; they are loaded, not drawn, and editable.
- Residents and sentinels are assigned to zones by point-in-polygon (Turf.js in the browser, Shapely or PostGIS on the server).
- The dose preview is population inside the polygon, from census block estimates precomputed at build time, labeled "estimate." The number sits above the hold tally before any phone rings.
- Edge geometry: for each resident the system computes distance to the zone boundary nearest the hazard origin. Edge-first ordering and sentinel selection both use it (section 8).

## 7. The ladder, mapped to features

| Rung | What Second Key does | Feature |
| --- | --- | --- |
| Watch | Clusters geo-tagged reports and help calls; the fire model projects the envelope; nothing calls anyone | Pattern watch (section 12), model proposals (6.2), ArcGIS feed |
| Ask | Rings the people who can see: sentinels at the polygon's edges; asks residents in a Warning zone what they need | Hold (8.1), staged edge calls (8.2), intent pipeline (10) |
| Slow | Edge-first sweep instead of a blast; the dose preview before any ring; staged calls instead of one | Edge-first ordering (8.2), dose preview (6.3) |
| Hold | A 90-second timer before the Order broadcast, capped at 120 s, that defaults to sending on time | Hold strip (8.1) |
| Hand to a person | Every exit is a named human: approve a zone, click Send, take the hand-off card, work the registry | Approval flow (6.1), decider buttons (9), registry (11), ledger (9) |

## 8. Call programs

**Two transports, one agent contract.** Retell AI carries calls over the phone network: batch outbound with per-call dynamic variables, inbound on a public number, custom functions as HTTPS routes with signature verification, webhooks, post-call analysis, one agent configuration per language (English, Spanish, Korean, Mandarin; Armenian and Tagalog by SMS or an Azure-backed agent where voice recognition is thin). The browser phone page from the Project Document (`/phone/[id]`: ringing, push-to-talk, per-language speech synthesis, presence, text mode) is the fallback transport and the path for deaf or hard-of-hearing residents and noisy rooms. Both call the same tool endpoints and write the same rows; the board tells them apart only by a `transport` field. The in-call brain is Retell's LLM on the phone transport and Claude Haiku on the browser transport, with the same system prompt, the same tools and the same post-call Claude pass (decision D-05). Every agent has the same tool allowlist (section 9). Variables carried into every call: `zone_name`, `zone_state`, `directive_text`, `move_text`, `evac_point`, `stage`, `language`, `callback_number`, `verification_phrase`, `memory_note`, `simulated` (always "true" in the demo and said out loud).

### 8.1 Hold: edge verification before the Order (the Second Key core)

**Trigger.** A zone is proposed to move to Crisis (Evacuation Order) or any broadcast alert is composed for a polygon. Second entry: a corroborated cluster from pattern watch opens the same screen.

**Sequence.**

1. The composer shows the polygon, the alert text and the dose preview: "wakes about 41,000 people across 5.1 square miles."
2. A server-side timer starts at 90 s (cap 120 s). Four to five sentinels ring in parallel: three at the polygon's far extremes from the hazard origin (where polygon errors live) and one or two at the near edge (where the hazard should be visible).
3. The sentinel agent reads the alert text verbatim and asks one question: "Does this match what you see? Yes, no, or not sure. What do you see, and in which direction?"
4. The tally updates live: yes / no / unsure / silent. Quorum is two answers. Silence is an abstention, never a No; the next-nearest sentinel rings.
5. Buttons for the supervisor: **Send now**, **Hold once** (+60 s, once), **Edit polygon**, **Cancel**, **Hand to authority**. Each requires a name and a reason and lands in the ledger.
6. At 0:00 with no decision, the alert sends on time (simulated). The machine can delay an alert; it can never stop one.
7. After the send: the **canary**. One or two enrolled phones just outside the polygon ring: "Did you receive an evacuation order in the last minute? Yes or no." A "yes" outside the polygon, or a "no" from a phone inside, is a transport failure and goes to the authority as a flag, not a stop. This is the only mechanism here that would have caught January 9, 2025.

**Tools.** `read_observation(zone_id, sees: yes|no|unsure, what, direction)`, `received_alert(yes|no)`, `request_human(reason, urgency)`, `end_call`.

**Sentinel roster.** Enrolled people with phone, language, channel (voice, SMS, landline), zone, on-post flag, last heard, reliability. The Tuesday roster is people already on shift (RAs, officers, nurses). In a surge, callers who just reported are live sensors at a known address: they are asked to look again and labeled non-independent; enrolled sentinels supply independence.

### 8.2 Staged edge calls to residents (Near-Crisis zones)

**Trigger.** A named human approves a zone to Near-Crisis (Evacuation Warning). This starts the pre-emergency protocol.

**The pre-emergency protocol.**

| Step | When | What happens |
| --- | --- | --- |
| 0 | On approval | Directive, move text and evacuation point confirmed in the approval dialog. Roster inside the polygon selected by point-in-polygon. Edge-first order computed. |
| 1 | T+0 | **Stage 1, Warning (the Project Document's Ready Check).** Calls sweep the polygon from the edge nearest the hazard inward in rings of about 200 m; inside each ring, residents with access and functional needs (mobility, oxygen, powered medical devices, no car, children alone) ring first. Concurrency capped (5 parallel in the demo). |
| 2 | T+0 to T+10 min | Registry triage: QRT lead works new help entries by priority. |
| 3 | T+45 min, or when the model's envelope moves (2 min in the demo) | **Stage 2, Check.** Only residents who said "staying," "preparing," or "unclear," and the no-answers: "Have you left? Do you need help leaving? Is anyone with you?" Updates last known location. |
| 4 | If the zone is proposed for Crisis | The Hold runs (8.1). On Send, the zone becomes Crisis. |
| 5 | Zone becomes Crisis | **Stage 3, Order relay.** Everyone not confirmed "already left": reads the Order and the move text. Anyone who says they cannot leave gets the 911 instruction and goes to the top of the registry. |
| 6 | After Stage 3 | Roll call (8.4) for the remaining no-answers. Unreached and vulnerable rows become the door-knock list for QRT. |
| 7 | Human lifts the zone | Optional closing call (P2): "Evacuation orders for Culver City are lifted." |

**Stage 1 script (English; the directive and move text are variables, read verbatim).**

> "This is the Los Angeles emergency information line, verification phrase [phrase]. This is a simulated call for a hackathon demonstration. Culver City is under an Evacuation Warning: potential threat to life and property. Those who need additional time to evacuate, and those with pets and livestock, should leave now. If you leave, head south via Sepulveda Boulevard or La Cienega Boulevard toward the evacuation point at Westchester Recreation Center. Three quick questions. Are you planning to leave, stay, or have you already left? Does anyone at your address need help to leave? Where are you right now?"

The agent opens with the household memory note where one exists ("Last week you mentioned your oxygen concentrator; is it charged?"), confirms each answer back before writing it ("I heard you need help leaving because your husband uses a wheelchair, is that right?"), calls `record_status`, ends with the teach-back ("Where will you go, and by when?") which sets the understood flag, and if the person reports a medical emergency, says "Hang up and call 911 now" and calls `request_human` with reason `medical_emergency`. In calm mode (distress detected) it slows to one instruction at a time and offers a person. Calls are under 90 seconds.

**Edge-first ordering.** For each resident: distance to the zone boundary segment nearest the hazard origin (or the boundary shared with the Crisis zone). Sort ascending, batch in rings, ring vulnerable first within a ring. The board animates the sweep so the judge sees the polygon fill from the hazard side. Why: the people nearest the threat get the most lead time, and the first answers come from where the hazard should be visible, which doubles as a read.

**Picked up vs not.** Picked-up calls go to the intent pipeline (section 10). No-answers follow the silence rules (section 13): one retry after 10 minutes (30 seconds in the demo), then the linked contact where one is registered ("Have you heard from your mother? Is she leaving?", recorded as status via linked contact), then a voicemail that reads the directive and the callback number, then SMS (stretch), then a registry row marked "unreached" if the resident has access or functional needs or the zone reaches Crisis. Phones whose presence heartbeat is gone are marked unreachable at once.

### 8.3 Inbound line

Residents call the public number. The agent identifies the zone from the caller's enrolled address or asks "where are you right now?" and calls `lookup_zone(location_text)`, which geocodes, runs point-in-polygon, and returns the approved directive for that zone. The agent reads it verbatim. Intents are classified like any call. "I need help" produces a registry row. "I see smoke on Venice Boulevard" produces a geo-tagged report for pattern watch. A relative looking for someone is routed to the AllFound line (section 14). Anything the agent cannot answer from the alert text and the zone fact sheet gets "I can't answer that; a person will call you back" and `request_human` with reason `cannot_answer`.

### 8.4 Roll call (from AllClear, after the Order)

For Crisis zones after Stage 3: call households not yet heard from; record safe, leaving (to where), needs help, no answer. "Leaving to Westchester" creates an expected arrival on that shelter's intake screen when the AllFound lane is built. Base mode uses the ADPAAS status vocabulary (accounted / unaccounted; needs categories housing, medical, financial, employment, transportation, child care, counseling, legal).

### 8.5 Monthly test call (the Tuesday product)

Every sentinel and every USC DPS roster member gets a 20-second test call once a month: "This is the Second Key test. Press or say 1 if you can hear this." It keeps the roster alive, trains the reliability score, and is the everyday use that makes the roster exist on the night it is needed. Three silent tests replace a sentinel.

## 9. What the agent can and cannot do

The allowlist is the user interface: it is printed on the supervisor's screen, and every refusal is written to the ledger with a timestamp. This is the answer to "what must never be automated," and it is the responsible-use note, live.

### The agent can

| Capability | How it is bounded |
| --- | --- |
| Tell a person to leave, prepare to leave, stay indoors, or move toward a point | Only by reading `directive_text`, `move_text` and `evac_point` for the zone the person is in, exactly as a named human approved them. If the person says they are somewhere else, `lookup_zone` returns that zone's approved text. No zone, no instruction: "I don't have instructions for your location; a person will call you back." |
| Read the official alert text verbatim | The text is a variable; the agent may not add to it |
| Ask the fixed questions and record answers | `record_status(status, understood, destination, people, needs[], device_battery_hours, animals, location_text, location_consent, can_leave, refusal_reason, memory_note)` after a confirmation turn; fixed enums |
| Send a caller to 911 and flag the record | `request_human(reason: medical_emergency, urgency)`: "Hang up and call 911 now." The row goes red and to the top |
| Report what a resident sees | `report_hazard(seen, type, direction, distance)`, asked only of residents who are safe or already leaving; never "go look" |
| Ask a sentinel what they see; ask a canary if the alert arrived | `read_observation(...)`, `received_alert(yes or no)` |
| Say it cannot answer and promise a human | `request_human(reason: cannot_answer, confusion, distress, refusal, doubts_call)` |
| Answer questions from the alert text and the zone fact sheet | Fact sheet is a per-zone document approved with the zone: evacuation point address, pets policy, road closures |
| Ask where the person is and whether their location may be shared with the response team | `location_text` and `location_consent` on `record_status`; consent is stored with the location |
| End the call | `end_call` |

Seven tools in total: the Project Document's four (`record_status`, `report_hazard`, `request_human`, `end_call`) with a few added fields, plus `lookup_zone`, `read_observation` and `received_alert`.

### The agent cannot

- Change a zone's state or directive; send, cancel, widen or retract an alert; extend or shorten the hold.
- Give any instruction that is not the approved text for the person's zone. No improvised routes, no "you're probably fine," no ETA, no description of the hazard beyond the alert text.
- Say a zone is clear or a person is safe. Those are human words.
- Call anyone who is not on the roster or inside an approved zone.
- Tell a caller where another person is. Reunification answers go out only by callback, with consent (section 14).
- Dispatch anyone. The registry is for humans.

**Buttons, not prompts.** Send now, Hold once (+60 s), Edit polygon, Cancel, Hand to authority, Approve zone, Reject proposal, Assign, Close. Each logs a name and a reason.

**The change from the ideation verdict.** The verdict listed "tell anyone to leave, stay or move" under cannot. This PRD moves it to can, with the binding above: the instruction belongs to the zone and the human who approved it, not to the agent. Reasoning and consequences are decision D-02.

## 10. The intent pipeline

Every connected call produces one intent record from two layers, reconciled.

**Layer 1, in call.** The agent asks fixed questions, confirms, and calls `record_status` with enums. Fast, structured, and visible to the caller ("I heard...").

**Layer 2, post call.** On the phone transport, Retell's `call_analyzed` webhook delivers the transcript plus Retell's own custom analysis fields (Selector, Text, Number and Boolean fields: intent, needs, people, can_leave, location_text); on the browser transport, the call's `messages` are the transcript. The post-call pass (backlog item 34) runs Claude claude-sonnet-5-5 (`ANALYSIS_MODEL`) over the transcript with a strict JSON schema via tool use: primary intent, flags, needs, people count, location text, understood, language, confidence, a one-line summary, and the memory note to append. Results land in the `intents` table and fill any field the in-call tools missed.

**Reconciliation.** An in-call confirmed tool result wins over the post-call result, which wins over Retell's analysis. Any disagreement on the primary intent, or confidence under 0.7, flags `review_needed` for a human. "needs_help_now" from any layer surfaces immediately, whatever the confidence. The classifier never changes a zone; it writes records and queue rows.

**Mapping to the board.** The `household_status.status` enum stays as it is: needs_help_now and needs_help_leaving both write `needs_help` (the registry carries priority 1 or 2); leaving writes `leaving` with the destination; staying writes `wont_leave`; already_left writes `safe` with the destination; unclear and voicemail write `unclear` or `no_answer`; wrong_number writes `wrong_number`; hazard_report and no_hazard_seen write `report_hazard` rows and, for sentinels, the hold tally.

### Intent taxonomy (fixed)

| Primary intent | Meaning | Routing |
| --- | --- | --- |
| needs_help_now | Life safety: medical, trapped, fire at the house, cannot breathe | "Hang up and call 911." Registry priority 1. QRT alert. |
| needs_help_leaving | Can leave only with help: wheelchair, oxygen, no car, children alone, pets, blind or deaf | Registry priority 2, transport queue, Stage 2 skipped (a person calls back instead) |
| leaving | Will leave; destination captured | Expected arrival at the shelter; no Stage 2 |
| staying | Refuses or undecided | Stage 2 and Stage 3 continue; flagged on the board |
| already_left | Out of the zone | Stop calls; last location updated |
| hazard_report | Sees smoke, fire, shaking damage, injury (for sentinels: yes / no / unsure) | Geo-tagged report to pattern watch; hold tally if a sentinel |
| no_hazard_seen | Sentinel: no | Hold tally |
| info_request | Asked something answerable from the alert text or fact sheet | None |
| wrong_number / not_in_zone | Not a resident, moved, or outside | Roster correction |
| unclear / voicemail / silence | No usable conversation | Retry schedule (section 13) |

Flags (any number): medical, mobility, oxygen, no_car, children, pets, language_mismatch, hostile, duplicate.

**Evaluation.** A gold set of 20 scripted transcripts (English, Spanish, Korean) with expected intents and needs, run against the classifier every few hours; target 18 of 20. Keep the three worst in the pitch appendix.

## 11. The help registry (last seen)

The registry is the list the quick response team works from. One row per person who needs a person, with the phone number, the need, and the last place the system heard from them.

### Row

| Field | Notes |
| --- | --- |
| phone, name (optional), language | Phone is the key; name only if given |
| zone_id | From point-in-polygon of the last location |
| priority | 1 life safety, 2 needs help leaving, 3 check later / unreached and vulnerable |
| needs[] | The schema's Need enum (wheelchair, walker, no_car, oxygen, powered_medical_device, dialysis, bedbound, children_alone, hearing, vision, cognitive, other) plus device_battery_hours and animals; no free-text health data |
| people_count | Including the caller |
| status | open, assigned, en_route, reached, closed, unreachable |
| assigned_to, run_id | QRT member; the pickup run the row belongs to |
| source | stage1, stage2, stage3, inbound, rollcall, sentinel, manual |
| last_seen | lat, lng, accuracy_m, source, observed_at (ISO 8601 UTC), consent |
| created_at, updated_at | ISO 8601 UTC |

### Last known location

Precedence: a shared GPS fix from an SMS link (stretch) beats a location stated in the call and geocoded, which beats the enrolled address, which beats the zone centroid (flagged low precision). Each row shows the age of the fix (fresh under 15 min, stale after) and the source. Geocoding uses the ArcGIS World Geocoding service, which handles intersections ("Venice and Sepulveda") better than Nominatim; Nominatim is the fallback. Every call that reaches a person refreshes the location, so Stage 2 and roll call double as location updates.

### QRT view

- Map with pins colored by priority and ringed by age; list sorted by priority then age; filters by zone and status.
- Pickup runs (backlog items 14 and 41) are built from registry rows: cluster by location and need, order by device battery hours then distance to the hazard, nearest-neighbor route; wheelchair, oxygen and bedbound needs always go to official vans, and neighbor matching (item 39) only fills car-only needs with pre-registered drivers.
- Buttons: **Call back** (a Retell outbound call with the QRT script, logged), **Assign**, **Reached**, **Close**, **Ping location** (stretch: sends an SMS link to a one-page site that asks the browser for its position; needs an SMS provider since Retell is voice).
- Export: CSV for the field, GeoJSON for the ArcGIS feed (phone numbers excluded from the feed; see section 12).

### Privacy rules for the registry

- Stored: phone, zone, needs enum, people count, last location with consent flag. Not stored: diagnoses, free-text health notes.
- Visible to the QRT view only; never read back by the agent to any caller.
- Purged 72 hours after the incident is closed by a human; the ledger keeps counts, not rows.
- In the demo every row is synthetic except the volunteer phones, labeled on screen and said out loud.

## 12. Pattern watch and the ArcGIS feed (earthquake mode)

Residents are the earliest sensor and the biggest flood. Pattern watch turns the flood into a map the human can read, and hands it to the tools the response team already uses. It extends the Project Document's "calls as sensors" (hazard reports, silence clusters) with geo-tagged help calls, seeded 911-style reports and a public feed.

### Inputs

- Geo-tagged intents from every call: hazard reports (`report_hazard`: seen, type, direction, distance) and help requests with a last known location.
- Silence: households whose phones did not connect, clustered by the existing rule (about 300 m, at least three, within five minutes).
- Inbound call volume per zone against a rolling baseline (per hour of day; the demo uses a seeded baseline).
- Seeded 911-style reports (synthetic CAD rows: time, type, lat, lng) for the earthquake demo; a real feed would be a CAD export or a public-safety data share.
- USGS earthquake GeoJSON feed (event time, magnitude, epicenter) as the trigger for earthquake mode.
- Sentinel reads in the same zone, as corroboration.

### Detection

- Bin reports into hex cells (H3 resolution 8, roughly 0.7 km² per cell) and into zones.
- A hazard cluster is three or more nearby reports within five minutes (backlog item 42); a help cluster is a cell with at least five help or hazard reports in fifteen minutes; a volume cluster is a zone at three times its inbound baseline.
- A cluster is corroborated when at least one sentinel read in the zone says "yes," or a USGS event within the last thirty minutes covers the area.
- The hoax mirror: inbound reports high and sentinel reads zero on the same chart. A hoax cluster reads "not confirmed" in ninety seconds and never reaches Send.

### Outputs

1. **Proposals to the human.** A corroborated cluster proposes Watch (fire) or Shelter in Place (earthquake) for the zone, with the reason, as a `proposals` row and an `alerts_feed` card. Nothing changes until a named human approves.
2. **GeoJSON feeds.** Route handlers at `/api/feeds/zones.geojson` (polygons with state and directive), `/api/feeds/clusters.geojson` (hex cells with counts, baseline, score, first and last report time) and `/api/feeds/help.geojson` (registry rows as points with priority, needs, age and status; no phone numbers, no names). Each is a plain HTTPS URL with a token parameter and permissive CORS headers so ArcGIS Online can read it.
3. **ArcGIS.** Path A (P1): add each feed to an ArcGIS Online web map as a GeoJSON layer by URL and set the layer refresh interval, so the EOC's map updates on its own; one ArcGIS Dashboard with the map and three indicators (open help rows by priority, clusters, zones by state). Path B (P2): push rows into a hosted feature layer through the feature service `applyEdits` endpoint with an ArcGIS Location Platform API key (free tier), which lets planners symbolize and query the data as their own layer. Why ArcGIS: LA City's GeoHub and the county's GIS run on Esri, and EOC planning sections live in ArcGIS Dashboards; "responders want the data in their tools" is a predictable twist, and the CSV and CAP exports (item 19) stay for everyone else.
4. **Ledger.** Every proposal, approval and rejection is a row.

### Earthquake demo beat (if Twist 2 or 3 calls for it)

Seeded USGS event, magnitude 5.9 near the Newport-Inglewood fault. Twenty seeded reports land in two hex cells in Mid-City within four minutes; three live calls from the room add help intents with stated locations. The cluster card appears; a sentinel in Mid-City says "yes, shaking, a wall down on Pico." The model proposes Shelter in Place for Mid-City and Watch for Koreatown; the supervisor approves Mid-City. The ArcGIS web map, open on the second screen, refreshes and shows the cells and the help pins. The QRT lead assigns the top two rows.

## 13. Silence: what happens when nobody picks up

| Who is silent | Rule |
| --- | --- |
| A sentinel during a hold | Abstention, never a No. The next-nearest sentinel rings. Quorum needs two answers or the read is "no read." At 0:00 the alert sends regardless. |
| Every sentinel in a zone at once | "Dark zone": probably network. One action: hand to the duty officer with the dark-zone flag. Not five door knocks. |
| A phone whose presence heartbeat is gone | Marked unreachable at once (browser transport); on the phone transport, a failed or unanswered Retell call after the retry |
| A resident in Stage 1 | One retry (10 minutes; 30 seconds in the demo). Then the linked contact where one is registered: "Have you heard from your mother? Is she leaving?" (status recorded via linked contact). Then a voicemail that reads the directive, the evacuation point and the callback number. Then SMS with the same text (stretch). |
| A resident in Stage 3 (Order) with access or functional needs | After the retry, a registry row at priority 3, "unreached," on the QRT door-knock list, with the enrolled address as last location (low precision). |
| Several households on one block | The silence cluster (about 300 m, at least three, within five minutes) becomes an `alerts_feed` card: possible tower or power loss, recommend a door-knock team, printable sheet. Correlated silence is a signal handed to a person, not a conclusion. |
| The canary | Ring the second canary. Both silent: "delivery unverified" flag to the authority. Not a stop. |
| The human | If no decision arrives by 0:00, the alert sends on time and the ledger records "sent on timer, no decision." The hand-off escalates to the backup contact after 2 minutes. |
| Reliability | Silence accrues into a per-sentinel reliability score by context; a reliable answerer going quiet means more than a never-answerer. Three silent monthly tests replace a sentinel. |

## 14. The AllFound lane (reunification)

AllFound, from the earlier AllClear + AllFound plan, registers evacuees at shelters even with no internet and calls relatives back the moment their person checks in. The Project Document does not include it, and this PRD keeps it only as a P2 lane (decision D-04): built only if the P0 and P1 demo path is working end to end by Saturday 11:00 AM. It is the natural destination of "leaving to Westchester" and of the teach-back's destination field.

- **Offline intake PWA.** Registers an evacuee (name, birth year, home area, household size, sharing consent) with WiFi off; Offline badge and pending sync count; QR wristband code (the repo already depends on `qrcode`). Append-only events with client-generated IDs; the API ignores IDs it has already seen. No general sync engine.
- **Find my person line.** A Retell inbound agent takes the relative's name, number, relationship and who they are looking for, then calls `search_person(name, birth_year, area)` and `log_inquiry(...)`. No match yet: it logs the inquiry and promises a callback. It never confirms a match during the call.
- **Matcher.** Normalize names (unidecode, lowercase, strip punctuation), compare with a token-set ratio so double surnames and word order still match, require birth year within 2 and the same home area. Score 92 or higher with consent: automatic callback. 75 to 91: volunteer review. Minors never disclosed by phone.
- **Callback.** Retell outbound: "Rosa checked in safe and asked us to tell you she'll call tonight." The shelter is shared only if the evacuee chose location sharing. "Safe" here is the evacuee's own word, relayed; the agent still never declares a zone or an unregistered person safe.
- **Privacy rules.** Message by default, never location; answers only by callback; evacuees can opt out of being findable; uncertain matches go to people; emergencies go to 911; verification phrase against scam calls; synthetic data only.
- **Defense mode.** Noncombatant evacuation (NEO) processing: register evacuees at an austere processing center and track them to a safe haven.

## 15. Architecture

The Project Document's architecture stands: one Next.js App Router app on Vercel, Supabase for data and realtime, Claude as the agent's brain, Leaflet and Turf for the map. This PRD adds Retell AI as the phone-network transport, a zones layer, a registry, feeds, and a handful of tables. The repo's Phase 0 (scaffold, schema, env validation, health check, synthetic seed) is the starting point; everything below is additive.

### Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Web app and API | Next.js 16 (App Router), TypeScript, Tailwind 4, on Vercel | One deploy, public HTTPS from hour one; Retell webhooks and tools are route handlers |
| Data and live updates | Supabase Postgres, Realtime (broadcast, row changes, presence); RLS with anon read, service-role writes from server routes | Board updates in under 2 seconds without polling; the pattern is already in `schema.sql` |
| Agent brain | Claude via the Anthropic SDK: `AGENT_MODEL` claude-haiku-5-5 for in-call turns on the browser transport, `ANALYSIS_MODEL` claude-sonnet-5-5 for the post-call pass and Ask the board | Already wired in `lib/anthropic.ts` and `lib/env.ts` |
| Phone transport | Retell AI: batch outbound with dynamic variables, inbound number, custom functions as HTTPS route handlers with signature verification, webhooks (`call_started`, `call_ended`, `call_analyzed`), post-call analysis fields, one agent per language | Sponsor; real phones ring in the room; the track names Retell voice agents |
| Browser transport | `/phone/[id]` page: ring broadcast, push-to-talk SpeechRecognition, per-language SpeechSynthesis, presence heartbeat, text mode | Fallback with no telephony dependency; the deaf and hard-of-hearing path |
| Map | Leaflet, Leaflet.draw, react-leaflet, Turf.js | Zone polygons, edge distance, point-in-polygon, ring-sweep animation |
| Geocoding | ArcGIS World Geocoding (`findAddressCandidates`), Nominatim fallback | Intersections and landmarks; Nominatim is weak there and rate-limited |
| Hazard data | NWS active alerts API (real polygons), NWS hourly wind, NASA FIRMS area CSV (VIIRS near-real-time), USGS earthquake GeoJSON | Live or seeded inputs for the two models |
| GIS output | GeoJSON route handlers; ArcGIS Online web map and Dashboard; hosted feature layer `applyEdits` (P2); CSV and CAP export | Planners' own tool |
| Zone geometry | data.lacity.org Neighborhood Council boundaries, LA County Places, city boundaries, NWS polygons | Loaded or adopted, rarely drawn |
| Timers | Database deadlines advanced by the board's tick (the `sim_runs` pattern), with Vercel Cron as the backstop | Serverless has no long-lived timers; the hold deadline, retries and Stage 2 all use the same mechanism |

### Data model (additive to `supabase/schema.sql`)

Existing tables stay as they are: `households`, `campaigns`, `calls`, `household_status`, `alerts_feed`, `twist_log`, `sim_runs`. Changes:

| Table | Change |
| --- | --- |
| households (existing) | Add `phone_e164` (volunteer devices only), `role` (resident, sentinel, canary, staff), `channel` (voice, sms, landline, browser), `zone_id`, `on_post`, `reliability`, `last_heard`. `afn_flags`, `memory_note`, `linked_contact_*`, `can_drive_neighbors`, `seats` unchanged. |
| campaigns (existing) | Add `zone_id`, `kind` (checkin, warning, order, all_clear, hold, canary, rollcall, qrt_callback, test), `wave` (1, 2, 3 for the staged calls), `order_rule` (edge_first, risk_first), `started_by`. `stage`, `mode`, `polygon`, `alert_text`, shelter and verification fields unchanged. |
| calls (existing) | Add `transport` (retell, browser), `retell_call_id`, `outcome` (connected, no_answer, voicemail, failed). `messages`, `transcript`, `summary`, `analysis` unchanged. |
| household_status (existing) | Unchanged; the board keeps reading it. |
| zones (new) | id, name, geom (GeoJSON polygon), state, directive_text, move_text, evac_point, fact_sheet, population_est, source (human, model, nws), approved_by, approved_at, version |
| zone_events (new) | id, zone_id, from_state, to_state, source, actor, reason, created_at |
| proposals (new) | id, zone_id, proposed_state, model (fire_envelope, call_pattern), reason, score, status (open, approved, edited, rejected), decided_by, decided_at |
| intents (new) | id, call_id, primary_intent, flags[], needs[], people, location_text, can_leave, understood, confidence, source (in_call, post_call, retell, reconciled), review_needed, created_at |
| help_requests (new) | id, household_id, phone, zone_id, priority, needs[], device_battery_hours, animals, people, status, assigned_to, run_id, source, created_at, updated_at |
| locations (new) | id, household_id, lat, lng, accuracy_m, source (gps_link, stated, enrolled, centroid), stated_text, consent, observed_at |
| holds (new) | id, zone_id, proposed_state, alert_text, polygon, population_est, started_at, deadline, extended_once, tally (yes, no, unsure, silent), decision (send, cancel, hand_off, timer), decided_by, reason, decided_at |
| canaries (new) | id, hold_id, household_id, result (yes, no, silent), observed_at |
| reports (new) | id, type, lat, lng, zone_id, source (call, seeded, inbound), household_id (nullable), created_at |
| clusters (new) | id, h3_cell, zone_id, kind (hazard, help, silence, volume), count, baseline, score, corroborated, status, first_at, last_at |
| ledger (new) | id, actor (human name or "agent"), action, allowed (bool), target, reason, created_at |
| alerts_feed (existing) | New `kind` values: proposal, cluster, dark_zone, canary_result, hand_off |

All timestamps are ISO 8601 UTC (`timestamptz`). Every demo row carries `synthetic = true` except the volunteer devices. New tables get the same RLS policy (anon read, server writes) and join the realtime publication where the board needs them (`zones`, `holds`, `help_requests`, `ledger`).

### API surface (route handlers under `app/api`)

| Route | Purpose |
| --- | --- |
| `POST /api/zones/import`, `GET /api/zones`, `PATCH /api/zones/[id]` | Load GeoJSON or adopt an NWS polygon; read; edit geometry or texts (logged) |
| `POST /api/zones/[id]/approve` | Body: state, directive_text, move_text, evac_point, approved_by, reason, bypass_hold (IC only). Writes `zone_events` and `ledger`; starts the pre-emergency protocol or opens a hold |
| `POST /api/proposals/run`, `POST /api/proposals/[id]/decide` | Run a model; approve, edit or reject with a name and reason |
| `POST /api/campaigns` | Start a wave, roll call, test or QRT callback for a zone; computes edge-first order; creates the Retell batch call with per-call variables, or broadcasts ring events to browser phones |
| `POST /api/holds`, `POST /api/holds/[id]/decision` | Open a hold (selects sentinels, sets the deadline); Send now, Hold once, Edit polygon, Cancel, Hand to authority |
| `POST /api/retell/webhook` | `call_started`, `call_ended`, `call_analyzed`; signature verified; `call_analyzed` runs the post-call pass |
| `POST /api/retell/tools/[name]` | The seven tools for the phone transport; each verifies the Retell signature, validates enums, writes rows, and writes a `ledger` line when refusing |
| `POST /api/agent/turn` | The browser-transport turn loop (Haiku, tools, conversation persistence), the Project Document's item 27 |
| `GET /api/registry`, `PATCH /api/registry/[id]`, `POST /api/registry/[id]/callback` | QRT view, status changes, callback call |
| `GET /api/feeds/[name].geojson`, `GET /api/export.csv`, `GET /api/export.cap`, `POST /api/arcgis/push` | Feeds for ArcGIS; exports; hosted-layer push (P2) |
| `GET /api/ledger`, `GET /api/twists` | The ledger panel; the twist log |
| `POST /api/tick` | Advances deadlines: hold expiry, retries, Stage 2 timers, simulator plans (called by the board and by Vercel Cron) |
| `GET /api/health` | Existing |

### Simulation mode

A `SIMULATED` badge is always on in the demo. The broadcast send writes a `zone_events` row and starts the canary; it reaches no real alert system. Population counts are labeled estimates. Seeded reports and synthetic households are labeled on the map. The simulator presets (`normal`, `tower_down`, `fire_spreading`) gain `mass_no_answer` and `earthquake`. The script says all of this out loud.

### Security basics

Retell signature verification on every webhook and tool call; secrets in environment variables and a shared vault, never in chat or the repo; the service-role key used only in server routes (the repo's existing rule); the feeds exclude phone numbers and names; `phone_e164` stored only for volunteer devices; rate limits on inbound tools; synthetic data only.

## 16. Dual use

| Mode | Decider | Zones | Directive vocabulary | Sentinels | Registry | Everyday use |
| --- | --- | --- | --- | --- | --- | --- |
| City under strain (LA) | Overnight supervisor of the county or city information line; duty officer approves | Neighborhood polygons: Santa Monica, Culver City, Mid-City... or an NWS alert polygon | Cal OES standard: Evacuation Warning, Evacuation Order, Shelter in Place, Lifted | Enrolled residents at polygon edges | Help registry and pickup runs for the QRT | Heat-day and power-shutoff check-ins for opted-in residents; monthly test calls |
| Ordinary Tuesday (USC DPS on stage; senior-living and home-health operators in the business slide) | DPS watch commander before a TrojansAlert; an operations director running daily check-ins | Buildings and quads: Leavey, Doheny, USC Village, Residential West; a facility's floors | Avoid the area, Shelter in Place, All clear; check-in scripts | RAs and officers on post; shift nurses | Students or residents needing assistance | Monthly test call; daily multilingual check-ins that build the memory note; drill accountability |
| Defense (installation) | Command post before a base-wide lockdown | Housing areas, gates, flight line | Lockdown, Shelter in Place, Avoid, All clear | Gate posts, housing phones, duty desks | Personnel accountability in ADPAAS, NFAAS, AFPAAS vocabulary (base mode, item 18); NEO processing for AllFound | Recall drills; monthly test call |

The grounding events for each column are real: Los Angeles, January 9, 2025 (ten million phones for a three-city warning) and the late warnings in west Altadena the day before; Hawaii, January 13, 2018 (a false missile alert, and a two-person rule as the fix); Wright-Patterson AFB, August 2, 2018 (one 911 call during a drill, an hours-long lockdown with about 50 armed responders). Second Key is the two-person rule with the second person at a window.

## 17. Twists

Three twists drop: Friday 11:30 PM, Saturday 4:30 AM, Saturday 7:00 AM, with six hours to respond to each. Adapting to twists is one of the five scored criteria and has its own award (Best Shift Adapter), judged on "what changed, why, and proof it works," with the note that "the best adapters change the build, not just the slides."

**Requirement.** The `/twists` page (backlog item 20, raised to P0) lists, for each twist, the text of the twist, what changed in the build (with commit links), why, and a 20-second proof (a screenshot or a short clip), written to the existing `twist_log` table. P4 owns it and files each response within the window.

**The predictable twists.** The kickoff deck's three tests are the likeliest shapes: who pays on a calm Tuesday; what it does at 3 AM with the network down and the staff gone; whether it works with a tenth of the budget. The table merges the Project Document's readiness list with the new mechanisms, and prepares a build change, not a slide, for each.

| If the twist is... | What changes in the build | Proof |
| --- | --- | --- |
| Cell network overloaded or down | Landline and on-post sentinels ring first; SMS "1 yes / 2 no" fallback; the dark-zone rule; send-on-time default; canary over landline; silence clusters routed to door-knock teams with the printable sheet; browser transport over any WiFi | Mark every sentinel silent: the dark-zone card appears and the alert still sends at 0:00; tower-down preset turns a block purple |
| No human available at 3 AM | Escalation chain on the hand-off (duty officer, then backup, 2 minutes each); the timer sends on time; registry auto-sorted; the only thing that waits for a person is a key | Make no decision: the ledger reads "sent on timer, no decision" |
| A tenth of the budget | Calls capped at 60 s; claude-haiku-5-5 in call, one Sonnet pass per call; SMS for low-risk zones; panel fixed at four sentinels; ArcGIS by GeoJSON URL on the free tier; a live cost counter on screen (Retell minutes times rate, per zone per incident) | The cost counter during the demo |
| Ten times the volume, or a hoax flood | Concurrency caps; call order by risk; clusters trigger Ask, not Send; the panel is fixed-size per zone; the hoax mirror | Seed 200 reports: the panel still makes four calls; the mirror shows reports high, reads zero |
| New language, or deaf and hard-of-hearing residents | Language is a per-household field; text mode on the browser transport; SMS and TTY scripts; Azure-backed Retell agents for Armenian and Tagalog | A live Korean call; a text-mode call |
| Power outage, or medical devices failing | `device_battery_hours` drives registry priority and pickup-run order; a power-shutoff script at the Watch state | Registry re-sorts when a battery-hours value drops |
| New decider (grid dispatcher, hospital ward, harbor watch) | Zones become feeders, wards or berths; directive templates swap; "did you receive this?" fits any broadcast | Swap the zone file and vocabulary in 15 minutes on stage |
| The model is wrong | Proposals need a human; rejections logged; the dose preview catches a wrong polygon; the canary catches a transport failure | Approve a countywide polygon: "wakes 9.8 million," a Long Beach sentinel says "nothing here," Edit polygon |
| Responders want the data in their tools | GeoJSON feeds, the ArcGIS web map and dashboard, CSV and CAP export | Open the ArcGIS map on the second screen |
| Someone searches for a person they should not find | Callback-only answers, consent levels, minors never disclosed, registry visible to QRT only, feeds strip names and phones | Inbound "where is Rosa?" gets "a person will call you back" |
| Scam calls pretending to be official | Verification phrase posted on the official page and read first; the agent never asks for personal or payment data; official callback number | The phrase in every script |
| Earthquake instead of fire | Pattern watch mode; Shelter in Place vocabulary; USGS trigger; post-quake roll call; silence clusters flag damaged blocks; ArcGIS feed | The earthquake beat in section 12 |
| Shelter loses power or internet (AllFound lane) | Intake keeps queuing; print the roster and wristband codes; sync from any hotspot later | Pending sync count drops to zero when WiFi returns |

## 18. Demo and pitch

### Demo, three to three and a half minutes, working thing first

Six volunteer devices, as in the seed: phones 1 and 2 are residents, 3 and 4 are Culver City edge sentinels, 5 is the judge's phone playing a Long Beach sentinel, 6 is the Westchester canary. Phone 1 is also the registered linked contact of a synthetic household.

| Time | On screen | Who |
| --- | --- | --- |
| 0:00 | The map: Santa Monica red, five zones orange or dashed (model proposals), Downtown grey. Say out loud: synthetic roster, six real phones, the send is simulated. | P4 narrates |
| 0:15 | Approve Culver City to Near-Crisis: the dialog shows the Warning text, the route and Westchester as the evacuation point; type a name and a reason. The polygon starts filling from the north-west edge. | P3 drives |
| 0:30 | Phone 1 rings (Spanish): "leaving with the kids to Westchester." Teach-back: "Westchester Recreation Center, by 4:30." Pin turns amber; the Understood counter ticks. | Phone 1 on speaker |
| 0:55 | Phone 2 rings (English): "my husband uses a wheelchair, we have no car, we're at Venice and Sepulveda." Red pin at the intersection; registry row with the number, "wheelchair, no car, 2 people," last seen 10 seconds ago. | Phone 2 on speaker |
| 1:15 | A synthetic household on phone 1's street does not answer; the agent calls phone 1 as the linked contact: "Have you heard from Mr. Hale?" "He's leaving with me." Pin reads Leaving (via linked contact). | Phone 1 |
| 1:35 | The model moves the envelope; the duty officer requests an Order. Hold opens: "wakes 41,000," timer 90 s, four sentinels ringing. | P3 drives |
| 1:50 | The judge holds phone 5 (Long Beach). It rings: "Does this match what you see?" "Nothing here." Tally: 1 no. Click Edit polygon; the preview had read "wakes 9.8 million" on the wrong polygon. | Judge's phone |
| 2:05 | Phones 3 and 4 (Culver City edges): "yes, smoke to the west." Quorum. Send (simulated), name and reason typed. Fifteen seconds later phone 6 (Westchester canary) rings: "did you just receive an evacuation order?" "No." Canary clear. | Phones 3, 4, 6 |
| 2:35 | Stage 3 relay to Culver City: phone 2 hears the Order and says "we can't leave." Row jumps to priority 1 with "Hang up and call 911" logged; Assign creates "Accessible van A: 2 stops." | Phone 2 |
| 2:55 | Simulator: tower-down on the Palms block. Ten pins turn purple; a silence-cluster card appears: possible tower loss, recommend a door-knock team. "Nobody told us the tower went down. The silence told us." | P3 drives |
| 3:10 | Ledger: 2 approvals, 1 send, 5 asked, 2 yes, 1 no, 2 silent, 1 canary clear, 3 refusals ("asked for an ETA," "asked if it was safe to stay," "asked where a neighbor went"). The allowlist printed beside it. | P3 drives |
| 3:25 | Flip to USC DPS mode: the same screen with Leavey Library and RAs on post. One line on base mode. | P4 closes |

If the slot is three minutes, cut the linked-contact beat. Keep one phone on speaker at a time; other calls update the board silently. Record a backup video of this exact path by 5:00 PM Saturday. If Retell fails on stage, the same six devices open the browser phone page and the script does not change.

### Five-minute pitch skeleton (finals format: 0:30 problem, working thing first, twist, next)

1. 0:00 The opening sentence (section 1). One slide: ten million phones, three cities; the west Altadena warnings that came hours late the day before.
2. 0:30 The demo above, live.
3. 3:30 The twist: what changed in the build, why, proof. Thirty seconds.
4. 4:00 Who pays on Tuesday (USC DPS with a monthly test call; senior-living and home-health operators with daily check-ins that build the memory note), who it is for at 3 AM (the supervisor and the QRT), where it goes (the county's alert desk, a hospital, an installation). What is simulated and what is not.
5. 4:40 The weakness, said first: the roster. Five awake, consenting people per zone at 3:40 AM is the whole product, which is why the Tuesday customer is a campus already on shift, and why callers bootstrap the panel in a surge.

**The second sentence of the pitch (the "isn't this just Everbridge" answer).** Everbridge, Genasys and AtHoc send and collect replies; the 911-AI companies answer inbound. None of them hold the send, ask the edge, count the dose, check delivery, or show the supervisor what the machine refused to do. Conversational two-way is a closing gap (Everbridge 360 AI shipped in September 2026), not our moat. The hold, the canary and the ledger are.

## 19. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Retell credits run out or number purchase is blocked | Pool the team's credits; calls under 90 s; the browser transport is the same demo with no telephony |
| Retell cannot reach the tool routes | Vercel gives a public HTTPS URL from the first deploy; test one real call before midnight |
| New number shows "Spam Likely," or phones have Silence Unknown Callers on | Volunteers save the number as a contact tonight; test every phone; register the number with the Free Caller Registry if time |
| Browser speech recognition varies by language and device | Text mode; pick devices that handle Spanish and Korean well; Retell carries the languages the browser cannot |
| Non-English voice quality varies | Test Spanish, Korean, Mandarin before 1 AM; pick the two that sound best for the demo; SMS for Armenian and Tagalog |
| Noise in the hall | One phone on speaker at a time; the others update the board silently |
| Serverless has no long-lived timers | Deadlines in the database advanced by the board's tick and Vercel Cron (the `sim_runs` pattern); the hold's "sends at 0:00" is enforced server-side on the next tick, within 5 s |
| Classifier mislabels a need | Fixed enums plus a confirm-back turn in the call; the post-call pass is the second layer, not the first; gold set of 20 run every few hours; "needs help now" always surfaces |
| Geocoding fails on a stated location | ArcGIS geocoder first, Nominatim second, enrolled address third, zone centroid flagged low precision |
| ArcGIS layer does not refresh or blocks the URL (CORS, token) | Permissive CORS on the feed routes; token as a query parameter; test the GeoJSON-by-URL path by 8 AM; CSV export as the fallback |
| Model proposes the wrong zone | Proposals are advisory, drawn dashed, need a name and a reason; rejections logged; the demo includes rejecting one |
| The 90-second hold costs time on a fast fire | The hold applies to warnings and corrections; orders the incident commander requests bypass it, and the bypass is logged |
| Relaying "leave" to the wrong people | The directive belongs to a zone a named human approved; `lookup_zone` for people who are elsewhere; no zone, no instruction |
| Roster cold start | Admit it first; the Tuesday customer's roster is already on shift; callers bootstrap the panel in a surge, labeled non-independent |
| Scope: zones, Retell and the registry on top of a 45-item backlog | The merged backlog below marks what moves to P0 and what waits; AllFound is P2 behind a hard gate |
| The 80% metric sounds odd with synthetic rows | Count real phones only; label simulated rows on screen and out loud |
| A judge asks "who sits inside IPAWS?" | Nobody at this table; the send is simulated; the hand-off card is what goes to the real desk |

## 20. Privacy, safety and legal

- **TCPA.** Under the FCC's February 2024 ruling, AI-generated voices count as "artificial voice" under the Telephone Consumer Protection Act; calls made for emergency purposes are exempt. Everyday uses (test calls, heat-day check-ins) are opt-in with a recorded consent.
- **Consent and minimization.** The roster stores name, language, channel, zone, access and functional needs flags and a memory note; the registry stores needs as enums and a last location with a consent flag; no diagnoses, no free text about health beyond the memory note the resident volunteered. Registry rows are purged 72 hours after a human closes the incident.
- **Who can see what.** The registry is visible to the QRT view; the feeds to ArcGIS carry no names or phones; the agent never reads another person's location to a caller.
- **Agent safety rules (the Project Document's, amended).** Never tells anyone in danger to wait; medical emergencies are told to call 911. Never says anything a human did not approve for that zone, and never asks anyone to move toward a hazard. Never pressures someone who refuses to leave; offers a person instead. States only official facts; says "I don't know" otherwise. Confirms every status back before recording it.
- **Scam resistance.** Verification phrase in every script; never ask for personal or payment data; official callback number.
- **Synthetic data.** Every row is synthetic except the volunteer devices, labeled on screen and said out loud.

**Responsible-use note for Devpost (two lines).**

> Misuse: a wrong or compromised zone directive would be relayed to everyone in it, a colluding sentinel panel could delay a real warning, and the registry is a list of real people at real locations. Limits: the agent reads only the directive a named human approved for the zone the phone is in and can change nothing else; the hold is capped at two minutes and never blocks a send; every refusal and every human decision is in a ledger; the registry stores phone, zone, needs and last location, is visible only to the response team, and is purged 72 hours after the incident closes.

## 21. Scope and build plan

### The merged backlog

The Project Document's 45 items keep their numbers. Priorities are the Project Document's unless a change is noted. New items start at 46.

| # | Item | Priority | Change |
| --- | --- | --- | --- |
| 1 | Next.js App Router + TS + Tailwind scaffold, Vercel deploy, env wiring | P0 | Done (Phase 0) |
| 2 | Supabase schema + migrations | P0 | Done; migration 002 is item 46 |
| 3 | Realtime layer: ring broadcast, row changes, presence | P0 | Add `zones`, `holds`, `help_requests`, `ledger` to the publication |
| 4 | Synthetic roster seeder | P0 | Done; `westside` preset is item 71 |
| 5 | /demo page: reset, presets, simulated events | P0 | Add `mass_no_answer` and `earthquake` presets |
| 6 | Concurrency-limited call dispatch queue, risk-ordered | P1 to P0 | Edge-first ordering (item 50) lives here |
| 7 | Leaflet map with draw-polygon zone picker and pins | P0 | Zones layer with state colors (item 49) |
| 8 | NWS active-alerts fetch, adopt as zone | P1 | Adopts into a `zones` row |
| 9 | Turf point-in-polygon selection | P0 | Also assigns `zone_id` to households |
| 10 | Campaign create form | P0 | Becomes the zone approve dialog (state, directive, move text, evacuation point, name, reason) |
| 11 | Notify-zone action | P0 | Becomes "approve zone, protocol starts" (item 48) |
| 12 | Live roll-call board | P0 | Unchanged |
| 13 | Needs-help queue | P0 | Becomes the help registry (item 60): cross-campaign, priority, last seen |
| 14 | Pickup-run panel | P1 | Built from registry rows |
| 15 | Silence-cluster cards plus door-knock sheet | P1 | Unchanged |
| 16 | Hazard layer with direction arrows | P1 | Feeds pattern watch |
| 17 | Ask the board | P2 | Unchanged |
| 18 | Base mode toggle | P1 | Unchanged |
| 19 | CSV and CAP export | P2 | Unchanged; GeoJSON feeds are item 63 |
| 20 | Twist log page | P1 to P0 | Scored criterion and its own award |
| 21 | /phone/[id] route | P0 | Now the fallback transport |
| 22 | Push-to-talk SpeechRecognition | P0 | Unchanged |
| 23 | SpeechSynthesis playback | P0 | Unchanged |
| 24 | Text mode | P1 | Unchanged |
| 25 | Presence heartbeat | P0 | Unchanged |
| 26 | Verification phrase and callback number opening | P1 to P0 | In every script |
| 27 | Agent endpoint: Haiku turn loop, tool execution | P0 | Unchanged |
| 28 | Stage- and language-specific prompts | P0 | Add the directive-relay rule and the zone variables |
| 29 | Four tools | P0 | Plus three new tools (item 52) |
| 30 | Confirm-back turn | P0 | Unchanged |
| 31 | Teach-back, understood flag | P0 | Unchanged |
| 32 | Ready Check at warning stage | P1 to P0 | Is Stage 1 (item 51) |
| 33 | Household memory note | P1 | Unchanged |
| 34 | Post-call Sonnet pass | P1 to P0 | Is the intent pipeline (item 59) |
| 35 | Calm mode | P1 | Unchanged |
| 36 | Hard safety rules | P0 | Amended (section 20) |
| 37 | Hazard question only to safe or leaving residents | P1 | Unchanged |
| 38 | No-answer retry, linked-contact script | P1 | Unchanged; part of the silence rules |
| 39 | Neighbor matching | P2 | Unchanged |
| 40 | Silence clustering | P1 | Also writes `clusters` rows |
| 41 | Pickup-run builder | P1 | Reads `help_requests` |
| 42 | Hazard clustering | P2 | Part of pattern watch (item 62) |
| 43 | Metrics service | P1 | Add hold-to-read, call-to-registry, canary times |
| 44 | Simulator presets | P0 | Unchanged |
| 45 | Scripted test harness | P1 | Gold set of 20 covers intents |
| 46 | Migration 002: new tables and columns (section 15) | P0 | New, P1 |
| 47 | Zone import (GeoJSON), Westside and Altadena zone sets | P0 | New, P1 and P4 |
| 48 | Zone approve route and dialog with ledger write | P0 | New, P1 and P3 |
| 49 | Zones layer: state colors, dashed proposals, approve or reject | P0 | New, P3 |
| 50 | Edge-first ordering and ring-sweep animation | P0 | New, P1 and P3 |
| 51 | Staged waves 1, 2, 3 with database deadlines and `/api/tick` | P0 for waves 1 and 3, P1 for wave 2 | New, P1 |
| 52 | Retell transport: account, number, EN and ES agents, prompts mirroring item 28, seven tools as routes with signature verification, webhook route, batch-call client | P0 | New, P2 |
| 53 | Retell post-call analysis fields and `call_analyzed` into the intent pipeline | P0 | New, P2 |
| 54 | `lookup_zone`: geocode, point-in-polygon, approved directive | P1 | New, P1 |
| 55 | Hold: sentinel selection at polygon extremes, parallel ring, tally, deadline, five decision buttons, send-on-timer, dark-zone rule | P0 | New, P1 and P3 |
| 56 | Dose preview: population estimate per polygon | P0 | New, P4 and P1 |
| 57 | Canary call after send, `received_alert`, result card | P0 | New, P2 |
| 58 | Ledger table and panel; allowlist printed on screen | P0 | New, P3 |
| 59 | Intent pipeline: strict-schema post-call pass, `intents`, reconciliation, review queue | P0 | New, P2 |
| 60 | Help registry: `help_requests`, `locations`, QRT view, last-seen precedence, export | P0 | New, P1 and P3 |
| 61 | Stated-location geocoding with consent; SMS location link | P1; link P2 | New, P1 |
| 62 | Pattern watch: `reports`, hex bins, cluster rules, hoax mirror, proposals | P1 | New, P1 |
| 63 | GeoJSON feeds with CORS; ArcGIS Online web map and Dashboard | P1 | New, P1 and P4 |
| 64 | ArcGIS hosted layer push (`applyEdits`) | P2 | New, P1 |
| 65 | Fire envelope model: seeded perimeter plus NWS wind, 1/3/6 h ellipses, proposals | P1 | New, P1 |
| 66 | Earthquake mode: USGS trigger, Shelter in Place vocabulary, seeded reports, preset | P1 | New, P1 and P4 |
| 67 | USC DPS mode: campus zone file, vocabulary, roster skin | P1 | New, P4 and P3 |
| 68 | Cost counter | P1 | New, P3 |
| 69 | Monthly test call (`checkin` kind) and reliability score | P2 | New, P2 |
| 70 | AllFound lane | P2, gate 11:00 AM | From the earlier plan |
| 71 | Westside seed preset: households across Culver City and Palms, devices at the edges | P0 | New, P4 |

### Cut line

If by Saturday 4:30 AM the path "approve zone, wave 1 call, intent, registry row with location" is not live end to end on either transport, drop items 62 to 66 and 70 and finish 55 to 58 (the hold, the dose preview, the canary, the ledger) and wave 3. If by 11:00 AM the hold and canary are not demoable, 70 is out entirely and 63 ships as CSV only.

### Timeline for four people, keyed to backlog numbers

Now Friday 10:45 PM; team lock extended to 11:59 PM. Freeze Saturday 7:00 PM; Devpost submitted by 9:00 PM. Sleep shift A (P1, P4) 1:00 to 4:15 AM; shift B (P2, P3) 4:45 to 8:00 AM; P4 awake for every twist drop.

| Phase | P1 Backend and data | P2 AI, Retell, classifier | P3 Frontend and demo | P4 Product, twists, pitch |
| --- | --- | --- | --- | --- |
| Skeleton (10:45 PM to 12:00 AM) | 46, 47; Vercel deploy green | 52: account, number, EN agent, one real call to a teammate's phone hitting the tool route | 49 shell on top of 7 and 9; approve dialog shell (10) | Lock the team; 71 (Westside seed); directive texts per zone; volunteers save the number; Twist 1 at 11:30 |
| Core 1 (12:00 to 4:30 AM) | 48, 6 and 50, 51 wave 1, 60 tables and routes, 61 (sleep 1:00 to 4:15; P2 covers) | 27 to 31, 36; 52 ES agent and tools; 53 and 59; gold set | 3, 12, 13 as registry (60), 58 ledger panel, ring sweep (50) | Twist 1 response by 2:00; `/twists` (20); wave 1 to 3 scripts in EN and ES; demo script v1 (sleep 1:00 to 4:15) |
| Core 2 (4:30 to 8:00 AM) | 55, 56, 57 server side; 51 waves 2 and 3; 38; 63 feeds | Handoff at 4:30; sleep 4:45 to 8:00 | Handoff at 4:30; sleep 4:45 to 8:00 | Twist 2 plan by 5:00; Twist 1 proof filed; population numbers (56); USC zone file (67) |
| Feature complete (8:00 AM to 1:00 PM) | 62, 65, 66, 54, 8, 40 and 41, 43 | 52 Korean or Mandarin agent; 33, 35, 37; classifier accuracy pass; 10:30 Retell session | 55 hold strip UI, 57 canary card, 49 proposals, 14, 15, 16, 18, 24, 26, 67, 68; 70 only if the gate passes | Twist 2 by 10:30, Twist 3 by 1:00; 9:00 mentor desk; Devpost draft; ask three attendees about their last emergency alert |
| Harden and rehearse (1:00 to 7:00 PM) | Twenty concurrent calls; error states; feed tokens; 19 | 45 gold set run; ten scripted calls across three languages; fix the worst three | 44 presets on the judge path; polish; backup video by 5:00 PM | Pitch v1 at five minutes; two timed rehearsals; responsible-use note; screenshots |
| Freeze and ship (7:00 to 10:00 PM) | Code freeze 7:00 PM; README with setup and architecture | Write up every sponsor tool used and how | Final demo video; Devpost media | Submit Devpost by 9:00 PM; two more rehearsals |

Check-ins (10 minutes each): 12:00 AM, 1:00 AM, 4:30 AM handoff, 8:00 AM, 12:00 PM, 4:00 PM, 7:00 PM freeze.

### Before midnight tonight

- [ ] Team locked in the portal with Resilience Comms as the track.
- [ ] One real Retell call to a teammate's phone reaches a deployed tool route; one browser-phone call reaches the agent endpoint.
- [ ] Volunteers save the Retell number as a contact and turn off Silence Unknown Callers.
- [ ] Migration 002 applied; seven Westside zone polygons load on the map with the right colors.
- [ ] Directive texts for every zone approved by the team in the Cal OES vocabulary.
- [ ] Twist 1 read at 11:30 PM and mapped against the table in section 17.

## 22. Open decisions

Each is logged with a recommendation in `decisions.md`: the name (D-01); directive relay (D-02, decided here); AllFound as P2 (D-04); the transport split and whether to attempt Retell's custom-LLM path (D-05); the demo geography (D-06); the Tuesday customer on stage (D-07); who holds the six phones (D-14); which two non-English languages go on stage (D-15); whether the ArcGIS beat is in the live demo or only in the twist response (D-16); whether to use real NWS wind or seeded wind in the model (D-17).

## 23. Sources

- Team: AllClear Project Document (Oct 16, 2026, @Madhu), Google Doc 1C0s-RdMa22j8LdwSIOYXg0hVx9Yj5Y7nGbshRTun7s4
- Team: repo `madhulikavikraman/Dual_Use_Hackathon`, Phase 0 commit `6ce4472` (Next.js skeleton, Supabase schema, env validation, health check, synthetic seed): https://github.com/madhulikavikraman/Dual_Use_Hackathon
- Team: `AllClear + AllFound PRD and Build Plan.md` and `AllClear vs Relay Feedback.md` in `D:\LAtw`
- Participant Hub (problem statement, tracks, twist schedule, judging): Google Doc 1a6SQQuvQJoI5g6YQUjzOVkruyOI94UwS-c1Wbrz-dsY
- Kickoff deck (the three tests): Google Slides 1OfEJ04CogX7IIZfFd0Ne7B1Un-zJ9Wm7ogd-Vr89yDk
- Rep. Robert Garcia, "Sounding the Alarm" oversight report on the Kenneth Fire false alerts (May 12, 2025): https://robertgarcia.house.gov/media/press-releases/congressman-robert-garcia-releases-oversight-report-lessons-kenneth-fire-false
- CBS News, Genasys on the incorrect evacuation alert and added safeguards: https://www.cbsnews.com/amp/news/los-angeles-wildfires-evacuation-alerts-genasys
- Santa Monica Daily Press, officials move evacuation notification to the State system after the false alerts: https://www.smdp.com/after-false-alerts-panic-millions-officials-move-to-state-system-for-evacuation-notification/
- US News (AP), September 2025 review of the county's fire response and alert process: https://www.usnews.com/news/us/articles/2025-09-25/la-county-response-to-deadly-fires-slowed-by-lack-of-resources-outdated-alert-process-report-says
- Fire Engineering, review of the delayed west Altadena evacuation notices: https://www.fireengineering.com/firefighting/wildland-firefighting/eaton-fire-no-misconduct-delay-in-evacuation-notices-to-west-altadena-ca-report-says/
- AP via Bangor Daily News, California investigation into the delayed Eaton fire orders (Feb 2026): https://www.bangordailynews.com/2026/02/12/nation/california-announces-investigation-into-delayed-evacuation-orders-during-la-area-wildfire/
- U.S. Census QuickFacts, Los Angeles County, language other than English at home: https://www.census.gov/quickfacts/fact/csv/losangelescountycalifornia/POP815224
- Cal OES standardized evacuation terminology (May 2020): https://www.malibucity.org/DocumentCenter/View/26770/05_28_2020_CALOES_EvacuationTerminology_PressRelease and https://www.calalerts.org/evacuations.html
- Dayton Daily News, Wright-Patterson false active-shooter timeline (Aug 2, 2018): https://daytondailynews.com/news/local/timeline-how-the-chaotic-active-shooter-response-unfolded-wright-patt/8WRXac0skFXSKz5chyjvSM
- USC Department of Public Safety, TrojansAlert: https://dps.usc.edu/services/trojans-alerts/
- Retell AI docs: batch calls https://docs.retellai.com/api-references/create-batch-call ; post-call analysis https://docs.retellai.com/features/post-call-analysis-overview ; language support https://docs.retellai.com/build/language-support
- NASA FIRMS API (area CSV endpoint, MAP_KEY): https://firms.modaps.eosdis.nasa.gov/api/ and the Microsoft connector reference https://learn.microsoft.com/en-us/connectors/nasafirms
- ArcGIS Online auto-updating CSV and GeoJSON layers by URL: https://www.esri.com/arcgis-blog/products/arcgis-online/mapping/auto-update-csv-geojson-georss
- ArcGIS Location Platform (free tier, data hosting): https://location.arcgis.com/help ; editing features with ArcGIS REST JS: https://developers.arcgis.com/arcgis-rest-js/layers/edit-feature-data/
- LA City Neighborhood Council boundaries (data.lacity.org, shapefile export): https://catalog.data.gov/dataset/neighborhood-councils-certified
- Everbridge 360 AI launch (September 2026): https://www.01net.it/everbridge-introduces-everbridge-360-ai-the-next-evolution-of-high-velocity-critical-event-management/
- TechCrunch on Aurelian and Hyper (AI for non-emergency 911 lines): https://techcrunch.com/2025/08/27/911-centers-are-so-understaffed-theyre-turning-to-ai-to-answer-calls
- Team artifacts: Dual-Use Hackathon Playbook https://claude.ai/artifact/3txjATakZSs46gNZJ7qdz4 ; AllClear Build Brief https://claude.ai/artifact/Kyc2ezMCKm4ZFaRTqPWwKC ; Ask Before the Bang (ideation verdict) https://claude.ai/artifact/NCv2eemdrGMGJEbMQePYYK
