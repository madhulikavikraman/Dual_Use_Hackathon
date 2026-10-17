-- AllClear schema. Run in the Supabase SQL editor (safe to re-run: drops and recreates).
-- All resident data is SYNTHETIC. Only volunteer devices are real.

drop table if exists sim_runs cascade;
drop table if exists twist_log cascade;
drop table if exists alerts_feed cascade;
drop table if exists household_status cascade;
drop table if exists calls cascade;
drop table if exists campaigns cascade;
drop table if exists households cascade;

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null, address text,
  lat double precision not null, lng double precision not null,
  has_device boolean default false,      -- a volunteer phone page is assigned
  synthetic boolean default true,
  language text default 'English',
  lang_code text default 'en-US',
  afn_flags text[] default '{}',
  memory_note text,
  linked_contact_household_id uuid,      -- linked contact is another device-holder
  linked_contact_name text,
  can_drive_neighbors boolean default false, seats int default 0
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (stage in ('checkin','warning','order','all_clear')),
  mode text not null default 'civilian' check (mode in ('civilian','base')),
  zone_name text, polygon jsonb not null, alert_text text not null,
  shelter_name text, shelter_address text, shelter_accepts_pets boolean,
  verification_phrase text, callback_number text,
  created_at timestamptz default now()
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  called_party text default 'resident',  -- resident | linked_contact
  attempt int default 1,
  state text default 'ringing',          -- ringing|active|ended|no_answer|unreachable
  messages jsonb default '[]',           -- Claude conversation history
  transcript text, summary text, analysis jsonb,
  started_at timestamptz default now(), ended_at timestamptz,
  simulated boolean default false
);
create index calls_campaign_idx on calls (campaign_id);
create index calls_household_idx on calls (household_id);

create table household_status (
  campaign_id uuid references campaigns(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  status text default 'pending', -- pending|ringing|on_call|safe|leaving|needs_help|wont_leave|unclear|wrong_number|no_answer|unreachable
  understood boolean, destination text,
  needs text[] default '{}', needs_note text,
  device_battery_hours numeric, animals text, people int,
  refusal_reason text, seats_for_neighbors int,
  hazard_seen boolean, hazard_type text, hazard_direction text, hazard_distance text,
  distress boolean default false,
  human_requested boolean default false, human_reason text,
  via text default 'resident', assigned_run text,
  updated_at timestamptz default now(), simulated boolean default false,
  primary key (campaign_id, household_id)
);

create table alerts_feed (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  kind text, title text, detail text, geo jsonb,
  created_at timestamptz default now()
);

create table twist_log (
  id uuid primary key default gen_random_uuid(),
  twist_no int, title text, what_changed text, proof text,
  created_at timestamptz default now()
);

-- Simulator state (the board's tick advances it; serverless has no long-lived timers).
create table sim_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  preset text not null default 'normal', -- normal | tower_down | fire_spreading
  active boolean default true,
  started_at timestamptz default now(),
  plan jsonb default '[]'                -- scheduled events: [{household_id, at_ms, done}]
);

-- Row level security: browsers (anon key) may READ everything; all writes go through
-- server routes using the service-role key, which bypasses RLS.
alter table households enable row level security;
alter table campaigns enable row level security;
alter table calls enable row level security;
alter table household_status enable row level security;
alter table alerts_feed enable row level security;
alter table twist_log enable row level security;
alter table sim_runs enable row level security;

create policy "anon read" on households for select using (true);
create policy "anon read" on campaigns for select using (true);
create policy "anon read" on calls for select using (true);
create policy "anon read" on household_status for select using (true);
create policy "anon read" on alerts_feed for select using (true);
create policy "anon read" on twist_log for select using (true);
create policy "anon read" on sim_runs for select using (true);

-- Realtime (postgres changes)
alter publication supabase_realtime add table household_status, calls, alerts_feed, campaigns;

-- ---------- VoiceFlare additions (run the migrations after this file) ----------
-- supabase/migrations/002_second_key.sql: zones, holds, the help registry, locations, the ledger and the rest.
-- supabase/migrations/003_live_location.sql: live location with consent and helpers sent to the spot:
--   location_shares (consent quote, source, 4-hour link, last GPS fix, ping count) and dispatches (helper, link,
--   status, the named human who sent them). Both keep RLS on with no anon policy: they hold the link tokens.
-- The same two tables, so a fresh database built from this file has them (003 re-runs safely on top).

-- One row per "yes" on a call: the person's words, where it was heard, and the link they open (/l/<token>).
create table if not exists location_shares (
  id uuid primary key,
  token text not null unique,               -- 192 random bits, base64url: the person's only key to the link
  household_id uuid,
  help_request_id uuid,
  call_id uuid,
  phone text,                               -- response team only
  consent_quote text not null,              -- the person's own words
  consent_source text not null check (consent_source in ('retell_call', 'browser_call', 'public_line', 'post_call')),
  consented_at timestamptz not null default now(),
  status text not null default 'sent' check (status in ('sent', 'live', 'stopped', 'expired', 'closed')),
  expires_at timestamptz not null,          -- 4 hours after consent
  last_lat double precision,
  last_lng double precision,
  last_accuracy_m double precision,
  last_heading double precision,
  last_speed double precision,
  last_fix_at timestamptz,
  ping_count int not null default 0,
  sent_via text,                            -- twilio | retell | browser_phone | simulated
  stop_reason text,
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists location_shares_household_idx on location_shares (household_id);
create index if not exists location_shares_help_idx on location_shares (help_request_id);
create index if not exists location_shares_call_idx on location_shares (call_id);
create index if not exists location_shares_status_idx on location_shares (status);

-- One row per helper sent to a registry row by a named human; the helper opens /helper/<token>.
create table if not exists dispatches (
  id uuid primary key,
  help_request_id uuid not null,
  helper_id text,
  helper_label text not null,
  helper_phone text,
  token text not null unique,
  status text not null default 'assigned' check (status in ('assigned', 'en_route', 'arrived', 'reached', 'cannot_reach', 'cancelled')),
  dispatched_by text not null,
  reason text not null,
  target_lat double precision,
  target_lng double precision,
  target_accuracy_m double precision,
  target_source text,
  note text,
  synthetic boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dispatches_help_idx on dispatches (help_request_id);


-- RLS on, and NO anon policy: these rows hold the link tokens (the keys) and live positions. Only the server's
-- service-role key reads or writes them. (Every other table lets anon read; these two must not.)
alter table location_shares enable row level security;
alter table dispatches enable row level security;
drop policy if exists "anon read" on location_shares;
drop policy if exists "anon read" on dispatches;

-- supabase/migrations/005_evac_blocks.sql: block-by-block evacuation plans (the same table, so a fresh database built
-- from this file has it; 005 re-runs safely on top). Blocks, exit roads and waves are JSON; a named human approves.
create table if not exists evac_plans (
  id uuid primary key,
  zone_id text not null,
  status text not null default 'proposed' check (status in ('proposed', 'standby', 'active', 'all_go', 'rejected', 'closed')),
  wave_minutes int not null default 10,
  current_wave int not null default 0,
  wave_started_at timestamptz,
  held boolean not null default false,
  held_by text,
  held_reason text,
  routes jsonb not null default '[]',
  blocks jsonb not null default '[]',
  waves jsonb not null default '[]',
  templates jsonb not null default '{}',
  assumptions text,
  proposed_by text not null,
  approved_by text,
  approved_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists evac_plans_zone_idx on evac_plans (zone_id);
create index if not exists evac_plans_status_idx on evac_plans (status);
alter table evac_plans enable row level security;
drop policy if exists "anon read" on evac_plans;
create policy "anon read" on evac_plans for select using (true);
