-- VoiceFlare, migration 003: live location with consent, and helpers sent to the spot (PRD item 61, D-12).
-- Run in the Supabase SQL editor AFTER schema.sql and 002_second_key.sql. Safe to re-run. Additive only.
-- Without Supabase the app uses the local file store and needs none of this.

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

-- Every GPS ping also lands in locations (source 'gps_link', consent true): one index for the history view.
create index if not exists locations_help_idx on locations (help_request_id, observed_at desc);

-- RLS on, and NO anon policy: these rows hold the link tokens (the keys) and live positions. Only the server's
-- service-role key reads or writes them. (Every other table lets anon read; these two must not.)
alter table location_shares enable row level security;
alter table dispatches enable row level security;
drop policy if exists "anon read" on location_shares;
drop policy if exists "anon read" on dispatches;
