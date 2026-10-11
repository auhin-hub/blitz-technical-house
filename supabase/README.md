# Supabase setup — MIST Blitz FS Workspace

The front-end is static (GitHub Pages); all shared state lives in Supabase
(Auth + Postgres + Storage). The project URL and **anon** key are committed in
`src/lib/supabase.ts` — that is intentional: the anon key is public by design and
security comes from **row-level security**, never key secrecy (BRIEF §J). The
**`service_role` key must never be committed or shipped to the browser.**

Project URL: `https://sfunpylcbaorbmgvlxpz.supabase.co`

## 1. Create the tables (one time)
Dashboard → **SQL Editor** → **New query** → paste and **Run** each migration in
order: `0001_master_store.sql`, `0002_storage_workbooks.sql`,
`0003_tool_state.sql`, `0004_freeze_and_log.sql`, `0005_tyre_storage.sql`,
`0006_resources.sql`, `0007_vehicle_spec_blank.sql`.

- `0001` creates `vehicle_spec`, `change_log`, `gates`, `tyre_results`, turns on
  RLS for all four, adds member-only policies, and seeds the 14 TOOL_SPECS §0
  parameters and the G0–G9 gates. Re-running is safe — the seed upserts.
- `0002` creates the **private `workbooks` storage bucket** and a members-only
  read policy.
- `0003` creates `tool_state` (each tool's shared inputs) and `tool_outputs`
  (ToMaster contributions) with member RLS.
- `0004` adds **freeze-and-log enforcement**: `edit_param()` (the only way to
  change a frozen parameter — requires a reason and writes a change_log row), a
  guard trigger that blocks any other frozen edit, and a freeze/unfreeze logger.
- `0005` creates the **private `tyre` bucket** (toolset archive + fit plots,
  members read + upload) and adds `author_email` to `tyre_results`. After
  running it, upload the toolset to Storage → `tyre` (the Tyre page's download
  button references `TTC_Tyre_Tool.rar` — rename there or in the page to match).
- `0006` creates `resource_folders` + `resources` (docs organised by system;
  entries are an uploaded file or a space-saving link) and the private
  `resources` bucket, and seeds one folder per discipline.
- `0007` **resets Vehicle Spec to the full blank parameter set** (MASTER_BUILD_PLAN
  §0/§4) — ~25 params, names/units/source only, no values. ⚠️ One-time: it clears
  any values currently in `vehicle_spec` (the team enters the new car in-app).

Verify: **Table editor → vehicle_spec** shows 14 rows; **gates** shows 10;
**Storage** lists a `workbooks` bucket marked *private*.

## 1b. Upload the workbooks (member-only downloads)
Everything downloadable sits **behind login** — nothing is served from the
public Pages site. Dashboard → **Storage → `workbooks`** → **Upload** the eight
`.xlsx` files, keeping their **exact filenames** (the download buttons reference
them by name):

```
Blitz_Aero_WorkingFile.xlsx          Blitz_Ergonomics_WorkingFile.xlsx
Blitz_Chassis_WorkingFile.xlsx       Blitz_Powertrain_WorkingFile.xlsx
Blitz_DAQ_Telemetry_WorkingFile.xlsx Blitz_Vehicle_Dynamics_WorkingFile.xlsx
Blitz_Electronics_WorkingFile.xlsx   MIST_Blitz_FS_Master_Workbook.xlsx
```

The site's “Download original workbook (.xlsx)” buttons mint a 60-second signed
URL via the signed-in member's session. The **tyre toolset `.rar`** will use the
same private-bucket model when the Tyre page is built (step 4) — not a public
GitHub Release, since it must stay behind login too.

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

## 5. Migrations added after the first release

Run them in order; each is idempotent and safe to re-run.

| Migration | What it adds | If you skip it |
|---|---|---|
| `0007_vehicle_spec_blank` | the Master starts blank | old inherited numbers linger |
| `0008_promote_keys` | `text_value` + `edit_param_text()` + promoted rules/procurement keys | the Master loads in legacy mode and every page shows an amber banner |
| `0009_mu_long` | `mu_long_peak` | traction and brake cases keep using the lateral μ (the old behaviour) |
| `0010_realtime` | realtime publication + `replica identity full` | no live updates; refresh to see a teammate's work |
| `0011_roles` | `members`, `is_lead()`, lead-only gates/freezes | governance stays advisory: anyone can freeze or sign off |
| `0012_snapshots` | `spec_snapshots` | `/snapshots` cannot save a baseline |
| `0013_taskmap` | the Task Map tables (buckets, phases, loops, activities, dependencies) | `/taskmap` says the tables are missing and offers nothing else |

**After `0011`:** sign in and set yourself to **lead** on **Gates → Members**.
While no lead exists every member has lead rights, so nothing is locked out — but
nothing is protected either.

## Freeze enforcement (BRIEF §E5) — done

`0004` added the guard trigger and `edit_param()`; `0008` extended both to text
values; `0011` restricted a frozen edit to leads. A frozen `vehicle_spec` value
can only change through `edit_param`/`edit_param_text`, which require a reason and
write a `change_log` row — any other path raises.
