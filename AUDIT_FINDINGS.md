# MIST Blitz Workspace — Code Audit & Fix List

> Full-repo review on **2026-10-11**, against branch `v2-build` (8 commits ahead of
> `main`). Written to be worked top-down: **P0 breaks things today**, P1 is wrong
> maths/physics, P2 is robustness/UX/accessibility, P3 is cleanup.
> Each item: **what / where / why it matters / suggested fix / effort**.
> A final section lists what I checked and found **correct**, so we don't re-audit it.

---

## P0 — Blocking: will look like "the whole site is broken"

### P0.1 — `loadMaster()` now selects a column that doesn't exist until migration 0008 runs ⚠️ TOP PRIORITY
**Where:** `src/lib/store.ts` → `loadMaster()` (the `.select(...)` now includes `text_value`);
column added by `supabase/migrations/0008_promote_keys.sql`.
**Why it matters:** PostgREST rejects a select naming an unknown column. `loadMaster()`
swallows that (`if (error || !data) return out;`) and returns an **empty object**. So until
0008 is run, *every* tool sees a blank Master: all green linked cells show "—", Vehicle
Spec shows no live values, the Home dashboard is empty, the readiness board is all grey —
**with no error message anywhere**. This is almost certainly behind "some issues remain".
**Fix (do both):**
1. **Run `0008_promote_keys.sql`** in the Supabase SQL editor (it's idempotent).
2. Make `loadMaster()` resilient so a schema lag degrades gracefully instead of silently
   blanking the site: on error, retry the select without `text_value`, and surface the
   error (console + a visible banner) rather than returning `{}` quietly.
**Effort:** 5 min to run the migration; ~20 min for the resilient fallback + a banner.

### P0.2 — Master writes bypass the freeze-aware `edit_param()` path
**Where:** `setMasterValue()` is used directly by MassBudget contribute
(`src/pages/massbudget.astro`), Trifilar (`measurement.astro`), Load transfer
(`vehicle-dynamics.astro`, `lt-write`), Geometry rear-RC (`geometry.astro`,
`geo-rear-rc-write`), the `.tir` → Master write (`tyre.astro`), and the Vehicle-Spec
baseline preset.
**Why it matters:** the handoff's ground rule is "all Master writes go through the
freeze-aware, change-logged `edit_param()`". A direct update is *blocked* by the DB guard
when the key is frozen (so nothing corrupts — good), but it writes **no change_log row**
and gives the user only a raw "Failed (frozen?)" string. Governance intent is lost.
**Fix:** add a shared `writeMaster(key, value)` helper that checks the key's `frozen`
state, and for frozen keys prompts for a reason and calls `editFrozenParam()` (reusing the
`COUPLING_BY_KEY` knock-on prompt from Vehicle Spec). Point all six call sites at it.
**Effort:** ~45 min, one helper + 6 call-site swaps.

---

## P1 — Wrong maths / physics (results are misleading)

### P1.1 — Springs roll gradient uses **total mass × full CoG height** (should be sprung mass above the roll axis)
**Where:** `src/lib/calc/springs.ts` → `rollMomentPerG = m.mass * 9.81 * (m.cogHeight/1000)`.
**Why it matters:** the roll moment that the springs resist is the **sprung** weight acting
on the lever **(h_cg − h_roll-axis)**, not the whole car's weight on the full CoG height.
As written, the roll gradient is **over-estimated** (typically by ~20–35%: unsprung mass
included, and the roll-axis height ignored). It is contributed to `tool_outputs` as
`roll_gradient` and then compared against the target on `/validation`, so the error
propagates into a pass/fail judgement. Note `vd-loadtransfer.ts` does this correctly
(`Ws · ay · (hCg − hRA)`) — the two tools currently disagree.
**Fix:** `rollMomentPerG = Ws · g · (h_cg − h_rollAxis)/1000`, where
`Ws = mass − 4·unsprung_corner` and `h_rollAxis` is interpolated from the front/rear RC
heights (same as `vd-loadtransfer.ts`). Needs RC heights as inputs/linked values on
`/springs`. Update `springs.test.ts` expectations and re-check the Validation row.
**Effort:** ~1 h including tests. **Flag:** changes a published number — agree it first.

### P1.2 — DAQ measured roll gradient ignores the motion ratio
**Where:** `src/lib/calc/daq-interp.ts` → `rollAngleDeg(damperL, damperR, trackMm)` and its
use in `interpretLog()`.
**Why it matters:** it computes roll angle from **damper** travel across the track, but the
roll angle is set by **wheel** travel. Wheel travel = damper travel ÷ MR (MR ≈ 0.6–0.9), so
the measured roll gradient is under-read by roughly that factor — then shown next to the
design value as "within band / off target". A correlation tool that quietly mis-scales is
worse than none.
**Fix:** take `motion_ratio` (Master) as a parameter and divide damper delta by MR before
the `atan`. Add a test. Also expose MR on the `/daq` page next to the steering-ratio input.
**Effort:** ~30 min.

### P1.3 — DAQ understeer gradient includes the kinematic (Ackermann) term
**Where:** `src/lib/calc/daq-interp.ts` → `understeerGradient = slope(ay, steer_deg/ratio)`.
**Why it matters:** the published definition subtracts the Ackermann steer
(`δ_Ackermann = L/R`), so what we report is a **steer gradient**, not the understeer
gradient — it's offset by the kinematic term and will not match the Balance tool's `K`.
The spec explicitly asked for `(steer/i − Ackermann) vs ay`.
**Fix:** either (a) compute `δ_Ack = (wheelbase / R)` per sample with
`R = v²/(ay·g)` and subtract it, or (b) relabel the output "measured steer gradient
(includes kinematic term)" and stop comparing it to `understeer_gradient`.
(a) is the right fix; (b) is the honest stop-gap.
**Effort:** ~40 min for (a).

### P1.4 — Traction limit uses the **lateral** μ for a **longitudinal** limit
**Where:** `src/lib/calc/pt-traction.ts` → `tractionLimit = m.mu_lat_peak * m.axle_load_rear`.
**Why it matters:** longitudinal and lateral peak μ differ (μx is usually the larger on a
slick). Using `mu_lat_peak` makes launch g and the "traction vs power limited" verdict
systematically off. The g–g tool correctly keeps a separate `muX`.
**Fix:** add a `mu_long_peak` Master key (or a local μx input on the traction tool,
defaulting to `mu_lat_peak`) and use it here. Note the knock-on: `launchAccel` feeds the
g–g "launch g" and the lap sim.
**Effort:** ~30 min (+ a Master key if we go that route).

### P1.5 — `restrictor_dia` was promoted to Master but the restrictor tool still uses a local input
**Where:** Master key added in `0008`; `src/pages/powertrain.astro` → `pt_restrictor` has a
local `dia` input and no linked cell.
**Why it matters:** this is exactly the "no private copies of a shared number" rule the
whole workspace is built on — and it's a *rules* value the readiness board tracks as
procurement/rules state. Two sources of truth for a rulebook number is the worst case.
**Fix:** make `dia` a green linked cell reading `restrictor_dia` (fall back to the local
input + amber when unset, per the P1.4 freeze-warning pattern).
**Effort:** ~20 min.

### P1.6 — `rear_rc_height` is written but never read
**Where:** written in `geometry.astro`; no consumer.
**Why it matters:** the load-transfer tool asks the user to re-type a rear RC height
(`rcRear` input) that the Master already holds — same duplication as P1.5.
**Fix:** link `vd_loadtransfer`'s `rcRear` to `rear_rc_height`.
**Effort:** ~15 min.

### P1.7 — Home dashboard g–g uses hardcoded physics fallbacks
**Where:** `src/pages/index.astro` → `renderGg()`:
`muX: 1.4, accelLimit: 0.8, brakeLimit: 0, mass: … : 264`.
**Why it matters:** with a blank/partial Master the dashboard draws a **plausible-looking
but fictional** envelope (a 264 kg car at 1.4 g) with nothing saying it's fake. That breaks
the project's own "—, never a silent number" rule, on the most-viewed page.
**Fix:** when the needed Master values are missing, render an empty chart with "Fill in
Vehicle Spec to see the envelope" instead of substituting defaults. Only `rho` should have
a constant default.
**Effort:** ~20 min.

---

## P2 — Robustness, UX, accessibility

### P2.1 — Four list tools escape only `"` when building HTML
**Where:** `budget.astro:86`, `cost.astro:111`, `gantt.astro:77`, `massbudget.astro:145`
— `esc = s => s.replace(/"/g,'&quot;')`.
**Why it matters:** these build rows with `innerHTML`, so any user text containing `<` or
`&` (a part named `A&B`, a task `<rework>`) corrupts the table or injects markup. It's an
authenticated internal tool so the risk is low, but the **render corruption is real** and a
member will hit it. `readiness.astro`, `resources.astro`, `tyre.astro`, `change-log.astro`
already escape `& < > "` properly.
**Fix:** move the correct `esc` into a shared util (e.g. `src/lib/html.ts`) and use it in
all four. Consider it the default for any future `innerHTML` builder.
**Effort:** ~20 min.

### P2.2 — New dynamic grids have no accessible labels
**Where:** `budget.astro` (7 inputs/row, 0 aria-labels), `cost.astro` (6, 0),
`gantt.astro` (10, 1).
**Why it matters:** CLAUDE.md commits to WCAG AA + keyboard navigability. A screen reader
reads these as unlabelled edit fields; the older grids (MassBudget, DAQ) do set
`aria-label`, so this is an inconsistency we introduced.
**Fix:** add `aria-label="<row name> <column>"` to each generated input (the DAQ/MassBudget
renderers are the pattern to copy).
**Effort:** ~30 min.

### P2.3 — Cooling iframe is a fixed 1600 px tall
**Where:** `src/pages/powertrain.astro:79`.
**Why it matters:** on a mid-range Android (an explicit target) this is a huge dead
scroll region, and the cockpit is supposed to be single-viewport. The cross-cutting
acceptance list says new embeds must behave in the cockpit layout.
**Fix:** cap with `height:min(1600px, 150vh)` or load the iframe only when the Cooling tool
is the selected rail item (lazy-reveal), keeping the "Open full-screen ↗" link as primary
on small screens.
**Effort:** ~20 min.

### P2.4 — Readiness never shows amber for a tool-output prerequisite
**Where:** `src/lib/calc/readiness.ts` → `prereqStatus()` (tool_output branch returns
green/grey only).
**Why it matters:** the spec defines amber as "contributed but **upstream unfrozen**". We
show green the moment a value is contributed, even if every Master input behind it is still
floating — so the board can read "Ready to start" on sand. This is the board's core promise.
**Fix:** give each registry entry in `TOOL_OUTPUT_KEYS` its upstream Master dependencies,
then mark a contributed output amber while any upstream key is unfrozen. (Cheaper interim:
amber if the contribution is older than the newest change_log entry.)
**Effort:** ~1–2 h for the dependency map; it's the highest-value P2.

### P2.5 — Cost: parts without an FCA dump their whole unit cost into "Material"
**Where:** `src/pages/cost.astro` → `partBlocks()` fallback
`{ mat: unitManual, proc: 0, fast: 0, tool: 0 }`.
**Why it matters:** the official BOM export then reports a materials-only cost breakdown
for those lines, so the template's Cost Summary mis-attributes real money across the four
judged categories.
**Fix:** leave all four block cells **blank** when there's no FCA and no seeded blocks
(fill only `Unit Cost`/`Total`), so the summary under-reports visibly rather than lying.
**Effort:** ~15 min.

### P2.6 — Gantt dependencies match on task **name**
**Where:** `src/pages/gantt.astro` (`pos[t.depends_on]`).
**Why it matters:** two tasks with the same name silently draw the wrong arrow; renaming a
task breaks its dependents with no warning.
**Fix:** give tasks a stable id (uuid on create) and reference that, showing the name in a
datalist. Flag unresolved `depends_on` values in the row.
**Effort:** ~40 min.

### P2.7 — Lap sim: `muLong` is dead, and the page feeds it `muLat`
**Where:** `lapsim.ts` declares `muLong` (never used); `lapsim.astro:115` passes
`muLong: gi('muLat')`.
**Why it matters:** braking/accel limits come only from `brakeG`/`launchG`, so a user who
changes "peak longitudinal μ" expecting an effect gets none. Dead parameters erode trust.
**Fix:** either use `muLong` as the grip ceiling on the accel/brake passes (correct) or
delete the field. Prefer using it: `tract = min(launchG, muLong)·g·k`.
**Effort:** ~30 min + test.

---

## P3 — Cleanup, docs, repo hygiene

- **P3.1 Dead-but-tested modules.** `src/lib/calc/vd-geometry.ts`, `vd-springs.ts`, `daq.ts`
  have **no app importers** — only `workbook-values.test.ts`. They're superseded by
  `geometry.ts` / `springs.ts` / the editable DAQ list, but deleting them would drop
  workbook regression coverage. **Fix:** add a header comment to each ("superseded by X;
  retained for the workbook regression test") so nobody wires them back in. *(10 min)*
- **P3.2 `*.xlsx` is gitignored**, so `public/templates/cost/FSAEJ_BOM_Template_2026_v0.xlsx`
  only ships because it was force-added. A future `git add -A` after replacing it will skip
  it and the download link 404s on deploy. **Fix:** add a negating rule
  (`!public/templates/**/*.xlsx`) to `.gitignore`. *(5 min)*
- **P3.3 A PDF was committed as text.** `handoff/Cost/Cost Report Guidlines/BoM Template
  foreign.pdf` landed as a ~7.9k-line text diff. Harmless but it bloats history and diffs.
  **Fix:** leave it; just note it (rewriting history isn't worth it). *(note only)*
- **P3.4 FS-UK 2026 point ceilings are placeholders.** `points.ts` `COMPETITIONS.uk` mirrors
  the Japan split with a ⚖ note. **Fix:** verify against the current IMechE rules and
  update the defaults. *(needs your input)*
- **P3.5 Cooling contributes nothing.** `radiator_area` / `heat_rejection_kw` are in the
  readiness picker but `cooling.html` never writes them, so a requirement on them can never
  go green. **Fix:** add a contribute button in the cooling tool, or drop the two keys from
  the registry until it exists. *(~45 min, or 5 min to drop)*
- **P3.6 Readiness seed has no sub-assembly.** The seed CSV has no `subassembly` column, so
  every seeded card shows a blank sub-line. **Fix:** add the column to the seed, or hide the
  line when empty. *(15 min)*
- **P3.7 Docs drift.** `WORKSPACE_REFERENCE.md` predates v2 — it lacks the Part-0 Master
  keys, the new tool_outputs, and the 6 new pages (`/readiness`, `/cost`, `/budget`,
  `/gantt`, `/points`, `/daq`). Since its whole purpose is to brief a fresh Claude chat, it
  should be regenerated. *(~45 min)*

---

## Verified correct — don't re-audit these

I checked these against first principles / the source workbooks and they are **right**:

- **Routes/links:** every `url(...)` target resolves to a real page; all `TOP_NAV` and
  `VD_STAGES` hrefs exist. No broken internal links. Public assets (`data/*.csv`,
  `data/cost-tables.json`, `templates/daq/*`, `templates/cost/*`) all ship to `dist/`.
- **Choked restrictor flow** (`extras.ts`): matches the standard compressible relation;
  20 mm → ~70 g/s, the accepted FSAE figure.
- **Brake lock-up** (`brakes.ts` `lockupDecel`): both axle expressions derive correctly from
  `a·bias = μx·(static ± a·h/L)`.
- **Brake effective radius / hydraulic chain** (`vd-brakes.ts`): matches the workbook cell
  trail; pedal → MC → caliper → friction → torque is dimensionally sound.
- **Euler buckling, bolted joint, wire drop, CoG tilt, corner weights, quarter-car,
  trifilar pendulum, gear speed, battery sizing** (`extras.ts`): all standard forms,
  correct unit handling.
- **Understeer gradient / static margin / char & crit speed** (`balance.ts`): correct
  bicycle-model forms.
- **MassBudget CG + parallel-axis Izz + front fraction** (`massbudget.ts`): correct,
  including `ff = 1 − x_cg/L` with x from the front axle.
- **Springs tyre-in-series wheel rate** `Kw = Kr·Kt/(Kt−Kr)` and the MR-from-geometry
  relation: correct (the roll-gradient issue in P1.1 is separate).
- **g–g aero scaling** `k(v) = (W+DF)/W` and the truncation logic: correct — notably the
  power-limited cap is *not* scaled by downforce, which is right.
- **Lap sim**: corner speed with aero iteration, top-speed `(2P/ρC_dA)^⅓`, and the
  forward/backward relaxation are all sound (the `muLong` gap is P2.7).
- **Geometry synthesis** (`geometry-synth.ts`): reproduces `Suspension_Geometry.xlsx`
  exactly (IC height 187.5, inner pickups 537.64/143.76/412.09/343.36, outer x 15.56/−0.52),
  and after the frame fix the solver recovers the RC (50) and scrub (40) targets.
- **Cost engine** (`cost.ts`): the parametric price evaluator reproduces the tables' own
  `Calc` values; tooling amortisation `qty/PVF`; by-system roll-up correct. The formula
  evaluator rejects non-numeric input.
- **Points** (`points.ts`): the relative-time formula gives `P_max` at `T_min`, 0 at
  `T_max`, and is monotone in between.
- **Freeze enforcement** (migrations 0004/0008): the DB trigger genuinely blocks frozen
  edits (including `text_value` after 0008) — enforcement is real, not convention.
- **Build health:** `astro check` 0 errors/warnings/hints, **106 tests pass**, build clean,
  31 pages.

---

## Suggested order for the morning

1. **P0.1** — run migration 0008, then add the resilient `loadMaster()` fallback. Re-test
   the site with a signed-in session; I expect several "remaining issues" to vanish here.
2. **P2.1 + P2.2** — shared `esc` + aria-labels (quick, touches the four new tools).
3. **P1.5 + P1.6** — link `restrictor_dia` and `rear_rc_height` (quick, removes duplicate
   sources of truth).
4. **P1.1** — springs roll gradient. *Decide the convention with me first*, since it changes
   a number we already publish to Validation.
5. **P1.2 + P1.3 + P1.4** — the DAQ correlation scaling and μx split.
6. **P0.2** — route Master writes through `edit_param()`.
7. **P2.4** — readiness amber-on-unfrozen-upstream (the board's credibility).
8. Then P2.3/P2.5/P2.6/P2.7 and the P3 cleanups; regenerate `WORKSPACE_REFERENCE.md` last
   so it documents the fixed state.
