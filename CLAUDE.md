# CLAUDE.md — MIST Blitz FS Workspace

You are building the **MIST Blitz Formula Student Workspace**: an internal,
team-only website that brings the team's engineering tools onto one site so
coordination is easy. **`BRIEF.md` is the single source of truth** — read it in
full before writing any code; treat Sections A–M as binding.

## What this is
Per-tool build detail (every calculator's inputs, formulas, outputs, charts, and
shared-store contract, extracted from the real workbooks) lives in
**`TOOL_SPECS.md`** — build the calculators from that; never invent a formula.

A tabbed, login-gated workspace for Blitz members: run the team's calculators in
the browser, share one live set of car parameters (the "Master") across every
tool, track gates/phases with freeze-and-log change control, download the Excel
workbooks and the MATLAB tyre toolset, and share tyre results + reference PDFs.
It **mirrors the existing `MIST_Blitz_FS_Master_Workbook.xlsx` set** in web form
— read those files and honour their design. It is a **separate project** from
Tahmid's personal portfolio; do not fold these tools into the personal site.

## Non-negotiables
- **Framework:** Astro, static front-end on **GitHub Pages**. Near-zero JS by
  default; calculators and shared-state views are light islands. Base-aware
  paths (`site`/`base`) so the Pages subpath works now and a custom domain later
  with no rewrite.
- **Backend from the start:** **Supabase** (free tier) — Auth (real per-member
  login), Postgres (the shared Master parameter store, tyre results, gates,
  change log), Storage (`.tir`, plots, PDFs; ≤50 MB/file; private bucket). The
  coordination features require shared server state; a static-only site cannot
  sync one member's input to another's screen. Rely on row-level security, not
  anon-key secrecy. Free-tier caveats to design around: a project pauses after
  ~7 days idle (one-click un-pause), and there are no automatic backups — so the
  Excel Master stays the authoritative archive; export a snapshot periodically.
- **Mirror the workbook faithfully:** honour the golden rule ("no private copies
  of a shared number — read it from Master"); use each subteam file's
  `FromMaster`/`ToMaster` tabs as the exact shared-input/output contract; carry
  the cell-colour legend (blue = input, green = linked, black = computed) into
  the UI. It is a faithful re-creation, not embedded Excel; the original `.xlsx`
  stays downloadable.
- **Design system is locked:** build against the portfolio brief's Section T
  (Archivo + IBM Plex Sans + IBM Plex Mono; blueprint light + night-shift dark;
  exact amber/maroon/sky tokens; halftone button + annotation kit). Re-skin the
  provided Cooling tool and the earlier tyre portal to match.
- **Accessibility / performance:** WCAG AA; full `prefers-reduced-motion`;
  keyboard navigable; fast on a mid-range Android; Chart.js for plots.

## Content & data integrity (critical — do not violate)
- **Never invent a formula.** For each workbook, open the `.xlsx`, read the real
  inputs/formulas/outputs, and port those. Ambiguous → ask Tahmid. A wrong
  calculator is worse than none.
- **Licence:** GitHub Pages is public even from a private repo. Keep raw TTC
  `.mat` files and full `.tir` coefficient sets out of the repo; ship the tyre
  zip as a Release asset. Anonymise tyres in shared results; cite TTC/Calspan.
  Member uploads live in private Supabase storage behind auth.
- Keep honest labels; keep the belt-to-track grip caveat visible wherever tyre
  results appear. Dramatic presentation, accurate verbs.

## Build order (BRIEF Section K)
1. Foundation: design system + Astro scaffold + **discipline-first nav** (landing
   grid of discipline cards → each opens a discipline page with its tools; see
   BRIEF §D) + Supabase Auth + the Vehicle Spec (Master) store schema.
2. Prove the shared-state loop end to end — Vehicle Spec + one subteam calculator
   reading/writing it (so "enter mass once, see it everywhere" works across
   members) — before porting the rest.
3. Cooling Dyno Analyzer — fully re-skin (its red/Merriweather look is only a
   reference) and place it inside the Powertrain page.
4. Tyre single page — download (Release asset) + results library + guides/table.
5. Remaining tools, grouped under their disciplines (BRIEF §D) in the order Tahmid
   confirms — build each from TOOL_SPECS.md (read the file; don't guess formulas).
6. Gates/Phases + freeze-and-log + Change Log; Resources (PDF upload).
7. Polish, then deploy.

## How to work with Tahmid
Newer to Claude Code. Explain before large changes, commit in small reviewable
steps with clear messages, show diffs. Resolve the BRIEF Section M open items
(repo name, member/auth method, zip URL, workbook porting order) before the steps
they block. When the brief doesn't cover a decision, trace it to a brief
principle or ask — don't guess past it.
