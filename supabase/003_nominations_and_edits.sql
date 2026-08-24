-- =============================================================================
--  ASHOKA POKEDEX — migration 003: trainer nominations, admin edits
--
--  Two additions to `creatures`:
--
--   * submitted_by_role — trainers can now nominate people into the same queue
--     admins capture into, so the queue needs to say which of the two an entry
--     came from. Existing rows predate nominations and were all admin catches,
--     hence the 'admin' default.
--
--   * updated_at — admins can rewrite an entry after the fact, and the archive
--     shows which entries have been touched since capture. NULL means untouched.
--
--  Roles themselves need no migration: accounts.role already exists, and the
--  app now reads it on every request instead of trusting the session cookie,
--  so a promotion or demotion takes effect immediately.
--
--  Run once in the Supabase SQL editor. Safe to re-run.
-- =============================================================================

alter table public.creatures
  add column if not exists submitted_by_role text not null default 'admin'
  check (submitted_by_role in ('admin', 'public'));

alter table public.creatures
  add column if not exists updated_at timestamptz;

-- The queue is read by status constantly; nominations make that hotter.
create index if not exists creatures_submitted_by_idx on public.creatures (submitted_by);
