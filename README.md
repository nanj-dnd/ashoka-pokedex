# Ashoka Pokedex

A field guide to the creatures of Ashoka University. Pixel-art Pokedex interface,
gated by access code, with an admin capture flow and a two-admin approval queue.

Lives at: **primafacie.in**

---

## How it works

Anyone can sign up and **make their own dex**. An account is global — one
username and password across the whole deployment — and getting into a
particular dex happens with that dex's own code.

| | |
|---|---|
| **owner** | Made the dex. Sets the constraints, holds the codes, can delete it. |
| **admin** | Captures entries and votes on the approval queue. |
| **member** | Browses, marks sightings, and nominates if the owner allows it. |

Each dex generates two four-digit codes on creation. The member code gets you
in; entering the admin code promotes you. Codes decide who may *join* — once
you are in, authority comes from your membership row, so changing a code locks
out future joiners without touching anyone already inside.

Passwords are hashed with scrypt from the Node standard library
(`src/lib/password.ts`) — never stored in plain text, never returned by any
endpoint. Wrong password and unknown username return the same message, so
usernames cannot be enumerated.

### Constraints are per dex

Everything that makes a dex *that community's* dex is owner-editable at
`/d/<slug>/settings` and stored as JSON on the dex row:

- **types** — personality archetypes, each with a colour and a one-line hint
- **habitats** — where entries are usually found
- **stats** — six bars, renamable; the stored key survives a rename
- **rarity ladder** — tier names, colours, and both thresholds
- **approvals** — how many distinct admins promote an entry (1–5)
- **nouns** — what an entry is called, singular and plural
- an optional **extra field** (batch, team, company) with fixed options or free text

Stored config is **never trusted on read**. `src/lib/dexConfig.ts` normalises
every load: labels are uppercased and de-duplicated, bad colours replaced,
stats padded to exactly six, the rarity ladder sorted with its bottom rung
forced to be reachable, and numbers clamped. A malformed row degrades to a
working dex rather than crashing one.

Three presets to start from: **campus** (the original), **event** (conference
networking, where attendees add themselves) and **blank**.

**Rarity is earned, never assigned.** Everyone enters at the bottom rung and
climbs as more of *that dex's* members report seeing them. A tier needs both a
share of the membership and a floor of raw sightings — without the floor, the
first two people in a new dex would crown each other immediately.

## The design kit

The 8-bit look is extracted as a standalone, dependency-free stylesheet so
other people can build their own dex without forking the whole app.

- **Live showcase:** [primafacie.in/kit](https://primafacie.in/kit) — every
  component with copy-paste markup
- **The file:** [`public/kit/pokedex.css`](public/kit/pokedex.css) — ~780 lines,
  no build step, no framework. `<link>` it and write plain HTML.

Recolour the whole thing by overriding the variables in `:root`. `--px` (4px) is
the offset every frame is built from; raise it and the entire UI gets chunkier.

The one rule the kit exists to enforce: **no blur, ever.** No `border-radius`,
no soft shadows, no gradients on small elements, no antialiased text. Depth is
hard 4px offsets in flat black. The moment something blurs it stops reading as a
handheld and starts reading as a web app.

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
