# MIST Blitz FS Workspace

Internal, team-only website that brings the Blitz engineering tools onto one site:
calculators in the browser, a shared live car spec, gates/phases with change
control, the tyre toolset + results, and reference docs.

**Plan pack — read in this order before building:**
1. `CLAUDE.md` — orientation + non-negotiables for Claude Code.
2. `BRIEF.md` — full spec (architecture, site map, tools, licence, deploy).
3. `TOOL_SPECS.md` — every calculator's inputs/formulas/outputs, extracted from
   the real workbooks. Build calculators from this; never invent a formula.

---

## Setup checklist (your first 30 minutes)

### 1. Create the repo
- New **private** GitHub repo, e.g. `blitz-workspace`.
- Add these three plan files at the root: `CLAUDE.md`, `BRIEF.md`, `TOOL_SPECS.md`.

### 2. Add source material (and keep data out)
- `Cooling_Cacl.html` → somewhere like `reference/` (Claude re-skins it into the
  Powertrain page).
- The Excel set (`MIST_Blitz_FS_Master_Workbook.xlsx` + `team_files/*.xlsx`) →
  e.g. `workbooks/` (used to port formulas, and offered as downloads).
- The **Blitz logo** → `src/assets/` (see BRIEF §H for where it can appear).
- **Do NOT commit** raw TTC tyre data (`.mat`) or full `.tir` coefficient sets —
  licence. The tyre zip goes out as a Release asset (step 5).

### 3. Create the Supabase project (free)
- Sign up at supabase.com → new project (pick the nearest region).
- Copy the **Project URL** and the **anon public key** — Claude Code puts these in
  a config file. (The anon key is public by design; security comes from row-level
  security, not key secrecy.)
- You don't design the tables — Claude Code creates them from `TOOL_SPECS.md §0`.

### 4. Enable GitHub Pages (after the first successful build)
- Settings → Pages → deploy from branch (or the Actions workflow Claude sets up).
- The site lives at `https://<you>.github.io/blitz-workspace/`. Paths are
  base-aware, so a custom domain later needs no rewrite.

### 5. Tyre toolset download
- Repo → Releases → draft a release → attach `MIST_Blitz_TTC_Tyre_Toolset.zip`.
- Copy the asset URL; Claude wires it into the Tyre page.

---

## Starting with Claude Code

Open the repo in VS Code with Claude Code, then kick off:

> Read `CLAUDE.md`, `BRIEF.md`, and `TOOL_SPECS.md` in full. We're building Phase 1,
> step 1 (foundation): the design system (portfolio Section T), the Astro scaffold
> with discipline-first navigation, Supabase auth, and the Vehicle Spec (Master)
> store schema. Show me the plan and the file structure before writing code, and
> commit in small reviewable steps.

Then follow the build order in `BRIEF.md §K`, reviewing each step:
foundation → prove the shared-input loop with one Vehicle Dynamics (or Powertrain)
tool → Cooling (re-skinned, under Powertrain) → Tyre page → the rest of the tools
by discipline → Gates/Resources/Change Log → polish → deploy.

---

## Four things Claude Code will ask you (BRIEF §M)
1. **Repo name** + confirm the GitHub Pages subdomain for now.
2. **How members sign up** — invite-only vs open sign-up (Supabase Auth).
3. **Where the tyre zip is hosted** + its URL.
4. **Which tool to build first** — recommend Vehicle Dynamics or Powertrain (both
   read a lot from the Master, so they prove the shared-input loop best).

## Guardrails (don't skip)
- **Never invent a formula** — port what the workbook computes; ask when unclear.
- **Licence:** no raw `.mat` / full `.tir` in the repo; anonymise tyres in shared
  results; cite TTC / acknowledge Calspan for external use.
- **Keep the Excel `Master` as the source of truth** until the web store is
  cross-checked against it; Supabase free tier has no auto-backups.
