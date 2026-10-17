-- VoiceFlare, migration 002 (PRD section 15, decision D-18: additive).
-- Run in the Supabase SQL editor AFTER supabase/schema.sql. Safe to re-run.
-- Without Supabase the app uses a local file store and needs none of this.

-- ---------- existing tables: new columns ----------

alter table households
  add column if not exists device_label text,
  add column if not exists phone_e164 text,
  add column if not exists role text default 'resident',
  add column if not exists channel text default 'voice',
  add column if not exists zone_id text,
  add column if not exists on_post boolean default false,
  add column if not exists reliability double precision default 0.9,
  add column if not exists last_heard timestamptz,
  add column if not exists presence_at timestamptz,
  add column if not exists scenario text default 'westside',
  add column if not exists sim_profile text;

alter table campaigns drop constraint if exists campaigns_mode_check;
alter table campaigns add constraint campaigns_mode_check check (mode in ('civilian', 'campus', 'base'));
alter table campaigns alter column polygon drop not null;
alter table campaigns
  add column if not exists kind text default 'warning',
  add column if not exists zone_id text,
  add column if not exists directive_text text,
  add column if not exists move_text text,
  add column if not exists evac_point text,
  add column if not exists wave int,
  add column if not exists order_rule text default 'edge_first',
  add column if not exists started_by text,
  add column if not exists hold_id uuid,
  add column if not exists status text default 'running';

alter table calls
  add column if not exists subject_household_id uuid,
  add column if not exists purpose text default 'resident',
  add column if not exists transport text default 'browser',
  add column if not exists retell_call_id text,
  add column if not exists outcome text,
  add column if not exists vars jsonb default '{}',
  add column if not exists order_index int default 0,
  add column if not exists ring_index int default 0,
  add column if not exists edge_distance_m double precision,
  add column if not exists hold_id uuid,
  add column if not exists planned_at timestamptz default now(),
  add column if not exists answered_at timestamptz,
  add column if not exists last_activity_at timestamptz,
  add column if not exists sim jsonb,
  add column if not exists created_at timestamptz default now();
alter table calls alter column started_at drop default;
create index if not exists calls_retell_idx on calls (retell_call_id);
create index if not exists calls_state_idx on calls (state);

alter table household_status add column if not exists location_text text;

alter table alerts_feed
  add column if not exists zone_id text,
  add column if not exists severity text default 'info';

alter table twist_log
  add column if not exists twist_text text,
  add column if not exists why text,
  add column if not exists commits text[] default '{}';

-- ---------- new tables ----------

create table if not exists zones (
  id text primary key, name text not null, scenario text not null,
  geom jsonb not null, state text not null,
  directive_text text, move_text text, evac_point text,
  evac_point_lat double precision, evac_point_lng double precision,
  fact_sheet text, population_est int, area_sq_mi double precision, hazard_origin jsonb,
  source text, approved_by text, approved_at timestamptz,
  version int default 1, updated_at timestamptz default now()
);

create table if not exists zone_events (
  id uuid primary key, zone_id text, from_state text, to_state text, source text,
  actor text, reason text, hold_id uuid, created_at timestamptz default now()
);

create table if not exists proposals (
  id uuid primary key, zone_id text, proposed_state text, model text, reason text, score double precision,
  envelope jsonb, status text, decided_by text, decided_at timestamptz, decision_reason text,
  created_at timestamptz default now()
);

create table if not exists intents (
  id uuid primary key, call_id uuid, household_id uuid, primary_intent text, flags text[] default '{}',
  needs text[] default '{}', people int, location_text text, destination text, can_leave boolean, understood boolean,
  language text, confidence double precision, summary text, source text, review_needed boolean default false,
  created_at timestamptz default now()
);

create table if not exists help_requests (
  id uuid primary key, household_id uuid, phone text, name text, language text, zone_id text,
  priority int, needs text[] default '{}', device_battery_hours double precision, animals text, people int,
  reason text, status text, assigned_to text, run_id uuid, source text,
  last_lat double precision, last_lng double precision, last_accuracy_m double precision, last_source text,
  last_stated_text text, last_consent boolean default false, last_observed_at timestamptz,
  synthetic boolean default true, created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists locations (
  id uuid primary key, household_id uuid, help_request_id uuid, lat double precision, lng double precision,
  accuracy_m double precision, source text, stated_text text, consent boolean default false, observed_at timestamptz default now()
);

create table if not exists pickup_runs (
  id uuid primary key, label text, vehicle text, stops text[] default '{}', status text, created_at timestamptz default now()
);

create table if not exists holds (
  id uuid primary key, zone_id text, proposed_state text, alert_text text, directive_text text, move_text text,
  evac_point text, polygon jsonb, polygon_label text, population_est int, area_sq_mi double precision,
  started_at timestamptz, deadline timestamptz, extended_once boolean default false,
  tally jsonb, sentinels jsonb, read text, decision text, decided_by text, reason text,
  decided_at timestamptz, sent_at timestamptz, status text, opened_by text, open_reason text,
  handed_off_by text, handed_off_at timestamptz
);
alter table holds add column if not exists handed_off_by text, add column if not exists handed_off_at timestamptz;

create table if not exists canaries (
  id uuid primary key, hold_id uuid, household_id uuid, call_id uuid, inside boolean, result text, flag text,
  observed_at timestamptz, created_at timestamptz default now()
);

create table if not exists reports (
  id uuid primary key, type text, lat double precision, lng double precision, zone_id text, source text,
  household_id uuid, call_id uuid, text text, synthetic boolean default true, created_at timestamptz default now()
);

create table if not exists clusters (
  id text primary key, cell text, zone_id text, kind text, count int, baseline double precision, score double precision,
  corroborated boolean default false, sentinel_reads int default 0, status text,
  center_lat double precision, center_lng double precision, member_ids text[] default '{}',
  first_at timestamptz, last_at timestamptz
);

create table if not exists ledger (
  id uuid primary key, actor text, action text, allowed boolean default true, kind text, target text, reason text,
  created_at timestamptz default now()
);

create table if not exists meta (
  id text primary key, scenario text, mode text, jurisdiction text default 'US-CA', sim_preset text, verification_phrase text, callback_number text,
  cost_minutes double precision default 0, cost_usd double precision default 0, usgs_event jsonb,
  autopilot_devices boolean default false, wrong_polygon boolean default false, updated_at timestamptz default now()
);

-- ---------- RLS: anon may read, server routes write with the service-role key ----------
do $$
declare t text;
begin
  foreach t in array array['zones','zone_events','proposals','intents','help_requests','locations','pickup_runs',
                           'holds','canaries','reports','clusters','ledger','meta']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "anon read" on %I', t);
    execute format('create policy "anon read" on %I for select using (true)', t);
  end loop;
end $$;

alter table meta add column if not exists jurisdiction text default 'US-CA';
