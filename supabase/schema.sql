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
