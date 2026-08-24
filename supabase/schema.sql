-- =============================================================================
--  ASHOKA POKEDEX — Supabase schema
--  Run once in the Supabase SQL editor (Dashboard -> SQL -> New query).
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
--  creatures
-- -----------------------------------------------------------------------------
create table if not exists public.creatures (
  id               uuid primary key default gen_random_uuid(),
  dex_number       integer unique,          -- assigned at approval, null while pending
  name             text not null,
  title            text default '',
  types            text[] default '{}',
  rarity           text not null default 'COMMON',
  habitat          text default '',
  batch            text default '',
  characteristics  text[] default '{}',
  entry            text default '',
  quote            text default '',
  stats            jsonb default '{}'::jsonb,
  sprite_url       text not null,
  photo_url        text default '',
  status           text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected')),
  submitted_by     text default '',
  votes            jsonb default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  approved_at      timestamptz
);

create index if not exists creatures_status_idx on public.creatures (status);
create index if not exists creatures_dex_number_idx on public.creatures (dex_number);

-- -----------------------------------------------------------------------------
--  sightings — one row per (creature, device). No accounts, just device ids.
-- -----------------------------------------------------------------------------
create table if not exists public.sightings (
  creature_id  uuid not null references public.creatures (id) on delete cascade,
  device_id    text not null,
  created_at   timestamptz not null default now(),
  primary key (creature_id, device_id)
);

create index if not exists sightings_device_idx on public.sightings (device_id);

-- -----------------------------------------------------------------------------
--  Row level security
--
--  The app NEVER talks to Supabase from the browser — every read and write goes
--  through a Next.js route handler using the service role key, which bypasses
--  RLS. So we enable RLS and grant nothing: if the anon key ever leaks, it can
--  read and write nothing at all.
-- -----------------------------------------------------------------------------
alter table public.creatures enable row level security;
alter table public.sightings enable row level security;

-- (Deliberately no policies. Deny-by-default.)

-- -----------------------------------------------------------------------------
--  Storage bucket for sprites + photos
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('dex-media', 'dex-media', true)
on conflict (id) do nothing;

-- Public read so <img src> works; writes still require the service role.
drop policy if exists "dex media public read" on storage.objects;
create policy "dex media public read"
  on storage.objects for select
  using (bucket_id = 'dex-media');
