# Retell AI and the browser phone

VoiceFlare has two transports and one agent contract (PRD section 8, decision D-05):

| | Phone network (Retell) | Browser phone (`/phone/[id]`) |
| --- | --- | --- |
| In-call brain | Retell LLM `claude-5.5-haiku` | Claude Haiku on our server (`AGENT_MODEL`) |
| Prompt | `lib/agent/prompt.ts` template with `{{placeholders}}` | same template, rendered |
| Tools | the seven tools as Retell custom functions -> `POST /api/retell/tools/<name>` | the same seven tools, called in-process |
| Hang-up | our `end_call` records the outcome, then Retell's built-in `hang_up` disconnects | `end_call` ends the call |
| Events | `POST /api/retell/webhook` (`call_started`, `call_ended`, `call_analyzed`) | the page polls `GET /api/phone/[id]` |
| Inbound | `POST /api/retell/inbound` (per-number inbound webhook) | `/call` (pick a language) |

If Retell fails on stage, the same six devices open their browser phone pages and the script does not change.

Files: `lib/retell/client.ts` (place and stop calls), `lib/retell/verify.ts` (signatures), `lib/retell/payload.ts`
(parsing), `lib/retell/guard.ts` (route plumbing), `lib/retell/config.ts` (what the setup script creates),
`app/api/retell/**`, `scripts/retell-setup.ts`, `components/phone/**`, `app/phone/[id]`, `app/phones`, `app/call`.

## Setup, in order

1. **Account and key.** In the Retell dashboard (dashboard.retellai.com), API Keys tab: copy the key that has the
   **webhook badge**. Only that key verifies webhook and function signatures. Put it in `.env.local` as
   `RETELL_API_KEY=...`.
2. **Buy a number.** Phone Numbers -> Buy a number (US). Retell-purchased numbers can call US numbers only.
   Add `RETELL_FROM_NUMBER=+1XXXXXXXXXX` (E.164).
3. **Expose the dev server over HTTPS.** Retell blocks localhost and private IPs, and phones need HTTPS for the
   microphone and keep-awake:
   ```
   npx cloudflared tunnel --url http://localhost:3000
   ```
   Copy the `https://<name>.trycloudflare.com` URL into `APP_BASE_URL`. The Next dev server blocks dev assets for
   other hostnames, so `next.config.ts` needs `allowedDevOrigins: ["*.trycloudflare.com"]` (add `"*.ngrok-free.app"`
   if you use ngrok). Restart `npm run dev` after any `.env.local` change.
4. **Create the Retell side.** Review first, then create:
   ```
   npx tsx scripts/retell-setup.ts --dry-run
   npx tsx scripts/retell-setup.ts
   ```
   It creates one Retell LLM (shared prompt, seven custom functions plus `hang_up`), one agent per language
   (EN en-US, ES es-419, KO ko-KR, ZH zh-CN, HI hi-IN, FR fr-FR), and binds `RETELL_FROM_NUMBER` (English agent
   inbound and outbound, inbound webhook `${APP_BASE_URL}/api/retell/inbound`). Voices are picked from
   `GET /list-voices` by accent; override any with `RETELL_VOICE_EN` ... `RETELL_VOICE_FR`.
5. **Paste the printed lines** (`RETELL_LLM_ID=...`, `RETELL_AGENT_ID_EN=...` ... `RETELL_AGENT_ID_FR=...`) into
   `.env.local` and restart the dev server.
6. **Volunteers' numbers.** `DEVICE_PHONE_1` ... `DEVICE_PHONE_6` (E.164) for the six demo devices, then reset the
   scenario so the device households pick them up:
   ```
   curl -s -X POST localhost:3000/api/demo/reset -H 'content-type: application/json' -d '{"scenario":"westside"}'
   ```
7. **Check.** `GET /api/board` shows `"retell": true`. `/phones` shows the device sheet; open it from the tunnel URL
   so the QR codes point there.

**When the tunnel URL changes** (every `cloudflared` restart): set the new `APP_BASE_URL`, then
`npx tsx scripts/retell-setup.ts --update` patches the LLM tool URLs, the agents' webhook URLs and the number's
inbound webhook in place (it reuses `RETELL_LLM_ID` and `RETELL_AGENT_ID_*`).

## Spam label and silenced phones (decision D-23)

- [ ] Every volunteer saves the Retell number as a contact ("VoiceFlare demo line") tonight.
- [ ] iPhone: Settings -> Apps -> Phone -> Silence Unknown Callers **off** (and any Focus mode off). Android: Phone app
      -> Settings -> Caller ID & spam -> "Filter spam calls" off for the demo.
- [ ] Test-call every phone once from the number before the demo; fix any that show "Spam Likely" or go to voicemail.
- [ ] Register the number with the Free Caller Registry (freecallerregistry.com) if time allows.
- [ ] Keep calls under 90 seconds and do not burst-dial from a fresh number (carriers score bursts as spam).
- [ ] Volume up, ringer on, phones charged; one phone on speaker at a time.

## Test one call

**Inbound (fastest end-to-end check).** Call `RETELL_FROM_NUMBER` from any phone. The inbound webhook registers the
call (`startInboundCall`), returns the caller's variables and `metadata.call_id`; the agent greets with the
verification phrase, asks where you are, calls `lookup_zone` and reads the approved directive. The board shows the
call; after hang-up, `call_ended` and then `call_analyzed` arrive at the webhook.

**Outbound.** With `DEVICE_PHONE_2` set, approve Culver City to Warning on the board; the dispatcher calls
`placeRetellCall`, Phone 2 rings with the English agent (Phone 1 gets the Spanish agent).

**Local, without Retell (crafted payloads).** In development only, `RETELL_SKIP_VERIFY=1` in `.env.local` accepts
unsigned requests (it is ignored when `NODE_ENV` is not `development`):
```
curl -s -X POST localhost:3000/api/retell/inbound -H 'content-type: application/json' \
  -d '{"event":"call_inbound","call_inbound":{"call_id":"call_test_1","from_number":"+13105550100","to_number":"+12135550142"}}'
# -> {"call_inbound":{"dynamic_variables":{...},"metadata":{"call_id":"<ours>",...}}}
curl -s -X POST localhost:3000/api/retell/tools/lookup_zone -H 'content-type: application/json' \
  -d '{"name":"lookup_zone","args":{"location_text":"Venice Blvd and Sepulveda"},"call":{"call_id":"call_test_1","metadata":{"call_id":"<ours>"}}}'
curl -s -X POST localhost:3000/api/retell/webhook -H 'content-type: application/json' \
  -d '{"event":"call_ended","call":{"call_id":"call_test_1","metadata":{"call_id":"<ours>"},"disconnection_reason":"user_hangup","transcript":"Agent: ...\nUser: ..."}}'
```
To test a signed request against a server that has `RETELL_API_KEY`, sign the exact body:
```
node -e 'const c=require("crypto");const b=process.argv[1];const t=Date.now();console.log(`v=${t},d=${c.createHmac("sha256",process.env.RETELL_API_KEY).update(b+t).digest("hex")}`)' '<body>'
```
and send it as `X-Retell-Signature`.

Route behavior: no `RETELL_API_KEY` -> `503 {"error":"Retell not configured"}`; missing or wrong signature -> `401`;
unknown tool -> `404`; unknown webhook events -> `200 {"ignored": ...}`.

## The browser phone

- `/phones`: QR code per volunteer device, role, language, live presence (the page's 1-second poll is the heartbeat;
  online = heard within 10 s), a picker to open any household's phone, and the public line.
- `/phone/[id]`: tap **Tap to enable sound** once (iOS needs a gesture), leave it open (screen wake lock). It rings,
  answers, speaks replies with the device's voice for the call language, and listens with push-to-talk (hold, or tap
  to start and tap to send). **Text mode** (type instead) is the path for deaf and hard-of-hearing callers and noisy
  rooms, and switches on by itself when the browser has no speech recognition or no voice for the language.
- `/call`: the public line in the browser; pick one of eight languages and the phone page answers by itself
  (`?autoanswer=1`).
- Voices: Android Chrome uses Google TTS (install Hindi/French voice data under Settings -> Text-to-speech if
  missing); iPhone: Settings -> Accessibility -> Spoken Content -> Voices. iPhone voice input needs Settings -> General
  -> Keyboard -> Enable Dictation. If voice input is refused the button switches to tap mode, then to text mode.
- iPhone ringer switch on silent mutes the ring tone.

## Retell API facts used (docs.retellai.com, spec revision 2026-10-16)

- Base `https://api.retellai.com`, `Authorization: Bearer <key>`. Errors are `{"status":"error","message":...}`
  (400, 401, 402 no credits, 422 unknown agent/number, 429 rate limited).
- `POST /v2/create-phone-call` `{from_number, to_number, override_agent_id, metadata, retell_llm_dynamic_variables}`
  (variables must be strings) -> `201 {call_id, call_status, ...}`. `POST /v2/stop-call/{call_id}` -> `204`.
- `POST /create-retell-llm` `{model, model_temperature, start_speaker: "agent", general_prompt, general_tools,
  default_dynamic_variables}`. Custom tool: `{type: "custom", name, description, url, method, parameters (JSON schema),
  speak_during_execution, speak_after_execution, timeout_ms, max_retry}`; built-in `{type: "end_call", name}`.
  Tool names must be unique, which is why Retell's end-call tool is named `hang_up`. Claude models offered:
  `claude-5.5-haiku`, `claude-4.5-haiku`, `claude-5.5-sonnet`, `claude-5-sonnet`, `claude-4.6-sonnet`, `claude-5.5-opus`,
  `claude-5-opus` (default would be `gpt-5.6-terra`).
- `POST /create-agent` `{response_engine: {type: "retell-llm", llm_id}, voice_id, language, webhook_url,
  webhook_events, post_call_analysis_data, post_call_analysis_model, voicemail_option, ...}`. Languages include
  `en-US`, `es-419`/`es-ES` (no `es-US`), `ko-KR`, `zh-CN`, `hi-IN`, `fr-FR`, and also `hy-AM` and `fil-PH`
  (Azure speech recognition only).
- Custom function request: POST `{name, call, args}` with `X-Retell-Signature`; `call` includes `call_id`,
  `metadata`, `retell_llm_dynamic_variables` and the transcript so far. Any 2xx body is passed to the LLM as a string
  (capped at 15,000 characters); default timeout 2 min, no retries unless `max_retry`.
- Webhook: POST `{event, call}`; 10 s timeout, retried up to 3 times on non-2xx; `call_ended` has no
  `call_analysis`, `call_analyzed` has `call.call_analysis = {call_summary, in_voicemail, user_sentiment,
  call_successful, custom_analysis_data}`. Calls that never connect get `call_ended` and `call_analyzed` but no
  `call_started`.
- Post-call analysis fields we define (`custom_analysis_data`): `primary_intent` (enum of `PRIMARY_INTENTS`), `needs`
  (comma-separated need words), `people` (number), `can_leave` (boolean), `location_text` (string).
- Inbound webhook (per number, `inbound_webhook_url`): POST `{event: "call_inbound", call_inbound: {call_id, agent_id,
  from_number, to_number}}`; reply within 10 s with `{call_inbound: {override_agent_id?, dynamic_variables, metadata}}`
  (or `{call_inbound: {reject: true}}`). If every attempt fails, Retell connects the number's inbound agent.
- Signature: `X-Retell-Signature: v=<unix ms>,d=<hex HMAC-SHA256(rawBody + v, api key)>`, rejected if more than
  5 minutes old. Verified against the raw body (`lib/retell/verify.ts`; checked against `retell-sdk` 6.2.7's own
  `verify`). Retell also documents its source IP `100.20.5.228`.
- A missing dynamic variable is left as raw `{{name}}` in the prompt, so the LLM carries a default for each one.

## Troubleshooting

- **401 Invalid Retell signature**: the key is not the one with the webhook badge, or a proxy changed the body.
- **503 Retell not configured**: `RETELL_API_KEY` missing, or the dev server was not restarted.
- **Tool results say "not linked to the response system"**: the call had no `metadata.call_id` and the engine could
  not find it; for inbound calls check the number's inbound webhook URL (`--update` sets it).
- **Agent creation fails on a voice**: the script retries with `retell-Cimo`; or set `RETELL_VOICE_XX`.
- **The phone page loads but never becomes interactive over the tunnel**: `allowedDevOrigins` is missing.
