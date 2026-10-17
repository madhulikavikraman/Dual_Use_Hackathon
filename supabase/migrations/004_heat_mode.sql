-- VoiceFlare, migration 004: the heat check-in line (heat mode and the "heat" scenario replace campus mode and "usc").
-- Run in the Supabase SQL editor AFTER schema.sql, 002_second_key.sql and 003_live_location.sql. Safe to re-run.
-- Additive only: 'campus' stays allowed so rows written before this migration still pass the check.
-- Without Supabase the app uses the local file store and needs none of this.

-- Campaign mode: add 'heat'.
alter table campaigns drop constraint if exists campaigns_mode_check;
alter table campaigns add constraint campaigns_mode_check check (mode in ('civilian', 'campus', 'heat', 'base'));

-- Heat zones: the live reading at the zone centre (Open-Meteo), any active NWS alert there, and the labeled
-- simulated heat wave the demo uses when live conditions are below the thresholds (lib/types.ts ZoneWeather).
alter table zones add column if not exists weather jsonb;

-- Older residents on the heat line: age band, lives alone, no air conditioning (enum-like flags, never a diagnosis).
alter table households add column if not exists heat_profile jsonb;
