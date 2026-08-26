# Ashoka Pokedex

A field guide to the creatures of Ashoka University. Pixel-art Pokedex interface,
gated by access code, with an admin capture flow and a two-admin approval queue.

Lives at: **primafacie.in**

---

## How it works

Everyone has a **username and password account**. The access code is not a login —
it is the invitation that lets you *create* an account, and it decides what kind:

| Env var | Creates | Can do |
|---------|---------|--------|
| `PUBLIC_CODE` | Trainer | Browse the approved dex, open entries, mark who they've seen, nominate people into the queue |
| `ADMIN_CODE` | Admin | Everything above, plus capture entries, vote on the queue, edit anything, and manage accounts |

The two codes **must be different**. The admin code is tested first, so setting
both to the same value quietly makes every sign-up an admin; the server logs a
warning saying so. If you are unsure which one an account got, the dex header
says `ADMIN · NAME` or `TRAINER · NAME`.

After sign-up you only ever need your username and password; the code is never
asked for again. Usernames are case-insensitive. Passwords are hashed with
scrypt from the Node standard library (`src/lib/password.ts`) — never stored in
plain text, never returned by any endpoint.

The actual codes live in the environment and are **not in this repo** — it's
public. There are no fallback values in the source: if the vars are unset, every
code is refused.

Admins pick a **handle** when they enter (e.g. `ANSHUL`). It signs their votes.

**The approval loop**

1. Someone photographs a person and fills in their entry → status `pending`.
   Trainers do this from the **NOMINATE** tab in the dex, admins from the admin
   terminal — though admins get the NOMINATE tab too, since needing to walk over
   to the terminal to add someone you just met is silly. Every route into the
   queue faces the same bar.
2. Every *other* admin sees it in the approval queue. You cannot vote on your own catch.
3. Once **2 different admins** approve, it's assigned the next dex number and
   appears in the public dex. 2 rejections kill it instead.

Change the threshold with `REQUIRED_APPROVALS` in the environment.

Trainers may have **3 nominations open at a time** (`MAX_OPEN_NOMINATIONS` in
`src/lib/constants.ts`) so one bored person can't bury the queue; the cap frees
up as each one is resolved. The **MY NOMINATIONS** list shows a trainer how far
each of theirs got — the vote count, never who cast which vote.

**What an admin can do**

- **Vote** on anyone else's submission, as before.
- **FORCE IN** — resolve a pending entry on one admin's say-so, without waiting
  for the quorum. It skips the count, not the conflict of interest: you still
  cannot force in your own catch, because that rule is the only thing keeping
  the queue honest. Forced votes are recorded as `forced` in the vote history.
- **Edit any entry**, live or pending, including replacing the photo. Entries
  are about real people; getting one wrong should be a ten-second fix.
- **Move an entry between states** from the ARCHIVE tab: pull a live entry back
  into the queue (votes cleared, dex number held in reserve so re-approval
  restores the same number), put a pending one straight in, or take one down.
- **Manage accounts** from the TRAINERS tab: promote a trainer to admin, demote
  an admin, or delete an account (which takes its sightings with it, and so
  moves rarity). Never on your own account — locking yourself out of your own
  terminal is the one mistake nobody else can undo for you.

Role changes take effect **immediately**. The session cookie says which account
is asking, and every request looks up that account's current role in the
database, so a demoted admin cannot keep using the terminal on the strength of
a cookie issued before the demotion, and a deleted account is signed out on its
next click.

**Rarity is earned, never assigned.** Admins do not pick a rarity. Everyone enters
the dex as `UNCOMMON` and climbs as more of the campus reports seeing them,
measured as a share of everyone with an account. So rarity here means notoriety,
not scarcity.

| Tier | Share of players | Min sightings |
|------|------------------|---------------|
| `UNCOMMON` | — | — |
| `RARE` | 15% | 3 |
| `EPIC` | 30% | 5 |
| `LEGENDARY` | 50% | 8 |
| `MYTHIC` | 75% | 12 |

A tier needs *both* conditions, so the first two people on the platform can't
crown each other MYTHIC on day one. Thresholds scale as the dex grows: at 10
players LEGENDARY takes 8 sightings, at 40 players it takes 20. The ladder lives
in `src/lib/constants.ts` (`RARITY_LADDER`) and the maths in `src/lib/rarity.ts`.

**Seen tracking** belongs to your account, so your progress follows you between
your phone and your laptop.

**Email alerts** go out when a new entry clears the queue and when someone
already in the dex climbs a rarity tier. They are opt-in and off by default:
an address is optional at sign-up and can be added or removed later under
**ALERTS**, and nothing is sent to anyone who has not given one. Every message
carries a one-click unsubscribe link, which needs no session — the signed token
in it can do nothing except switch that one account's alerts off.

Sending goes through [Resend](https://resend.com) and is entirely optional: with
`RESEND_API_KEY` or `RESEND_FROM` unset the dex behaves exactly as it did before
alerts existed, and the settings panel says so rather than promising mail it
cannot send.

Because rarity is computed from sightings rather than stored, an entry would
otherwise be re-announced on every recount. `creatures.notified_rarity` records
the tier an entry has already been announced at, is set when it is approved, and
only ever climbs — so each tier fires at most one email, ever.

One thing to size before you switch it on: an alert is sent to *everyone* with
an address, so a dex with 200 subscribers spends 200 sends per event. Resend's
free tier is 100 emails a day and 3,000 a month.

**The hall of fame** ranks trainers by how much of the dex they have filled in,
with contributions breaking ties, and ranks entries by how much of campus has
actually seen them. It is aggregates only: the board says how many entries a
trainer has ticked off, never which ones. Opening a trainer shows their rank,
completion and the catches of theirs that made it in — entries also carry a
visible **CAUGHT BY** credit on the detail card.

**Browsing.** Search covers names, titles, habitats, traits and the submitter.
Filter by rarity, type, habitat and batch; sort by dex number, most seen, newest
or A→Z. The grid is walkable with the arrow keys (Enter opens), and once an
entry is open, ← and → step through the rest of the filtered list.

**Photos** are crushed to a 160×160 colour-quantised sprite in the browser before
upload. The sprite is what the dex shows; the full photo is kept alongside it and
revealed with `VIEW PHOTO` on the detail card.

**Framing.** A zoom slider under the viewfinder crops into the centre of the
frame, up to 3× — enough to pull one face out of a group shot. It moves the live
preview so what you frame is what you get, and it keeps working *after* the
shutter: the full frame is retained and the crop is applied on the way out, so
you can re-frame as many times as you like without losing anything or asking
someone to pose again. The same control appears when an admin replaces a photo
from the editor. It is digital, not the camera's own zoom, which is why it is
capped where the stored photo still holds up.

---

## Run it locally

```bash
npm install
cp .env.local.example .env.local
# then set ADMIN_CODE and PUBLIC_CODE in .env.local to whatever you want
npm run dev
```

Open http://localhost:3000 and enter your admin code.

With `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` blank, the app runs
on a **local JSON store** at `.data/` (git-ignored) with images on disk. Zero
infra, good for trying it out. It is single-machine only — for the real thing,
set up Supabase.

---

## Deploy to primafacie.in

The Pokedex **takes over the apex domain**. The existing Prima Facie dating app
stops being served there — see the warning at the end of this section.

**1. Supabase**

- Create a project, then run [`supabase/schema.sql`](supabase/schema.sql),
  [`supabase/002_accounts.sql`](supabase/002_accounts.sql) and
  [`supabase/003_nominations_and_edits.sql`](supabase/003_nominations_and_edits.sql)
  and [`supabase/004_email_alerts.sql`](supabase/004_email_alerts.sql)
  in the SQL editor, in that order. They create both tables, lock them with
  deny-by-default RLS, and create the public `dex-media` storage bucket.
  All of them are safe to re-run — an existing deployment needs 003 and 004.
- Copy the project URL and the **secret** key from Settings → API Keys →
  Secret keys (`sb_secret_…`; on older projects, the `service_role` JWT).
  Not the publishable/anon key — the app never uses it, and the deny-by-default
  RLS above means it can read and write nothing.

Use a *new* Supabase project, not the dating app's. They share nothing.

**2. Push this repo to GitHub**, then import it in Vercel as a new project.

**3. Vercel environment variables** (Project → Settings → Environment Variables):

| Key | Value |
|-----|-------|
| `ADMIN_CODE` | your admin code |
| `PUBLIC_CODE` | your trainer code |
| `SESSION_SECRET` | `openssl rand -hex 32` — **must** be set in production |
| `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the **secret** key `sb_secret_…` (server-only, never `NEXT_PUBLIC_`) |
| `SUPABASE_STORAGE_BUCKET` | `dex-media` |
| `REQUIRED_APPROVALS` | `2` |
| `NEXT_PUBLIC_SITE_URL` | `https://primafacie.in` |
| `RESEND_API_KEY` | optional — from resend.com/api-keys, enables email alerts |
| `RESEND_FROM` | optional — e.g. `Ashoka Pokedex <dex@primafacie.in>`, on a domain verified in Resend |

**4. Move the domain.** Vercel will not let two projects claim the same domain,
so the order matters:

1. Old Prima Facie project → Settings → Domains → **remove** `primafacie.in`
   (and `www.primafacie.in`).
2. This project → Settings → Domains → **add** `primafacie.in`, and add
   `www.primafacie.in` set to redirect to the apex.

If DNS already points at Vercel, that's the whole job — no DNS edit needed, and
the switch is near-instant. If you're starting from scratch, the apex record is:

```
A       @      76.76.21.21
CNAME   www    cname.vercel-dns.com.
```

(Vercel shows the exact values in the Domains tab — prefer those over these.)

**5. Verify** `https://primafacie.in` serves the code gate, and that the old
`/apply` and `/sign-in` routes now 404. Paste the link into a chat to check the
share preview renders.

> **Before you flip it.** Taking the apex means anyone the dating app already
> accepted loses their sign-in page — their accounts and data stay in that
> Supabase project untouched, but the URL they were told to visit stops working.
> If you ever want it back, keep the old Vercel project (just without the
> domain) rather than deleting it; re-adding the domain restores it in a minute.

---

## What the access codes are and are not

The codes gate *access*, not *secrets*. They're a shared 4-digit number that will
end up in a group chat — treat this as a fun campus wall, not a private system.
What the codes do enforce properly:

- They're checked server-side only and never ship in the client bundle.
- Sessions are HMAC-signed httpOnly cookies, so a trainer can't promote
  themselves to admin by editing storage.
- Every route re-checks the role server-side, against the account row rather
  than the cookie, so roles can be changed and revoked while people are signed in.
- With RLS deny-by-default, the database is unreachable except through the app.

Nominations widen who can *submit*, not who can *publish*: a trainer's entry is
invisible until admins approve it, exactly like an admin's own catch.

Because it's a dex of real people, `DELETE` on any entry is always available to
admins — if someone wants off the wall, take them off.

---

## Layout

```
src/
  app/
    page.tsx              access-code gate
    dex/                  public dex, hall of fame, trainer nominations
    admin/                capture, approval queue, archive, account management
    api/
      session/            sign up / sign in -> signed cookie
      creatures/          list / create, [id] edit + delete, [id]/vote
      accounts/[id]/      promote, demote, delete an account
      alerts/             your own email settings, and one-click unsubscribe
      leaderboard/        trainer standings for the hall of fame
      sightings/          per-account seen marks
      upload/             sprite + photo -> storage
      media/[file]/       serves images on the local backend
  components/             Shell, Gate, DexView, HallOfFame, Nominate,
                          AdminView, AdminArchive, AdminTrainers,
                          Capture, EntryFields, EditEntry, CreatureDetail
  lib/
    constants.ts          rarities, types, habitats, stats — edit to re-flavour
    store.ts              Supabase / local-JSON storage adapter
    auth.ts               who is asking, read from the account row every request
    session.ts            code check + cookie signing
    creatureInput.ts      whitelisting for everything a client can set
    mail.ts               Resend transport — a no-op when unconfigured
    notify.ts             what an approval and an evolution actually say
    pixelate.ts           photo -> quantised sprite
supabase/schema.sql
```

Re-flavouring the game (type names, habitats, rarity tiers, stat labels) is all
in `src/lib/constants.ts`.
