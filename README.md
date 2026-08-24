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
| `PUBLIC_CODE` | Trainer | Browse the approved dex, open entries, mark who they've seen |
| `ADMIN_CODE` | Admin | Everything above, plus capture new entries and vote on the queue |

After sign-up you only ever need your username and password; the code is never
asked for again. Usernames are case-insensitive. Passwords are hashed with
scrypt from the Node standard library (`src/lib/password.ts`) — never stored in
plain text, never returned by any endpoint.

The actual codes live in the environment and are **not in this repo** — it's
public. There are no fallback values in the source: if the vars are unset, every
code is refused.

Admins pick a **handle** when they enter (e.g. `ANSHUL`). It signs their votes.

**The approval loop**

1. An admin photographs someone and fills in their entry → status `pending`.
2. Every *other* admin sees it in the approval queue. You cannot vote on your own catch.
3. Once **2 different admins** approve, it's assigned the next dex number and
   appears in the public dex. 2 rejections kill it instead.

Change the threshold with `REQUIRED_APPROVALS` in the environment.

**Rarity is earned, never assigned.** Admins do not pick a rarity. Everyone enters
the dex as `UNCOMMON` and climbs as more of the campus reports seeing them,
measured as a share of the *active* player base (distinct devices that have
marked at least one sighting). So rarity here means notoriety, not scarcity.

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

**Photos** are crushed to a 96×96 colour-quantised sprite in the browser before
upload. The sprite is what the dex shows; the full photo is kept alongside it and
revealed with `VIEW PHOTO` on the detail card.

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

- Create a project, then run [`supabase/schema.sql`](supabase/schema.sql) and
  [`supabase/002_accounts.sql`](supabase/002_accounts.sql) in the SQL editor. It creates both tables, locks them with deny-by-default RLS, and
  creates the public `dex-media` storage bucket.
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
- Every write route re-checks the role server-side.
- With RLS deny-by-default, the database is unreachable except through the app.

Because it's a dex of real people, `DELETE` on any entry is always available to
admins — if someone wants off the wall, take them off.

---

## Layout

```
src/
  app/
    page.tsx              access-code gate
    dex/                  public dex
    admin/                capture + approval queue
    api/
      session/            redeem code -> signed cookie
      creatures/          list / create / [id]/vote
      sightings/          per-device seen marks
      upload/             sprite + photo -> storage
      media/[file]/       serves images on the local backend
  components/             Shell, Gate, DexView, AdminView, Capture, CreatureDetail
  lib/
    constants.ts          rarities, types, habitats, stats — edit to re-flavour
    store.ts              Supabase / local-JSON storage adapter
    session.ts            code check + cookie signing
    pixelate.ts           photo -> 96x96 quantised sprite
supabase/schema.sql
```

Re-flavouring the game (type names, habitats, rarity tiers, stat labels) is all
in `src/lib/constants.ts`.
