-- =============================================================================
--  ASHOKA POKEDEX — migration 004: email alerts
--
--  Accounts gain an optional email address. It is opt-in by construction:
--  everyone who signed up before this migration has no email, and so gets no
--  mail until they add one.
--
--  creatures.notified_rarity records the highest tier an entry has already been
--  announced at. Rarity is computed at read time and moves whenever someone
--  marks a sighting, so without this an entry would be re-announced on every
--  recount. It is set at approval time and then only ever climbs.
--
--  Run once in the Supabase SQL editor. Safe to re-run.
-- =============================================================================

alter table public.accounts add column if not exists email text;

-- Whether this account wants the mail at all. Meaningless without an email,
-- but kept separate so unsubscribing doesn't throw the address away.
alter table public.accounts add column if not exists alerts boolean not null default true;

alter table public.creatures add column if not exists notified_rarity text;

-- One address per person, case-insensitively, so a resend can't be doubled up.
-- Partial: NULL emails are the norm and must not collide with each other.
create unique index if not exists accounts_email_lower_idx
  on public.accounts (lower(email))
  where email is not null and email <> '';
