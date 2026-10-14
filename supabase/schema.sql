-- =============================================================================
--  DEX — full schema (multi-tenant)
--
--  Run once in the Supabase SQL editor on a fresh project. Safe to re-run.
--
--  Shape of the thing:
--    accounts     one login per person, global across every dex
--    dexes        one per community; owns its own vocabulary and codes
--    memberships  which accounts are in which dex, and as what
--    creatures    entries, always scoped to a dex
--    sightings    who has seen whom, scoped by the creature's dex
--
--  Nothing here is reachable with a publishable key — see the RLS note at the
--  bottom. Every read and write goes through a Next.js route handler using the
--  service role key.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
--  accounts — global identity
-- -----------------------------------------------------------------------------
create table if not exists public.accounts (
  id             uuid primary key default gen_random_uuid(),
  username       text not null,
  password_hash  text not null,
  email          text,
  alerts         boolean not null default true,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz
);

-- Usernames and emails are case-insensitive.
create unique index if not exists accounts_username_lower_idx
  on public.accounts (lower(username));

create unique index if not exists accounts_email_lower_idx
  on public.accounts (lower(email))
  where email is not null and email <> '';

-- -----------------------------------------------------------------------------
--  dexes — one per community
--
--  `config` holds the owner's constraints: types, habitats, stats, the rarity
--  ladder, approval count. It is user-authored JSON and is NEVER trusted on
--  read — src/lib/dexConfig.ts normalises every load. Storing it as jsonb
--  rather than a dozen side tables is deliberate: the whole point is that an
--  owner can invent vocabulary we never anticipated.
-- -----------------------------------------------------------------------------
create table if not exists public.dexes (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null,
  name         text not null,
  tagline      text default '',
  owner_id     uuid not null references public.accounts (id) on delete cascade,
  config       jsonb not null default '{}'::jsonb,

  -- Short codes, shared out of band. They gate who may JOIN, not who may act —
  -- authority comes from the membership row once someone is in.
  admin_code   text not null,
  member_code  text not null,

  -- Whether the dex is listed anywhere public. Off by default: a dex of real
  -- people should be discoverable only by someone holding a code.
  listed       boolean not null default false,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);

create unique index if not exists dexes_slug_lower_idx on public.dexes (lower(slug));
create index if not exists dexes_owner_idx on public.dexes (owner_id);

-- -----------------------------------------------------------------------------
--  memberships — who is in which dex, and as what
--
--  'owner'  exactly one per dex; can edit config and delete the dex
--  'admin'  can capture entries and vote on the queue
--  'member' can browse, mark sightings, and nominate if the config allows
-- -----------------------------------------------------------------------------
create table if not exists public.memberships (
  dex_id      uuid not null references public.dexes (id) on delete cascade,
  account_id  uuid not null references public.accounts (id) on delete cascade,
  role        text not null check (role in ('owner', 'admin', 'member')),
  joined_at   timestamptz not null default now(),
  primary key (dex_id, account_id)
);

create index if not exists memberships_account_idx on public.memberships (account_id);
create index if not exists memberships_dex_role_idx on public.memberships (dex_id, role);

-- -----------------------------------------------------------------------------
--  creatures — entries, scoped to a dex
-- -----------------------------------------------------------------------------
create table if not exists public.creatures (
  id                uuid primary key default gen_random_uuid(),
  dex_id            uuid not null references public.dexes (id) on delete cascade,

  -- Assigned at approval, and only unique WITHIN a dex: every dex starts at 001.
  dex_number        integer,

  name              text not null,
  title             text default '',
  types             text[] default '{}',
  habitat           text default '',
  cohort            text default '',
  characteristics   text[] default '{}',
  entry             text default '',
  quote             text default '',
  stats             jsonb default '{}'::jsonb,
  sprite_url        text not null,
  photo_url         text default '',

  status            text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
  submitted_by      text default '',
  submitted_by_role text not null default 'admin'
                    check (submitted_by_role in ('admin', 'member')),
  votes             jsonb default '[]'::jsonb,

  -- Highest tier already announced, so a recount doesn't re-announce. Rarity
  -- itself is computed at read time and never stored.
  notified_rarity   text,

  created_at        timestamptz not null default now(),
  approved_at       timestamptz,
  updated_at        timestamptz
);

create unique index if not exists creatures_dex_number_idx
  on public.creatures (dex_id, dex_number)
  where dex_number is not null;

create index if not exists creatures_dex_status_idx on public.creatures (dex_id, status);
create index if not exists creatures_submitted_by_idx on public.creatures (dex_id, submitted_by);

-- -----------------------------------------------------------------------------
--  sightings — one row per (creature, account)
-- -----------------------------------------------------------------------------
create table if not exists public.sightings (
  creature_id  uuid not null references public.creatures (id) on delete cascade,
  account_id   uuid not null references public.accounts (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (creature_id, account_id)
);

create index if not exists sightings_account_idx on public.sightings (account_id);

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

-- -----------------------------------------------------------------------------
--  Row level security
--
--  Enabled with NO policies, on purpose. The browser never talks to Supabase
--  directly: every read and write goes through a route handler holding the
--  service role key, which bypasses RLS. Deny-by-default means a leaked
--  publishable key reaches nothing — which matters most for accounts, where
--  the password hashes live.
-- -----------------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.dexes enable row level security;
alter table public.memberships enable row level security;
alter table public.creatures enable row level security;
alter table public.sightings enable row level security;

-- (Deliberately no policies.)
