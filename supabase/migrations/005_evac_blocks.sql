-- VoiceFlare, migration 005: block-by-block evacuation plans (an Order or Warning zone moves out in waves of blocks).
-- Run in the Supabase SQL editor AFTER schema.sql, 002 and 003. Safe to re-run. Additive only.
-- Without Supabase the app uses the local file store and needs none of this. Without this table the board still works:
-- plan reads come back empty and every Order call reads the full Order.

create table if not exists evac_plans (
  id uuid primary key,
  zone_id text not null,
  status text not null default 'proposed' check (status in ('proposed', 'standby', 'active', 'all_go', 'rejected', 'closed')),
  wave_minutes int not null default 10,
  current_wave int not null default 0,         -- 0 before the plan runs
  wave_started_at timestamptz,
  held boolean not null default false,         -- the next wave is held by a human (the wave going now keeps going)
  held_by text,
  held_reason text,
  routes jsonb not null default '[]',          -- exit roads: name, polyline, lanes, capacity (planning assumption)
  blocks jsonb not null default '[]',          -- blocks: id (SM-07), polygon, centroid, people and cars (estimates), road, wave, status
  waves jsonb not null default '[]',           -- per wave: planned and started times, cars per road
  templates jsonb not null default '{}',       -- the approved words: go_now, get_ready, all_go
  assumptions text,
  proposed_by text not null,
  approved_by text,                            -- the named human (null while proposed)
  approved_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists evac_plans_zone_idx on evac_plans (zone_id);
create index if not exists evac_plans_status_idx on evac_plans (status);

-- Same policy as the other board tables: browsers (anon key) may read; all writes go through server routes.
alter table evac_plans enable row level security;
drop policy if exists "anon read" on evac_plans;
create policy "anon read" on evac_plans for select using (true);
