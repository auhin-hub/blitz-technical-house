# MIST Blitz FS Workspace — Guidebook

The complete guide to the team's engineering workspace: what it does, how to use
every feature, how it works under the hood, its limits, and how to extend it.

**Live site:** https://auhin-hub.github.io/blitz-technical-house/
**Audience:** MIST Blitz members (users) + whoever maintains or extends the site.

> This is an internal, members-only tool. It is not indexed and not meant to be
> shared outside the team. It is a faithful **web re-creation** of the
> `MIST_Blitz_FS_Master_Workbook.xlsx` set — the original Excel remains the
> authoritative archive.

---

## Part 1 — For members (using the site)

### 1.1 What this is
One site that brings every subteam's calculators together, backed by a single
shared set of car parameters (the **Master**). Enter a number once in **Vehicle
Spec** and every tool that uses it reads the same value — no more "which
spreadsheet has the right mass?". It also tracks design **gates**, enforces
**freezes** with a change log, hosts the **tyre** toolset + results, and keeps
**reference docs** in one place.

### 1.2 Getting in (sign-in)
- Access is **invite-only**. An admin adds your email in Supabase; you can't
  self-register.
- Go to the site → you'll land on **Sign in**. Enter your team email → **Send
  magic link**.
- Check your email (and spam — the free mailer is rate-limited to a few/hour),
  click the link, and you're in. No password to remember.
- **Sign out** is in the top-right of the nav once you're signed in.

### 1.3 Finding your way around
- **Home** is a grid of six **discipline** cards (Vehicle Dynamics, Powertrain,
  Electronics, Chassis, Aerodynamics, Ergonomics). Click one to open its tools.
- The **top nav** carries the cross-cutting pages: Home · Vehicle Spec · Tyre ·
  Gates/Phases · Resources · Change Log. The logo returns Home.
- On a phone, the nav collapses behind the **☰ menu** button.
- The **sun/moon** button toggles light ("blueprint") and dark ("night-shift").

### 1.4 The colour legend (used everywhere)
Carried over from the workbook so a field's colour tells you what it is:
- **Blue = input** — you type it. It's yours (well, the team's — see 1.6).
- **Green = linked** — pulled live from the Master (read-only in the tool). Edit
  it in **Vehicle Spec**, not here.
- **Black = computed** — a formula output. Read-only; it recalculates live.

### 1.5 Vehicle Spec — the shared Master (the backbone)
This is the one live set of canonical car numbers (mass, CoG, wheelbase, tracks,
tyre μ, etc. — 14 parameters from the workbook's Master/MassBudget/Tyre sheets).
- **Edit** a blue/green value → it saves for the **whole team**.
- **Axle loads** are computed (black) from mass × g × mass-fraction and update
  the moment you change mass or front mass fraction.
- **Freeze** a parameter at a gate: tick its **Freeze** box (pick the gate in the
  "Freeze at" dropdown). A frozen value is locked.
- **Editing a frozen value** then asks you for a **reason** and records the change
  in the **Change Log** — this is enforced, you can't skip it.
- **Download master workbook (.xlsx)** button fetches the original Excel (behind
  login) for archiving/cross-check.

### 1.6 How "shared" works (important)
Every editable field — Vehicle Spec values **and** each tool's own inputs — is
**shared across the team**, mirroring the fact that each subteam has one working
file. If you change a brake pedal ratio, the next member sees your value. Changes
save automatically (you'll see "Saved ✓"). **They are not real-time**: another
member sees your change when they next load or refresh the page.

### 1.7 The discipline tools
Open a discipline page to see its tools. Each tool shows **From Master** (green,
read-only), **Inputs** (blue, editable, team-shared), **Outputs** (black,
computed live), sometimes a **chart**, and often a **Contribute to Master**
button that writes that tool's results back to the shared store. Every tool was
ported directly from the real workbook formula-by-formula, and each cites its
`TOOL_SPECS` section.

| Discipline | Tools |
|---|---|
| **Vehicle Dynamics** | Setup/kinematics · Suspension geometry (+ hardpoint table to freeze at G3) · Springs & dampers (ride-frequency sizing) · Suspension loads (pushrod/wishbone + anti-dive/squat) · Steering (Ackermann + rack&pinion) · Brakes (clamp → torque → achieved vs Olley-optimum bias, with a decel-sweep chart) |
| **Powertrain** | Drivetrain & traction (wheel torque, tractive force vs traction limit, launch accel) · **Cooling Dyno Analyzer** (see 1.8) |
| **Electronics** | Power budget (load currents vs stator, margin) · Wiring/harness list (shared editable grid) · DAQ & Telemetry (CAN bus load + utilisation) |
| **Chassis** | Tube stress & factor of safety (+ torsional stiffness) · Component-mass tracker (CAD vs measured, feeds MassBudget) |
| **Aerodynamics** | Downforce / drag vs speed (40–120 km/h sweep + chart) |
| **Ergonomics** | Driver fit dimensions + egress/fit checklist |

Each discipline page also has a **Download original workbook (.xlsx)** button.

### 1.8 Cooling — Dyno Analyzer
A full thermal tool (dyno data in → engine heat load → radiator performance via
the NTU-effectiveness method, with fan model, gearing and power/torque curves),
embedded inside the Powertrain page and re-skinned to match. It carries its own
inputs (KTM 390 RC defaults). Its **"From Vehicle Spec"** strip shows the live
rolling radius + mass; the button sets tyre Ø ≈ 2 × rolling radius (labelled —
adjust as needed). Use **Open full-screen ↗** for the big view.

### 1.9 Tyre
- **Download the MATLAB toolset** (served behind login from private storage).
- **Results library:** share a fit — anonymised tyre label, run, scope, R²/RMS,
  LMUX/LMUY, a link to the `.tir`, and a plot image. Browse everyone's fits.
- **Round 8 reference** table (populate from the TTC run matrix).
- **Always visible:** the belt-to-track grip caveat and the licence reminder —
  TTC rig grip ≠ track grip; anonymise tyres; cite the TTC; acknowledge Calspan.

### 1.10 Gates / Phases
G0–G9 cards with status (open / in review / signed off). **Sign off** a gate —
it's attributed to you and timestamped. The **freeze-list** shows every parameter
currently locked and at which gate.

### 1.11 Change Log
Append-only record of every change to a frozen parameter and every
freeze/unfreeze: who, what, old → new, when, and the reason. You can't edit or
delete entries.

### 1.12 Resources
Reference docs organised into **folders by system**. In a folder you can add:
- an **uploaded document** (private storage, ≤ 50 MB), or
- a **link** to a book/website — links store no file, saving space.
Create/rename/delete folders and entries as the team needs.

---

## Part 2 — How the website works (overview)

- **Front-end:** [Astro](https://astro.build) — a static site (plain HTML/CSS
  with small sprinkles of JavaScript called "islands"). No heavy framework, so
  it's fast even on a mid-range phone. Hosted free on **GitHub Pages**.
- **Back-end:** [Supabase](https://supabase.com) free tier — the shared brain:
  - **Auth** — the invite-only magic-link login.
  - **Postgres database** — the Master parameters, each tool's shared inputs and
    contributed outputs, gates, the change log, tyre results, and resources.
  - **Storage** — private buckets for the workbooks, the tyre toolset + plots,
    and reference docs.
- **The golden rule** ("no private copy of a shared number — read it from
  Master") is enforced by having every shared field read from one database row.
- **Security model (be honest about this):** the login screen is a convenience —
  a determined person could still fetch the static HTML directly. The **real**
  protection is **Row-Level Security (RLS)** on every database table: with no
  valid session, the database returns **nothing**. So the data is protected even
  though the pages are technically reachable. The Supabase "anon key" in the code
  is public **by design**; it is not a secret.
- **Charts** use Chart.js and follow the site's light/dark theme.

---

## Part 3 — Limitations & things to know

- **Not real-time.** You see other members' edits on your next page load/refresh,
  not instantly.
- **Free-tier Supabase pauses after ~7 days of no activity.** Un-pause with one
  click in the Supabase dashboard; then the site works again.
- **No automatic backups on the free tier.** The **Excel Master stays the
  authoritative archive** — export a snapshot of the data periodically. Treat the
  web store as the working copy, not the only copy.
- **Auth gating is cosmetic; RLS is the real wall** (see Part 2). Don't put
  anything in the page source you wouldn't want public.
- **Shared, not per-member inputs.** A tool has one set of inputs for the whole
  team. There's no "my private scenario" — if you want to try numbers without
  disturbing others, note the originals first.
- **Cooling tool** is the original standalone app, re-skinned. It isn't deeply
  wired into Master beyond the rolling-radius → tyre-Ø helper (it has no vehicle
  mass input and computes speed itself).
- **Wiring list and the Round 8 table are manual** — they're data you fill in,
  not calculators.
- **Some "Contribute to Master" outputs** (e.g. spring rate, brake torque) are
  stored but their governed destinations (Validation/Springs/Brakes hand-off
  tabs) aren't built yet — they'll be surfaced when those governance tabs exist.
- **Licence:** raw TTC `.mat` / full `.tir` coefficient sets must **never** enter
  the repo or a public link; the toolset lives only in private storage. Keep
  shared tyre results anonymised.
- **Browser storage** (theme choice) is per-device; your theme won't follow you
  to another computer.

---

## Part 4 — For maintainers (how it's built & how to change it)

### 4.1 Tech stack & layout
- Astro 5 (static, `output: 'static'`), TypeScript, **no UI framework** — islands
  are vanilla `<script>` tags. `@supabase/supabase-js` + `chart.js`.
- **Base-aware paths:** `astro.config.mjs` sets `site` + `base`
  (`/blitz-technical-house`). Never hard-code the base — build links with
  `url()` from `src/lib/config.ts`. Moving to a custom domain later needs no code
  change (just update the base + Supabase redirect URLs).

```
src/
  styles/            tokens.css · base.css · components.css  (design system)
  lib/
    config.ts        site config + disciplines/tools + url() helper
    supabase.ts      browser Supabase client (public anon key)
    master.ts        the 14 Master parameters (seed + types)
    store.ts         all data access (Master, tool state, gates, log, tyre, resources)
    chart-theme.ts   Chart.js theming from the design tokens
    calc/
      engine.ts      mountCalculator() — the generic calculator engine
      *.ts           one pure compute() per tool, ported from the workbook
  components/        Masthead · ThemeToggle · AuthGuard · CalcTool · LegendKey · …
  layouts/Base.astro shell: fonts, theme init, masthead, auth gate, footer
  pages/             one page per discipline + cross-cutting pages + /auth/callback
public/tools/cooling.html   the re-skinned Cooling app (served as-is)
supabase/migrations/*.sql    the database schema (run in order)
workbooks/                   source .xlsx (git-ignored; upload to the private bucket)
```

### 4.2 The calculator pattern (how every tool is built)
1. **Read the real workbook.** Open the `.xlsx`, read the actual inputs/formulas
   (a stdlib Python dump script lives in the scratchpad; `openpyxl` isn't
   needed). **Never invent or "improve" a formula** — `TOOL_SPECS.md` is the
   build list, and even it has had errors (the Steering Ackermann formula), so
   the workbook wins. Ambiguous → ask Tahmid.
2. **Write a pure `compute(inputs, master) → outputs`** in `src/lib/calc/<tool>.ts`,
   with the workbook cell trail in comments so it stays auditable.
3. **Render the UI** with `<CalcTool>` (declarative: linked/inputs/outputs/stats/
   chart/contribute) — or hand-write a table for grid-style tools (Aero sweep,
   Chassis mass, DAQ) — using the data attributes the engine expects
   (`data-master`, `data-in`, `data-out`, `data-contribute`, `data-save-status`).
4. **Mount it** in the page's `<script>`: `mountCalculator({ root, tool, compute,
   digits, charts, toMaster })`. The engine loads the Master, applies shared
   inputs, computes, renders, charts, autosaves inputs to `tool_state`, and
   contributes outputs to `tool_outputs`.

### 4.3 Database (Supabase)
Run the migrations **in order** in the SQL editor (see `supabase/README.md`):

| Migration | Adds |
|---|---|
| `0001_master_store` | `vehicle_spec` (14 seeded params), `change_log`, `gates` (G0–G9), `tyre_results`; RLS |
| `0002_storage_workbooks` | private `workbooks` bucket |
| `0003_tool_state` | `tool_state` (shared inputs, JSON per tool) + `tool_outputs` |
| `0004_freeze_and_log` | `edit_param()` RPC + guard trigger + freeze/unfreeze logger (freeze enforcement) |
| `0005_tyre_storage` | private `tyre` bucket + `author_email` |
| `0006_resources` | `resource_folders` + `resources` + private `resources` bucket |

- Every table has **RLS** limited to authenticated members. Freeze enforcement:
  a frozen `vehicle_spec` value can only change via `edit_param(key, value,
  reason)`, which logs it; a trigger blocks any other path.
- **Admin tasks** (Supabase dashboard): invite members (Auth → Users → Invite);
  un-pause the project; upload the tyre toolset to the `tyre` bucket; set Auth
  redirect URLs.

### 4.4 Local dev & deploy
- **Node 20+** (`.nvmrc`). `npm install`, then `npm run dev` →
  `http://localhost:4321/blitz-technical-house/`. `npm run check` (types) and
  `npm run build` before committing.
- **Deploy:** push to `main` → GitHub Actions (`.github/workflows/deploy.yml`,
  `withastro/action` → Pages) builds and publishes. **Pitfall:** re-running an
  *old* failed workflow run republishes that old build — if a deploy looks stale,
  trigger **one** fresh "Run workflow" on `main` (newest run wins).
- Pages requires a **public repo** on the free plan. Keep raw data out of the
  repo (`.gitignore` blocks `*.xlsx/*.rar/*.mat/*.tir`); the tyre toolset was
  purged from git history before going public.

### 4.5 Common changes
- **Add a Master parameter:** add a row to `master.ts` `PARAM_SEED` **and** the
  seed `insert` in `0001` (or a new migration); re-run.
- **Add a tool:** follow 4.2; if it's a new discipline page, set `built: true` on
  that discipline in `config.ts`.
- **Change a seed/default:** edit the workbook-sourced default in the relevant
  `calc/*.ts` or `master.ts` — and note it, since defaults should match the
  workbook.

### 4.6 Suggested future improvements (roadmap)
- **Real-time sync** via Supabase Realtime subscriptions, so edits appear live
  without a refresh.
- **MassBudget sub-tool** so mass/CoG/mass-fraction are computed from components
  (currently editable directly in Vehicle Spec as an interim).
- **Governance tabs** (Validation / Springs / Brakes hand-off / LoadCases /
  LapSim / Targets) so `tool_outputs` have real destinations and more of the
  workbook's Master-level sheets are ported.
- **Wiring grid**: CSV import/export; the Round 8 table: load the real run matrix.
- **Cooling**: deeper Master integration / a native re-port instead of the
  embedded app.
- **Per-member scratch vs team values** toggle for experimenting safely.
- **Periodic data export/snapshot** (CSV/JSON) to back up the free tier, and a
  one-click "export Master to Excel".
- **Custom domain** (base-aware, so no rewrite) + removing the public-repo
  requirement via a host that allows private repos (Cloudflare Pages/Netlify) or
  GitHub Pro.
- **Tests** for the `calc/*.ts` pure functions (they're ideal for unit tests
  against the workbook's known values).
- **Accessibility/perf**: keep auditing contrast and bundle size as tools grow.

---

*Built to mirror the Blitz workbook set faithfully — dramatic presentation,
accurate verbs. When in doubt, the Excel Master and the real workbook formulas
are the source of truth.*
