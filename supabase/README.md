# Supabase setup — MIST Blitz FS Workspace

The front-end is static (GitHub Pages); all shared state lives in Supabase
(Auth + Postgres + Storage). The project URL and **anon** key are committed in
`src/lib/supabase.ts` — that is intentional: the anon key is public by design and
security comes from **row-level security**, never key secrecy (BRIEF §J). The
**`service_role` key must never be committed or shipped to the browser.**

Project URL: `https://sfunpylcbaorbmgvlxpz.supabase.co`

## 1. Create the tables (one time)
Dashboard → **SQL Editor** → **New query** → paste the whole of
`supabase/migrations/0001_master_store.sql` → **Run**.

This creates `vehicle_spec`, `change_log`, `gates`, `tyre_results`, turns on RLS
for all four, adds member-only policies, and seeds the 14 TOOL_SPECS §0
parameters and the G0–G9 gates. Re-running is safe — the seed upserts.

Verify: **Table editor → vehicle_spec** shows 14 rows; **gates** shows 10.

## 2. Make auth invite-only
Dashboard → **Authentication**:
- **Providers → Email**: enabled. Magic link is on by default (no password needed).
- **Sign-ups**: turn **off** public sign-up (Authentication → *Providers/Settings*,
  "Allow new users to sign up" → off). The login form also sends
  `shouldCreateUser: false`, so an un-invited address gets no account either way.
- **Invite members**: Authentication → **Users → Invite user** (enter their email).

## 3. Allow the redirect URLs
Dashboard → **Authentication → URL Configuration** → **Redirect URLs**, add:
- `http://localhost:4321/blitz-technical-house/auth/callback` (local dev)
- `https://auhin-hub.github.io/blitz-technical-house/auth/callback` (Pages)

Set **Site URL** to the Pages URL. Add the custom-domain callback later when you
move domains (base-aware paths mean no code change).

## 4. Free-tier caveats (baked into the plan, BRIEF §C)
- A free project **pauses after ~7 days idle** — un-pause with one click in the
  dashboard.
- **No automatic backups** — so the Excel Master stays the authoritative archive;
  export a snapshot of `vehicle_spec` periodically.

## Deferred to the Gates/freeze step (BRIEF §E5)
A trigger that **requires a `change_log` row when a frozen parameter is edited**.
The tables and columns are already shaped for it; it is added when Gates is built.
