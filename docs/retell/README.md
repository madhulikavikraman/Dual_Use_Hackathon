# VoiceFlare on the Retell dashboard

Everything in this folder except this README is generated from the code by `npx tsx scripts/retell-export.ts`, so it
matches what the app and the setup scripts use. Do not edit the generated files: change the code and run the export again.

| File | What it is |
| --- | --- |
| `retell-kit.html` | One page with every dashboard field in order and a Copy button per block. Open it in a browser. |
| `voiceflare-retell-llm.json` | `POST /create-retell-llm` body: the prompt, the 8 custom functions, `hang_up`, the default variables. |
| `voiceflare-agent.json` | `POST /create-agent` body, English, single prompt (`response_engine: retell-llm`). |
| `voiceflare-conversation-flow.json` | `POST /create-conversation-flow` body for the visual flow builder. |
| `voiceflare-flow-agent.json` | `POST /create-agent` body, English, conversation flow. |
| `functions/*.json` | One function each, as the dashboard's function form wants it. |
| `dynamic-variables.sample.json` | Synthetic values for the dashboard test panel. |
| `prompt.md` | The prompt, and every dynamic variable with what it means and a sample value. |

Placeholders: `{{APP_BASE_URL}}` (your public https URL), `{{RETELL_LLM_ID}}` and `{{RETELL_FLOW_ID}}` stand in for
values you only have after setup. Export with `--base-url=https://...` (or with `APP_BASE_URL` set) to write real URLs.

## Three ways onto the dashboard, most reliable first

You need: the dev server reachable over public HTTPS (`npx cloudflared tunnel --url http://localhost:3000`, then put the
`https://...trycloudflare.com` URL in `APP_BASE_URL`), and the Retell API key with the **webhook badge** in
`RETELL_API_KEY`. See `docs/RETELL.md` for the full setup and troubleshooting.

### a. Script, single prompt agent (already wired)

```
npx tsx scripts/retell-setup.ts --dry-run
npx tsx scripts/retell-setup.ts
```

Creates one Retell LLM and one agent per language (EN, ES, KO, ZH, HI, FR), and binds `RETELL_FROM_NUMBER` with the
inbound webhook. Paste the printed `RETELL_LLM_ID=` and `RETELL_AGENT_ID_*=` lines into `.env.local` and restart the dev
server. This is the agent the code, the browser phone and the tests are built around.

### b. Script, conversation flow

```
npx tsx scripts/retell-flow-setup.ts            # dry run: prints what it would send
npx tsx scripts/retell-flow-setup.ts --create   # creates the flow and an English flow agent
```

Options: `--only=en,es` for more languages, `--bind-number` to point `RETELL_FROM_NUMBER` at the English flow agent
(this replaces the single prompt agent on the number), `--verbose` to print the whole flow in a dry run. Paste the
printed `RETELL_FLOW_ID=` and `RETELL_FLOW_AGENT_ID_EN=` lines into `.env.local`. The app places calls with
`RETELL_AGENT_ID_<LANG>`, so to have VoiceFlare call with the flow agent, set `RETELL_AGENT_ID_EN` to the flow agent's id.
Open the agent on the dashboard to see the canvas.

### c. By hand, from the kit page

Open `docs/retell/retell-kit.html`, type your public URL into the box at the top (every URL on the page updates), and
follow steps 1 to 12: agent, model and voice, prompt, welcome message, 8 custom functions and the End Call tool, speech
and call settings, post-call extraction, default variables, webhook, phone number, test. The conversation flow section
lists all nodes and edges if you want to build the canvas by hand.

**JSON import.** Retell's docs (docs.retellai.com, read on 2026-10-17) describe no dashboard import of an agent or a
flow from a JSON file; the only JSON import they describe is for simulation test cases. The JSON files here are API
request bodies: use the scripts above, or send one yourself after exporting with a real base URL:

```
curl -X POST https://api.retellai.com/create-retell-llm \
  -H "Authorization: Bearer $RETELL_API_KEY" -H "Content-Type: application/json" \
  --data @docs/retell/voiceflare-retell-llm.json
```

## After setup

1. **Phone number.** Phone Numbers, your number: this agent as inbound and outbound agent, and the inbound call webhook
   `APP_BASE_URL/api/retell/inbound`. `retell-setup.ts` does this when `RETELL_FROM_NUMBER` is set;
   `retell-flow-setup.ts` does it with `--bind-number`.
2. **Webhook.** The agent's webhook URL is `APP_BASE_URL/api/retell/webhook` (events `call_started`, `call_ended`,
   `call_analyzed`). Both scripts set it.
3. **When the tunnel URL changes** (every `cloudflared` restart): set the new `APP_BASE_URL`, then
   `npx tsx scripts/retell-setup.ts --update` (and `npx tsx scripts/retell-flow-setup.ts --update` if you use the flow).
   They PATCH the tool URLs, webhook URLs and the number's inbound webhook in place. Re-run the export if you use the kit.
4. **Test call.**
   - Dashboard **Test** (web call): paste a sample from `dynamic-variables.sample.json` into the test panel. The call is
     not linked to a VoiceFlare call, so tools answer "Nothing was recorded: this call is not linked to the response
     system". That is expected.
   - Inbound, linked: call `RETELL_FROM_NUMBER`. The inbound webhook registers the call; the agent greets with the
     verification phrase, asks where you are and reads the approved directive.
   - Outbound, linked: with `DEVICE_PHONE_2` set, approve a zone to Warning on `/board`.
   - `GET /api/board` shows `"retell": true` when the key is loaded.

## Regenerate the kit

```
npx tsx scripts/retell-export.ts                          # URLs from APP_BASE_URL, or {{APP_BASE_URL}}
npx tsx scripts/retell-export.ts --base-url=https://...   # bake in a URL
```

Run it after any change to `lib/agent/prompt.ts`, `lib/agent/tools.ts`, `lib/retell/config.ts` or `lib/retell/flow.ts`.
It warns when the prompt gains a purpose the flow has no lane for (that purpose goes to the flow's script fallback
node) or a dynamic variable the kit has no description for.

## How the flow maps to the single prompt

- **Global prompt** = `lib/agent/prompt.ts` without "# Scripts by purpose", plus a short note on how the flow works.
  Each node's instruction quotes the script lines for its purpose, so the words match the single prompt.
- **Lanes** from the purpose split: resident (directive read word for word, status, needs, record, live-location
  consent, teach-back, smoke question, collections offer), public line (where are you, `lookup_zone`, read the result),
  response-team callback, linked contact, sentinel, canary, monthly test, and a script fallback for any other purpose.
- **Heat lane**: when `{{mode}}` is `heat`, resident, public-line, callback and linked-contact calls go to one
  "Heat check-in line" node that follows the prompt's "# Heat mode" section (stay cool? water, a ride or a check-in?
  CDC heat-stroke signs mean "Hang up and call {{emergency_number}} now"). The greeting names the heat check-in line.
- **Function nodes** run a tool at a fixed step (`record_status`, `share_live_location`, `lookup_zone`, `end_call`, ...).
  Three copies of `request_human` pin the reason with `const` (`medical_emergency` + `now`, `cannot_answer`, `salvage`);
  they post to the same `/api/retell/tools/request_human`, which reads the tool from the URL.
- **Global nodes**, reachable from any step: medical emergency ("Hang up and call {{emergency_number}} now", then
  `request_human` now, then the location link offered once), an unapproved question such as an ETA ("I can't answer
  that; a person will call you back" and `request_human` with `asked_unapproved`, then back to where the call was), and
  a caller who doubts the call is real (verification phrase, callback number, `request_human` with `doubts_call`).
- **End**: thank you and goodbye, `end_call` records the outcome, the end node hangs up.
- Function nodes use `tool_type: "local"` for tools in the flow's own `tools` list. The schema lists `local` and
  `shared` without defining them for tools; for subflows it defines `local` as stored in the flow and `shared` as
  stand-alone, and we read tools the same way.

Not yet run against the live Retell API (no key was set while it was built). The bodies were checked field by field
against the API reference (spec revision 2026-10-16-5d9ba01): create-retell-llm, create-conversation-flow, create-agent.
