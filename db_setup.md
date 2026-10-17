# Database setup (Supabase)

VoiceFlare runs on a local file store (`.data/secondkey.json`) until Supabase keys are present. With Supabase:

- data survives server restarts;
- the app can run on Vercel (the file store only works on one machine);
- the whole team sees the same live board.

Use Node 22 or later. On Node 20, `@supabase/supabase-js` throws "native WebSocket not found" on the first query.

The code already supports both stores. No code change is needed, only the steps below.

## Status: the team project is live (Oct 17, 2026)

The team's Supabase project is set up, and the app has been verified against it.

| | |
| --- | --- |
| Project | `VoiceFlare`, URL `https://ityakimbfqthuikrvnwu.supabase.co` |
| Region | East US (North Virginia), Free plan, nano compute |
| Owner | Pranav (ask for the keys) |
| Tables | All 22, from `schema.sql`, `002` and `003` (steps 1 to 2 below are done) |
| Data | Westside scenario seeded |

### What was done

- **Step 1:** created the project.
- **Step 2:** ran all three SQL files.
- **Steps 3 to 4:** put the keys in Pranav's `.env.local`.
- **Fixed in the SQL first** (commit `00e0488`):
  - **Grants for `service_role`.** Projects created since 2026-05-30 no longer expose SQL-created tables to the
    Data API, so the old SQL would have failed with `42501 permission denied` on every query.
  - **No more "anon read" policies.** The anon key is public (it ships to every browser), and those policies let
    anyone holding it read the registry, phones, transcripts and locations. RLS is on everywhere; `anon` and
    `authenticated` get no access.
- **Fixed in the code:**
  - **Node 22+** is now required (`package.json` engines, `.nvmrc`).
  - **`E2E_STORAGE=supabase`** lets `scripts/e2e.ts` run against Supabase. Before, it always used a local file.

### Verified against the live project

- **e2e:** `E2E_STORAGE=supabase` passes every check, including the live-location and helper steps that use
  `location_shares` and `dispatches`.
- **Health:** `/api/health` shows `database: supabase store, 88 households`.
- **Anon key:** gets `42501 permission denied` on `help_requests`, `households`, `calls`, `locations`, `ledger` and
  `location_shares`.
- **Locally:** `npm run typecheck` and `npm run lint` pass.

### Read this before you use it

1. **Node 22 or later.** On Node 20, supabase-js crashes on the first query ("native WebSocket not found"). Check with
   `node -v`. On a Mac with Homebrew, `brew install node` and make sure `/opt/homebrew/bin` comes before any
   `node@20` in your `PATH`.
2. **One server at a time on this database.** The lock that stops two board refreshes from placing the same call
   twice only works inside one server process. Everyone should open **the same running board** (one laptop plus the
   tunnel), not each run `npm run dev` against Supabase. For your own work, keep `STORAGE=local`.
3. **Ask Pranav for the keys, privately.** Never put them in the repo, an issue, the group chat or an AI chat. The
   secret (service-role) key has full access to the database. They go in your own `.env.local`, which git ignores.
4. **`ANTHROPIC_API_KEY` is still needed.** Without it the server starts, but every route answers with an env error.
5. **These commands wipe the shared run:** `npm run seed`, `/api/demo/reset`, the e2e with `E2E_STORAGE=supabase`, and
   `scripts/autoplay-check.ts`. Each one clears the data and reloads Westside, so say so in the team chat before you
   run any of them.
6. **New tables need grants.** If you add a table in a `004_*.sql`, end it like `002` does: enable RLS, revoke
   `anon` and `authenticated`, and grant `select, insert, update, delete` to `service_role`. Without that, the server
   gets `42501`.
7. **Delete the project after the hackathon.** The 72-hour registry purge isn't built, and the volunteer phones are
   real numbers.

## Steps

### 1. Create the project

supabase.com → **New project**. Region: **West US (North California)**, the closest to LA. Save the database
password somewhere safe.

### 2. Create the tables

In the Supabase dashboard, open **SQL Editor** → **New query**, then paste and run each file in this order:

| Order | File | What it creates |
| --- | --- | --- |
| 1 | `supabase/schema.sql` | Base tables: households, campaigns, calls, household status, alerts feed, twist log, sim runs. It also includes the live-location tables |
| 2 | `supabase/migrations/002_second_key.sql` | Zones, zone events, proposals, intents, help registry, locations, pickup runs, holds, canaries, reports, clusters, ledger, meta |
| 3 | `supabase/migrations/003_live_location.sql` | `location_shares` (consent and live GPS links) and `dispatches` (helpers sent to a person's exact spot) |

- `schema.sql` **drops and recreates** its tables. Re-run it only when you want a clean wipe.
- `002` and `003` are additive and safe to re-run.
- Every table has row-level security on and **no anonymous policy**. The anon key ships to every browser, and these
  tables hold names, phones, transcripts and locations, so only the server (service role) reads or writes them. No
  page reads Supabase directly; the board and phones go through the API routes.
- **Run all three files, even on a fresh project.** Projects created since 2026-05-30 no longer expose new tables to
  the Data API by default. The grants at the end of `002` and `003` give the server's `service_role` access; with
  `schema.sql` alone, every request fails with `42501 permission denied for table ...`.
- Check it worked: **Authentication → Policies** should list no "anon read" policy on any table. (An earlier
  version of `002` created them; re-running the current `002` removes them.)
- Leave **Integrations → Data API → Enable Data API** on. The server uses it through `supabase-js`; with it off,
  nothing responds whatever the grants say.

### 3. Copy the keys

**Project Settings → API** (or Data API / API Keys). You need:

- the **Project URL**;
- the **service_role** (or secret) key: this is the one the server uses;
- the **anon** (or publishable) key: optional today, since no page talks to Supabase directly.

If the newer `sb_...` keys give errors, use the legacy anon and service_role keys instead.

### 4. Put the keys in `.env.local`

Put them in `.env.local` on your own machine. Never paste them in chat, an issue or a commit: the service-role
key has full access to the database. `.env*` files are git-ignored, except `.env.example`.

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service_role or secret key>
STORAGE=local
```

Keep `STORAGE=local` at first. Builds and tests that are still running reset data in parallel; pointing them all
at one shared database would make them collide and slow them down.

### 5. Switch on

Once the current builds are merged:

1. If the block-evacuation or heat-wave work adds tables, run `supabase/migrations/004_*.sql` the same way as step 2.
2. Set `STORAGE=auto` (or `STORAGE=supabase` to fail loudly when a key is missing). Restart the server.
3. Load the scenario into the database: `npm run seed`
4. Check `GET /api/health`: `checks.database.detail` should read `supabase store, <n> households`, not `local`.
5. Run the demo path against Supabase. This **wipes the run in that database** and reloads Westside, so do it before
   the team starts using it, or tell them first:
   ```bash
   E2E_STORAGE=supabase npx tsx --conditions=react-server scripts/e2e.ts
   ```
   The first line printed should be `store: supabase`, and the last `All checks passed`. Without `E2E_STORAGE` the
   script always uses its own local file, so a pass there says nothing about Supabase.
6. Run `npm run seed` again afterwards, so the board starts from a clean Westside.
7. Optional: `npx tsx scripts/autoplay-check.ts http://localhost:3000` plays the full fire against the running server.
   It also resets the scenario, so the same warning applies.

## How the app picks a store

`lib/env.ts` → `storageBackend()`:

| `STORAGE` | Supabase keys set | Store used |
| --- | --- | --- |
| `local` | either | Local file |
| `auto` (default) | yes | Supabase |
| `auto` (default) | no | Local file |
| `supabase` | no | Error at start |

## Performance watch

The board refreshes about once a second, and each refresh runs the engine's timers, which means several database
calls per refresh. If the board feels slow on the demo laptop, keep `STORAGE=local` for the live demo and use
Supabase for the deployed copy. Changing that one line is the whole switch.

**Run one server against the database at a time.** The lock that stops two refreshes from dispatching the same call
twice lives in one server process (`withLock` in `lib/db/index.ts`). Two servers on the same database, say two
laptops running `npm run dev` or several Vercel instances, can place duplicate calls and double-advance timers.
Teammates can all open the *same* server's board; they should not each run their own against the shared database.

## What gets stored

Everything the board shows: zones and their approved directives, calls and transcripts, the help registry with last
locations, live GPS links shared with consent (`location_shares`), helpers sent to a spot (`dispatches`), holds,
canaries, the ledger of every human decision, and the live feeds (CAL FIRE, NWS) pulled at reset. All residents are
synthetic except the volunteer phones.

Not built yet:

- The 72-hour registry purge after an incident closes is the stated policy; nothing runs it yet. Until it does, delete
  the Supabase project after the event. (Re-running `schema.sql` is not enough: it only drops its own seven tables,
  not the registry, locations or ledger from `002`.)
