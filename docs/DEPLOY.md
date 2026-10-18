# Deploying to Vercel

`main` is the production branch, and every push to it redeploys. Other branches, such as `AB_dev`, get preview URLs.
The database is the team Supabase project ([`db_setup.md`](../db_setup.md)). Vercel cannot use the local file store,
so a deploy without the Supabase variables refuses to start.

## 1. Import the project (once)

1. vercel.com → **Add New → Project** → import `madhulikavikraman/voice_flare` from GitHub.
2. Framework: **Next.js** (detected). Leave the build and output settings at their defaults.
3. Production branch: **main** (Settings → Git, if it is not already).
4. Node.js version: the default (22 or later) is fine; `package.json` asks for `>=22`.
5. Region: `vercel.json` pins functions to **iad1** (Washington, D.C.), next to the Supabase project in us-east-1.
   Every board refresh makes several database calls, so keep the two together.
6. Add the environment variables below, **then** deploy.

## 2. Environment variables

Settings → Environment Variables. Set them for Production, and for Preview too if you want working preview URLs.
`NEXT_PUBLIC_*` values are built into the page, so after changing one, **redeploy**.

| Variable | Value | Needed |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | the team's Claude key | **yes**: every route fails without it |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ityakimbfqthuikrvnwu.supabase.co` | **yes** |
| `SUPABASE_SERVICE_ROLE_KEY` | the Supabase secret key (ask Pranav) | **yes** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable key | optional (no page uses it yet) |
| `STORAGE` | `supabase` | **yes**: fails loudly if a key is missing |
| `DESK_PASSWORD` | a password the team shares | **yes**: see below |
| `APP_BASE_URL` | the production URL, e.g. `https://voiceflare.vercel.app` | **yes** for QR codes, text links and Retell |
| `AGENT_MODEL`, `ANALYSIS_MODEL` | leave unset (defaults `claude-haiku-5-5`, `claude-sonnet-5-5`) | no |
| `FEED_TOKEN` | something other than `demo` | recommended, since the feeds are public |
| `CALLBACK_NUMBER`, `VERIFICATION_PHRASE` | as in `.env.example` | no |
| `RETELL_*`, `DEVICE_PHONE_1..6` | see [`RETELL.md`](RETELL.md) | only for real phone calls |
| `TWILIO_*`, `RETELL_SMS*` | see `.env.example` | only for real text messages |

Paste the secrets into Vercel only, never into the repo or a chat. Mark `ANTHROPIC_API_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` as **Sensitive**.

**Set `DESK_PASSWORD`.** A Vercel URL is public. Without the password, anyone with the link can open the board, the
help registry (phone numbers and locations), approvals, resets and exports. With it set, those need HTTP Basic auth
(any user name, that password). The phone pages, the public line, Retell, the feeds, the health check and the
token links in text messages stay open (`proxy.ts`).

## 3. Check the deploy

1. `https://<your-url>/api/health` should return `"ok": true`, with `database` reading `supabase store, <n> households`.
   An env error there names the missing variable.
2. Load the scenario once: `SEED_BASE_URL=https://<your-url> npm run seed`. If `DESK_PASSWORD` is set, use the
   **Reset** button on `/demo` instead, since the seed script doesn't send the password.
3. Open `/board`, sign in with the desk password, and play one step of the demo.
4. If you use Retell, point its webhooks at the new URL: set `APP_BASE_URL` in `.env.local` to it, then run
   `npx tsx scripts/retell-setup.ts` again (see [`RETELL.md`](RETELL.md)).

## What to know about running on Vercel

- **One board at a time drives the engine.** The engine's timers (dispatch, holds, canaries) advance when the board
  polls, and the lock that stops two polls from placing the same call twice only lives inside one server instance.
  Vercel can run several instances, so two boards open at once can occasionally double-dispatch. For the judged demo,
  keep one board open, or run the demo from a laptop with `STORAGE=local` as [`DEMO.md`](DEMO.md) describes and keep
  the Vercel copy for people to browse.
- **Nothing runs while no board is open.** There is no background worker; timers catch up on the next poll.
- **Post-call analysis runs after the response** through Next's `after()`, which Vercel supports. Calls cost Claude
  tokens, so leave autopilot off on the public copy unless someone is watching.
- **The evidence page's gold-set score** reads `.data/gold-set-latest.json`, which isn't deployed. On Vercel that
  card reads "not yet run". That's expected.
- **The shared database is the shared demo.** A reset on the Vercel copy also resets what a teammate sees if they
  point at the same Supabase project (see "Read this before you use it" in `db_setup.md`).
