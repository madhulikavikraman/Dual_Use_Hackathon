# Demo runbook: Second Key

The 3.5-minute demo (PRD section 18), how to set it up, and what to do when something fails.

## Before the room (30 minutes)

1. **Run the production build** on the demo laptop (faster than `next dev`, no hot reload surprises):
   ```bash
   npm install
   npm run build
   npm start            # http://localhost:3000
   ```
2. **Give the phones an HTTPS address.** Phone browsers allow the microphone only on HTTPS pages, so the
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
   - Phone 1: resident, Spanish (Lucía). Phone 2: resident, English (Janet, husband in a wheelchair).
   - Phones 3 and 4: Culver City edge sentinels. Phone 5: the judge (a Long Beach sentinel). Phone 6: the
     Westchester canary.
   - If a phone has no microphone permission, switch it to **Text mode**: the call works the same.
5. **Second screen (optional):** `/evidence` (Twist 1) or the ArcGIS web map from `docs/ARCGIS.md`.
6. **Rehearsal without volunteers:** on `/demo`, turn on **Autopilot**: the simulator answers for all six phones.
   Turn it off before the real run.

## The run (supervisor at `/board`, narrator beside the screen)

| Time | Action on /board | What the room sees |
| --- | --- | --- |
| 0:00 | Nothing. Say: synthetic roster, six real phones, every send is simulated. | Santa Monica red, Venice orange, Culver City and West LA dashed (model proposals) |
| 0:15 | Culver City → **Approve** the proposal (or Change state → Near-Crisis). Name, reason, check the Warning text, route, Westchester. | Pins light up from the north-west edge, five at a time |
| 0:30 | Phone 1 rings (Spanish): "leaving with the kids to Westchester." Teach-back. | Pin turns amber; Understood ticks |
| 0:55 | Phone 2 rings: "my husband uses a wheelchair, we have no car, we're at Venice and Sepulveda." | Red/orange pin at the intersection; registry row with the stated location |
| 1:15 | Walter Hale does not answer twice; Phone 1 is called as his linked contact. | Pin reads Leaving (via linked contact) |
| 1:35 | On `/demo`, switch **Wrong polygon** on. Then Culver City → **Compose Order (opens hold)**. | Hold strip: "wakes about 9.8 million", 90 s countdown, sentinels ringing |
| 1:50 | The judge's Phone 5 rings: "nothing here." Click **Edit polygon** (name, reason). | Tally shows 1 no; dose drops to about 41,000 |
| 2:05 | Phones 3 and 4: "yes, smoke to the west." Quorum. **Send now** (name, reason). | Canary 15 s later: Phone 6 "did you just receive an evacuation order?" → "No" → canary clear |
| 2:35 | Stage 3 relays the Order; Phone 2 says "we can't leave." **Build pickup runs**. | Row jumps to priority 1; "Accessible van A: 2 stops" |
| 2:55 | On `/demo`: **Tower down**. | Ten pins go silent; card: possible tower loss, recommend a door-knock team |
| 3:10 | Open the **Ledger** tab. | Approvals, the send, sentinel reads, refusals ("asked for an ETA") beside the allowlist |
| 3:25 | Header **Scenario** → USC DPS (confirm). | The same screen: Leavey Library, RAs and officers on post |

The wrong-polygon switch is one-shot: it applies to the next hold only.

## When something fails

| Problem | Do this |
| --- | --- |
| A phone does not ring | Check `/phones` shows it online; reload the phone page and tap **Tap to enable sound**. The call rings for 25 s, then retries once 30 s later. |
| Speech recognition fails | Text mode on that phone. |
| Retell call fails | It falls back to the browser phone automatically (a "transport" card says so). |
| The agent is slow on the first call | It warms up after each reset; run `npm run seed` again a minute before the demo. |
| No volunteers | Autopilot on `/demo`; narrate the phone lines from the call strip. |
| Anything stuck | `npm run seed` resets the run in a second (the twist log is kept). |

## After the demo

- `/evidence` shows the Phase I milestones measured from the run you just did (Twist 1).
- `/twists` shows each twist with its build change and commits.
