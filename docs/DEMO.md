# Demo runbook: VoiceFlare

The 3.5-minute demo (PRD section 18), how to set it up, and what to do when something fails.

**Say it once, plainly:** the residents are synthetic except the six volunteer phones, and nothing reaches a real
alert system.

## Before the room (30 minutes)

1. **Run the production build** on the demo laptop (faster than `next dev`, no hot reload surprises):
   ```bash
   npm install
   npm run build
   npm start            # http://localhost:3000
   ```
2. **Give the phones an HTTPS address.** Phone browsers allow the microphone and GPS only on HTTPS pages, so the
   volunteers' phones must use a tunnel, not the laptop's Wi-Fi IP:
   ```bash
   npx cloudflared tunnel --url http://localhost:3000
   ```
   Copy the `https://….trycloudflare.com` URL into `APP_BASE_URL` in `.env.local`. With Retell, re-run
   `npx tsx scripts/retell-setup.ts --update` so its webhooks point at the new URL. Keep the URL private: anyone
   with it can open the board.
3. **Load the scenario:** `npm run seed` (Westside Fire). The reset also warms up the agent so the first call is quick.
4. **Phones:** open `/phones` on the laptop. Each volunteer scans their QR code (Phone 1 to Phone 6), taps
   **Tap to enable sound**, and keeps the page open with the screen on. `/phones` shows each phone as online.
   - Phone 1: resident, Spanish (Lucía). Phone 2: resident, English (Janet, husband in a wheelchair). Phone 2 will
     be asked to share her live location: she says yes and taps **Share** on the card that appears.
   - Phones 3 and 4: Culver City edge sentinels. Phone 5: the judge (a Long Beach sentinel). Phone 6: the
     Westchester canary.
   - If a phone has no microphone permission, switch it to **Text mode**: the call works the same.
5. **Second screen (optional):** `/evidence` (Twist 1), `/global` (Twist 2), or the ArcGIS web map from
   `docs/ARCGIS.md`.
6. **Deck:** open `ppt/voiceflare_pitch.html` in Chrome. **F** fullscreen, **N** speaker notes (with a target time
   per slide; **T** restarts the clock), arrow keys or Space to move. 13 slides, 3 minutes; slide 8 is the demo.

## The board

The supervisor's board (`/board`) has a left sidebar: the logo, the scenario switch, one item per view, and the live
numbers (calls, reached, understood, needs help, human decisions, refusals, cost estimate, phones online).

| View | What it holds |
| --- | --- |
| 🗺️ Map | The map, the zones, the hold strip, and the zone detail with its block plan |
| 📞 Calls | Live calls, waves and recent outcomes |
| 🆘 Help | Everyone who asked for a person: the registry, live GPS, Send helper, pickup runs |
| 📜 Ledger | Every human decision and every refusal |
| 📰 Feed | Everything the system noticed |
| 💬 Ask | Ask the board a question |

The sidebar folds to an icon rail; on a phone it opens as a drawer.

## Opening at the booth (60 seconds, before the run)

1. The landing page (`/`) is the first screen a judge sees: the live Norte Fire strip (CAL FIRE status), the headline,
   the hold replay, then **the dual-use section**: the fire night and an ordinary hot Tuesday side by side, rung by
   rung, with the rules that never change. Point at it when someone asks "what is the dual use?"
2. **The guided tour** (`/board?tour=1`, or the Tour button) walks through each part of the board in about a minute.
   Use it for newcomers; skip it for the timed run.
3. **Booth loop:** `/board?autoplay=1` (or **Play the full fire** on the board) plays the whole run on the real board
   with captions, about four minutes; press **Replay** at the end to loop it. It needs no volunteers.
4. Live option: on `/demo`, reset **Norte Fire, San Clemente (live)**. The feed shows the live CAL FIRE status and NWS
   alerts for the real fire. Approve a Warning for Talega: calls ring out edge-first with the Cal OES warning and 911.
   Say that zone states and residents are demo data, and that real orders come from OCFA.
5. Twist 2 on a second screen: `/global` (the six adapters), then **Load the Chongqing scenario**. The flood page
   (`/global/flood`) is being built as a second Twist 2 screen; use it only if it is live.

## The run (supervisor at `/board`, narrator beside the screen)

| Time | Action on /board | What the room sees |
| --- | --- | --- |
| 0:00 | Nothing. Say: synthetic residents except six volunteer phones; nothing reaches a real alert system. | Santa Monica red (Order) with its blocks already leaving in waves; Venice orange; Culver City and West LA dashed (model proposals) |
| 0:15 | Culver City → **Approve** the proposal (or Change state → Near-Crisis). Name, reason, check the Warning text, route, Westchester. | Pins light up from the north-west edge, five at a time |
| 0:30 | Phone 1 rings (Spanish): "leaving with the kids to Westchester." Teach-back. | Pin turns amber; Understood ticks |
| 0:55 | Phone 2 rings: "my husband uses a wheelchair, we have no car, we're at Venice and Sepulveda." She says yes to the live-location link and taps **Share**. | Registry row at the stated corner, then a Live GPS pin and badge |
| 1:15 | Walter Hale does not answer twice; Phone 1 is called as his linked contact. | Pin reads Leaving (via linked contact). No answer is never safe |
| 1:35 | On `/demo`, switch **Wrong polygon** on. Then Culver City → **Compose Order (opens hold)**. | Hold strip: "wakes about 9.8 million", 90 s countdown, sentinels ringing |
| 1:50 | The judge's Phone 5 rings: "nothing here." Click **Edit polygon** (name, reason). | Tally shows 1 no; dose drops to about 41,000, with wave 1's people and blocks |
| 2:05 | Phones 3 and 4: "yes, smoke to the west." Quorum. **Send now** (name, reason). | Canary 15 s later: Phone 6 "did you just receive an evacuation order?" → "No" → canary clear |
| 2:20 | Map → Culver City's block plan → **Approve plan**. | Blocks nearest the fire go now, each on its own road; later blocks hear "get ready" and "leave right away if you feel unsafe". **Everyone go now** stays one click |
| 2:35 | Stage 3 relays the Order; Phone 2 says "we can't leave." Help → **Send helper** to her exact spot (name, reason); **Build pickup runs**. | Row at priority 1; the helper's link shows her live location; "Accessible van A: 2 stops" |
| 2:55 | On `/demo`: **Tower down**. | Ten pins go silent; card: possible tower loss, recommend a door-knock team |
| 3:10 | Open the **Ledger** view. | Approvals, the send, the block plan, the helper, sentinel reads, refusals ("asked for an ETA") beside the allowlist |
| 3:25 | Sidebar **Scenario** → **Heat wave: senior check-ins** (confirm). | The same board on an ordinary hot Tuesday: six Valley zones by live temperature and NWS alerts (a labeled demo heat wave when it is mild), older residents who opted in |

The wrong-polygon switch is one-shot: it applies to the next hold only.

**No volunteers?** Run `/board?autoplay=1` instead and narrate the captions, or on `/demo` turn on
**Autopilot devices** so the simulator answers for the six phones. Autoplay signs its decisions as a stand-in
supervisor, and the board never counts them as human decisions. Switch to the heat scenario by hand at the end.

## When something fails

| Problem | Do this |
| --- | --- |
| A phone does not ring | Check `/phones` shows it online; reload the phone page and tap **Tap to enable sound**. The call rings for 25 s, then retries once 30 s later. |
| Speech recognition fails | Text mode on that phone. |
| The Share card does not appear | Phone 2 must say a clear yes; the agent asks once. Carry on: the stated corner is already on the map. |
| Retell call fails | It falls back to the browser phone automatically (a "transport" card says so). |
| The agent is slow on the first call | It warms up after each reset; run `npm run seed` again a minute before the demo. |
| No volunteers | `/board?autoplay=1`, or Autopilot on `/demo`; narrate the phone lines from the call strip. |
| Anything stuck | `npm run seed` resets the run in a second (the twist log is kept). |

## After the demo

- `/evidence` shows the Phase I milestones measured from the run you just did (Twist 1).
- `/twists` shows each twist with its build change and commits.
