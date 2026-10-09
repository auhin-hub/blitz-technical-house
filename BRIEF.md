# MIST Blitz — FS Workspace · Build Brief

Oct 9, 2026 · prepared with @Tahmid

Single source of truth for the **MIST Blitz Formula Student Workspace** — an
internal, team-only website that brings the team's engineering tools together on
one site so coordination is easy. Separate project from Tahmid's personal
portfolio; it only borrows that portfolio's design language.

Governing principle (from the portfolio): **dramatic presentation, accurate
verbs.** These are real calculators — never dress an estimate as a validated
result.

---

## A. What this is

A tabbed workspace where Blitz members sign in and:

- use the team's calculators **in the browser** — the Cooling Dyno Analyzer and
  the subteam tools (Aero, Chassis, DAQ/Telemetry, Electronics, Ergonomics,
  Powertrain, Vehicle Dynamics);
- share one **live set of car parameters** (the "Master") across every tool, so
  a number entered once is read everywhere — the coordination hub;
- track **gates/phases** (G0–G9) and the **freeze-and-log** change control;
- **download** the original workbooks as Excel (`.xlsx`) files and the MATLAB
  tyre toolset;
- **browse and upload** shared tyre-fit results (`.tir` links, R²/RMS, grip
  factors, plots);
- read and upload **reference PDFs / instructions** (Resources).

Audience: **MIST Blitz members only** (internal). Not public, not indexed, not
linked from the personal portfolio.

## B. This mirrors the existing workbook — faithfully, in web form

The build must preserve how the `MIST_Blitz_FS_Master_Workbook.xlsx` set already
works. Read those files; honour their design:

- **The golden rule (from the Instructions sheet):** "No team keeps a private
  copy of a shared number. If it is on Master, read it from Master." The website
  enforces this — shared fields read from the one Master store.
- **The workbooks already try to do this live via Google Sheets IMPORTRANGE**
  (each `StartHere` tab tells members to paste the Master's share URL). The
  website's Supabase Master store is the robust replacement for that scheme —
  same single-source-of-truth intent, with real logins, freeze/lock and logging.
- **Data flow:** `MassBudget + Tyre → Master → LoadTransfer / Springs /
  LoadCases / LapSim`, and per-team tabs pull from Master and hand results back.
  Each subteam workbook already declares this with a `FromMaster` tab (shared
  inputs it reads) and a `ToMaster` tab (results it contributes) — use these as
  the exact shared-state contract for each web tool.
- **Cell colour legend → visual convention on the web:** blue-on-yellow = typed
  input (editable); green = linked value pulled from Master (read-only here);
  black = computed by formula (read-only). Carry this meaning into the UI.
- **Honest caveat:** the site is a faithful *re-creation* of the workbook, not
  the literal Excel running in a browser. Numbers, flows, legend meaning,
  freezing, and gates are reproduced as web equivalents; the original `.xlsx`
  stays downloadable so nothing is lost. **Never invent a formula — port what
  the workbook computes; ask Tahmid when a cell is ambiguous.**

## C. Architecture — Supabase-backed from the start

The coordination features Tahmid wants (one member's input showing on another's
screen; self-serve uploads; enforced gate-freezes) all require shared server
state. A static-only site fundamentally cannot sync one person's values to
another's browser. So the backend is foundational, not deferred.

- **Front-end:** Astro, static, on **GitHub Pages**. Near-zero JS by default;
  calculators and shared-state views are light interactive islands. Base-aware
  paths (`site`/`base` in `astro.config`) so the Pages subpath works now and a
  custom domain works later with no rewrite.
- **Backend:** **Supabase** (free tier). Provides:
  - **Auth** — real per-member logins (replaces the earlier speed-bump idea).
  - **Postgres** — the shared **Master parameter store** (one row per parameter:
    value, unit, source, confidence, frozen-flag, owning gate), the tyre-results
    records, the gates/sign-offs, and the change-log.
  - **Storage** — `.tir` files, result plots, and reference PDFs (≤50 MB each),
    behind auth in a private bucket.
- **Free-tier reality (verified):** 500 MB DB, 1 GB storage (50 MB/file), 50k
  monthly active users, 5 GB egress — ample here. Two caveats baked into the
  plan: (1) a free project **pauses after ~7 days of inactivity** (one-click
  un-pause); (2) **no automatic backups / no SLA on free** — so the Excel Master
  stays the authoritative archive, and the site exports a snapshot periodically.

Build order can still be staged (Section K), but Supabase auth + the Master
store are part of the foundation, not a later milestone.

## D. Site map & navigation

**Two-level navigation.** The landing page is a grid of **discipline** cards;
clicking one opens that discipline's page, which holds its **tools**. A
persistent top nav carries the cross-cutting pages. Logo/name returns HOME.

### Disciplines — the landing-page headings; each opens its own page
- **Vehicle Dynamics** → Setup / kinematics · Suspension geometry & hardpoints ·
  Springs & dampers · Suspension loads · Steering · Brakes
- **Powertrain** → Drivetrain & traction · **Cooling** (Dyno Analyzer, re-skinned)
- **Electronics** → Power budget · Wiring / harness list · DAQ & Telemetry
- **Chassis** → Tube stress & FoS + torsional stiffness · Component-mass tracker
- **Aerodynamics** → Downforce / drag vs speed
- **Ergonomics** → Driver fit + egress checklist

### Cross-cutting — persistent top nav
- **Home** — the discipline grid + gate/phase status + latest shared results
- **Vehicle Spec** — the shared Master store (+ MassBudget); the canonical numbers
- **Tyre** — single page: download the toolset + results library + Round 8 table
- **Gates / Phases** — G0–G9 status, sign-off, freeze-list
- **Resources** — reference PDFs / instructions (read + member upload)
- **Change Log** — every edit to a frozen number (who / what / old→new / when)
- **[auth]** — member login before any of the above

DAQ & Telemetry sits under Electronics here; split it into its own discipline
later if the team prefers. Every tool page carries its "Download the original
workbook (.xlsx)" button.

## E. The tools, one by one

### E1. Vehicle Spec — the shared Master store (the backbone)
Ports the `Master` + `MassBudget` + `Tyre` sheets into one live, shared record.
Members edit the blue inputs; linked and computed values update everywhere.
Each parameter carries value, unit, symbol, source, confidence, a **frozen**
flag, and the gate that froze it. This is what makes "enter mass once, see it
everywhere" real and team-wide.

### E2. Cooling — Dyno Analyzer (`Cooling_Cacl.html` — provided; lives under Powertrain)
Already a self-contained web app (HTML + Chart.js): dyno curve in, radiator
geometry, fan model, drivetrain/gearing, heat-load assumptions → heat-rejection
vs speed, fan state, power/torque curves. **Keep the physics/logic exactly, but
fully re-skin to the portfolio design system** — its current red + Merriweather
look is only a reference, not kept; it must match the other tools. Place it as a
tool **inside the Powertrain page**. Where it needs car parameters from Vehicle
Spec (mass, speeds), read them from the store.

### E3. Subteam calculators (from `Blitz_FS_Workbook_Set/team_files/`)
`Aero`, `Chassis`, `DAQ_Telemetry`, `Electronics`, `Ergonomics`, `Powertrain`,
`Vehicle_Dynamics` working files (+ `MIST_Blitz_FS_Master_Workbook.xlsx`).
**The exact inputs, formulas, outputs, charts, and FromMaster/ToMaster contract
for every one of these is already extracted in `TOOL_SPECS.md` — build from that.**
Group them under the disciplines in Section D (e.g. Steering, Brakes, Springs &
Dampers, Suspension loads and geometry all live inside the Vehicle Dynamics page).
For each:
1. **Open the `.xlsx`; read its real inputs, formulas, outputs** — don't guess.
   Use its `FromMaster`/`ToMaster` tabs as the shared-input / shared-output list.
2. Build the web form; compute in JS; show results + any chart the sheet implies
   (Chart.js). Pull shared inputs from Vehicle Spec; write outputs back to it.
3. Offer **"Download the original workbook (.xlsx)"** on each tool's page.
Keep the master workbook as a download (it's the index/companion, not a form).
VD is the largest and overlaps the Tyre tab conceptually — keep them distinct:
VD here = suspension/steering/brake/springs calcs; Tyre = the MATLAB toolset +
fit results.

### E4. Tyre (single page)
- **Download** the toolset zip (`MIST_Blitz_TTC_Tyre_Toolset.zip`) as a GitHub
  **Release asset**, not committed to the repo (licence — Section G).
- **Results library:** members run the fit in their own MATLAB/Octave, then
  upload the result here (Supabase): tyre (anonymised class/label), run, scope,
  R²/RMS, LMUX/LMUY if stamped, author, date, a link to the `.tir`, plot
  image(s). Others browse them.
- Carry the Round 8 run table and the grip/belt-to-track + licence reminders
  onto this page.

### E5. Gates / Phases + Freeze-and-log
Ports the `Gates`, `Targets`, `Validation`, `ChangeLog` governance. G0–G9 with
status and sign-off (attributed to the signed-in member, timestamped). Freezing
a parameter at a gate locks it in Vehicle Spec; any later edit to a frozen number
requires a change-log entry (who/what/old→new) — enforced, not just convention.

### E6. Resources
Reference PDFs / instructions in a Supabase storage bucket; listed for reading;
members upload (≤50 MB/file).

## F. Auth
Real per-member login via **Supabase Auth** (email or magic-link). Replaces the
speed-bump password entirely. Uploads and edits are attributable; data is private
to signed-in members via row-level security.

## G. Data & licence rules (hard requirements)
- GitHub Pages serves **publicly even from a private repo** → **no raw TTC
  `.mat` files and no full `.tir` coefficient sets in the repo.**
- The tyre zip ships as a Release asset / Drive link to cleared members; it must
  not itself contain raw data if world-reachable.
- Shared results: **anonymise tyres** (size class or "Tyre A/B/C"), publish
  summary numbers + plots, not full coefficient dumps. Cite the TTC, acknowledge
  Calspan for any external use.
- Member-uploaded `.tir`/plots/PDFs live in **private Supabase storage behind
  auth** (row-level security), never a public bucket.

## H. Design system
Build against **portfolio Section T**, verbatim: Archivo (display) + IBM Plex
Sans (body) + IBM Plex Mono (technical); blueprint-paper light + night-shift
dark; amber #E8A33D fill / #A86A12 as-text; maroon #9B1E22 → #D14B4F dark; sky
data #4A6D82 / hairline #9FC3DB; the halftone button and engineering-annotation
kit as reusable components. WCAG AA; full `prefers-reduced-motion`; keyboard
navigable. **Re-skin the two existing pieces** (Cooling tool, red + Merriweather;
the earlier tyre portal, Blitz red/black) to this system so the workspace reads
as one world. The input/link/computed colour legend (Section B) is part of the UI
language. **Design quality bar: this should feel as polished as Tahmid's personal
portfolio** — the annotation kit, halftone buttons, and night-shift mode are what
carry that; it is a team tool, not a plain utility page.

**Team logo (Tahmid has the Blitz logo file).** Drop it in `src/assets/` and
offer it in these places — all optional, pick per taste:
- **Nav masthead** (left of the name) — the default home for it; small, mono
  wordmark beside it.
- **Login screen** — centered above the sign-in, the first thing members see.
- **Home hero** — larger, with the workspace title.
- **Favicon / browser tab** — a small square crop.
- **The maroon "heritage" marker** — per the portfolio system, Blitz-tied
  elements lean on maroon; the logo reinforces that where the team identity
  shows (home, gates sign-offs). Provide both light- and dark-mode-safe
  versions (or an SVG that recolours) so it reads on the night-shift surface.

## I. Tech stack
- Astro static front-end (one toolchain, same as the portfolio).
- `@supabase/supabase-js` for auth, DB, storage — called from light islands.
- Chart.js for plots (already used by the cooling tool).
- Reading `.xlsx` to port formulas is a dev-time step; the shipped front-end is
  static and talks to Supabase at runtime.
- Base-aware paths throughout.

## J. Deployment (last step)
- **Private** GitHub repo; front-end on GitHub Pages (base-aware).
- Supabase project (free tier) for backend; keys via a config file (anon key is
  public by design — rely on row-level security, not key secrecy).
- Tyre zip as a GitHub **Release asset**.
- Deploy, add members, iterate on the live subpath; migrate to a custom domain
  later with no rewrite.

## K. Build order
1. Foundation: design system (fonts, tokens, halftone button, annotation kit),
   Astro scaffold (base-aware shell, nav, theme toggle), **Supabase project +
   Auth**, and the **Vehicle Spec (Master) store** schema.
2. Prove the shared-state loop end to end: Vehicle Spec + one subteam calculator
   (suggest VD or Powertrain) reading/writing it, so "enter mass once, see it
   everywhere across members" works before porting the rest.
3. Cooling tab — embed + re-skin.
4. Tyre single page — download (Release asset) + results library + guides/table.
5. Remaining subteam calculators, in the order Tahmid confirms (read each file).
6. Gates/Phases + freeze-and-log + Change Log; Resources (PDF upload).
7. Polish: mobile, motion, AA, performance. Deploy.

## L. Integrity guardrails
- **Never invent a formula** — port what the workbook computes; ask when unclear.
- Keep honest labels; keep the belt-to-track grip caveat visible wherever tyre
  results appear; anonymise tyre data (Section G).
- Dramatic presentation, accurate verbs.

## M. Open items — Tahmid to confirm
- **Repo name** (e.g. `blitz-workspace`) and the Pages subdomain for now.
- **Member list / sign-up method** for Supabase Auth (open sign-up vs invite).
- **Where the tyre zip is hosted** (GitHub Release vs Drive) and its URL.
- **Porting order for the subteam calculators** — which first; any per-sheet
  notes or formulas not self-explanatory in the file.
- Confirm the Excel `Master` remains the authoritative archive (periodic export
  from the site), given free-tier Supabase has no automatic backups.
