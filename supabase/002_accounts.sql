-- =============================================================================
--  ASHOKA POKEDEX — migration 002: real accounts
--
--  Adds username/password accounts. The access code is no longer the login —
--  it is now only the invitation that lets you CREATE an account, and it
--  decides whether that account is an admin or a trainer.
--
--  Sightings move from anonymous device ids to accounts, which also makes the
--  "share of players" denominator honest.
--
--  Run once in the Supabase SQL editor. Safe to re-run.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
--  accounts
-- -----------------------------------------------------------------------------
create table if not exists public.accounts (
  id             uuid primary key default gen_random_uuid(),
  username       text not null,
  password_hash  text not null,
  role           text not null check (role in ('admin', 'public')),
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz
);

-- Usernames are case-insensitive: "Anshul" and "anshul" are the same person.
create unique index if not exists accounts_username_lower_idx
  on public.accounts (lower(username));

-- -----------------------------------------------------------------------------
--  sightings, re-keyed from device_id to account_id
-- -----------------------------------------------------------------------------
drop table if exists public.sightings;

create table public.sightings (
  creature_id  uuid not null references public.creatures (id) on delete cascade,
  account_id   uuid not null references public.accounts (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (creature_id, account_id)
);

create index if not exists sightings_account_idx on public.sightings (account_id);

-- -----------------------------------------------------------------------------
--  RLS: deny-by-default, same as everything else. Only the service role (used
--  exclusively server-side) touches these tables. Password hashes must never be
--  reachable with a publishable key.
-- -----------------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.sightings enable row level security;

-- (Deliberately no policies.)
