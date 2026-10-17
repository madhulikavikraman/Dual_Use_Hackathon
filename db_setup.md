# Database setup (Supabase)

VoiceFlare runs on a local file store (`.data/secondkey.json`) until Supabase keys are present. With Supabase:

- data survives server restarts;
- the app can run on Vercel (the file store only works on one machine);
- the whole team sees the same live board.

The code already supports both stores. No code change is needed, only the steps below.

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
- The two live-location tables have row-level security on and no anonymous read. They hold link tokens, and only the
  server (service role) touches them.

### 3. Copy the keys

**Project Settings → API** (or Data API / API Keys). You need:

- the **Project URL**;
- the **anon** (or publishable) key;
- the **service_role** (or secret) key.

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
4. Check `GET /api/health`: `database` should say Supabase, not "local store".
5. Run the checks against it:
   ```bash
   npx tsx --conditions=react-server scripts/e2e.ts
   npx tsx scripts/autoplay-check.ts http://localhost:3000
   ```

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

## What gets stored

Everything the board shows: zones and their approved directives, calls and transcripts, the help registry with last
locations, live GPS fixes (consented only), helper dispatches, holds, canaries, the ledger of every human decision,
and the live feeds (CAL FIRE, NWS) pulled at reset. All residents are synthetic except the volunteer phones.
Registry rows are purged 72 hours after a human closes the incident.
