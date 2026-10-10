# MIST Blitz FS Workspace — Change & Build Handoff for Claude Code

> **Companion files in this repo:** `WORKSPACE_REFERENCE.md` (architecture,
> shared-state model, routes, and the *authoritative existing formulas*) and the
> two DAQ schemas at **`public/templates/daq/daq_channel_plan.csv`** and
> **`public/templates/daq/daq_log_template.csv`** (they define the new DAQ
> schemas and ship as downloadable templates). **Do not change any existing
> formula** unless an item here says to. Keep the shared-state contract intact:
> tools **read** green Master cells, store blue inputs in `tool_state`, push
> results via `tool_outputs` (or `vehicle_spec` for MassBudget). Every new
> computed value goes in a pure `compute()` so it stays auditable. Preserve the
> colour legend (blue=input, green=linked, black=computed) and the "—" render rule.

Work the tiers in order. **P0 = bugs (fast, ship first). P1 = requested features.
P2 = new tools (bigger builds).** Each item has **Where / Do / Accept**.

## Progress log
- **2026-10-10 — P0 complete** (branch `vd-extras`): P0.1 legend swatches now use
  solid state-colour fills; P0.2 MassBudget `y_cg` tile added + rendered; P0.3
  Brakes sizing target decel links to `accel_brake_target` (read-only/green when
  set, local fallback when blank); P0.4 Suspension-loads anti-geometry relabelled
  (front = brake-bias/anti-dive, rear = drive-share/anti-squat), shown as % with a
  ">100% over-compensated" advisory, workbook formula + its test untouched.

---

## P0 — Bugs & quick fixes

### P0.1 — Legend colour swatches are transparent
**Where:** the shared legend component on every calculator.
**Do:** the little square before each legend label renders with no fill. Give each
swatch its colour: blue swatch → `var(--input)` (blue), green → `var(--linked)`
(green), black → `var(--computed)` (black/ink). Match the actual field colours.
**Accept:** every calculator's legend shows three correctly coloured squares.

### P0.2 — MassBudget `y_cg` not displayed
**Where:** `/massbudget` (`MassBudget`).
**Do:** `y_cg = Σ(m·y)/total` is already computed but not rendered. Add it to the
outputs next to `x_cg` and `z_cg` (unit mm). Keep everything else unchanged.
**Accept:** with symmetric inputs `y_cg` shows ≈ 0; with an offset mass it moves.

### P0.3 — Brakes "target decel" not linked to Master
**Where:** `/brakes` → **Sizing** tab.
**Do:** the sizing-point target deceleration is a local blue input; it should be a
**green linked** cell reading `accel_brake_target` from the Master. If that Master
key is empty, fall back to the current local input (and show "—"-style amber per
P1.4). The Bias-sweep tab's fixed sweep range stays as-is.
**Accept:** editing `accel_brake_target` in Vehicle Spec changes the Brakes sizing
target live.

### P0.4 — Suspension loads: anti-geometry "share" is mislabelled; %anti can read >1
**Where:** `/vehicle-dynamics` → Suspension loads (`vd_loads`).
**Do:** the input currently called "share" is the **anti-geometry force share**,
not brake bias — users read it wrong. Split the anti calculation into two clearly
labelled cases and keep the existing formula core (`antiPct =
share·tan(svsa)·(L/h)`):
- **Anti-dive (braking):** `share` = that axle's **brake bias fraction**
  (front axle uses front bias, rear uses 1−front bias).
- **Anti-squat (acceleration):** `share` = **drive-torque share** (for RWD: rear
  = 1.0, front = 0).
Display the result as a **percentage** (×100) with a clear "% anti-dive / % anti-
squat" label. A value **>100% is physically valid** (over-compensated) — don't
clamp it; show an amber "over 100% anti" note instead.
**Accept:** labels read "anti-dive %"/"anti-squat %"; values show as % (e.g. 55%);
>100% shows an advisory, not an error.

---

## P1 — Requested features

### P1.1 — MassBudget & DAQ: user-defined components with assembly grouping
**Where:** `/massbudget`, and the DAQ channel list (see P2.4).
**Do:** replace the fixed seeded component names with **editable rows**. Each row
gains three text fields: **`name`**, **`subassembly`** (e.g. "Wheel assembly"),
**`assembly`** (e.g. "Suspension"). Add/delete rows freely. Keep all existing
per-row numeric fields and formulas. Add **per-assembly subtotals** (mass, and for
MassBudget a per-assembly CG) plus the grand total. Seed a sensible default set so
the tool isn't empty, but let users rename/regroup everything.
**Accept:** a user can add "Upright" under subassembly "Wheel assembly" / assembly
"Suspension"; the Suspension subtotal sums all its rows; the Master contributions
(`mass_total`, `mass_frac_front`, `cog_height`, `yaw_inertia`) are unchanged in
maths.

### P1.2 — Proper yaw-inertia (Izz) path
**Where:** `/massbudget` + a new Measurement tool.
**Do:** the current `Izz = Σ m·((dx)²+(dy)²)` is a point-mass estimate and reads
low. Two additions:
1. **Optional `local_Izz` column (kg·m²) per component.** When filled, use
   parallel-axis: `Izz = Σ[ local_Izz_i + m_i·(dx_i² + dy_i²) ]` with
   `dx=(x−x_cg)/1000`, `dy=(y−y_cg)/1000`. Empty `local_Izz` → treat as 0 (current
   behaviour). Add a one-line hint: "Enter each assembly's local Izz from CAD
   (SolidWorks Mass Properties) for a real value; point masses under-count."
2. **New Measurement tool — Trifilar pendulum (`ms_trifilar`)** at `/measurement`.
   Inputs: total swung mass `m` (kg), suspension radius `r` (mm), wire length `L`
   (mm), oscillation period `T` (s). Formula: `Izz = (m·g·r²·T²)/(4π²·L)` (convert
   r, L to m). Output measured yaw inertia; offer "Contribute to Master →
   `yaw_inertia`" so a measured value can overwrite the CAD estimate.
**Accept:** filling `local_Izz` raises Izz; the trifilar tool returns a sane value
(e.g. m=250, r=600, L=2000, T=3.0 → Izz ≈ `(250·9.81·0.36·9)/(39.478·2.0)` ≈
100.6 kg·m²) and can write `yaw_inertia`.

### P1.3 — First-pass guidance on the Master + baseline preset
**Where:** `/vehicle-spec`.
**Do:** a rookie doesn't know where first-pass numbers come from. Add a small
**info tooltip** per key stating the first-pass *source* (not a value), e.g.:
- wheelbase/track → "packaging + rules (wheelbase ≥ 1525 mm; smaller track ≥ 75%
  of larger) + last year's car"
- ride_height → "suspension travel + ground clearance + aero; start from last car"
- unsprung_corner → "sum the corner's parts from CAD/last car"
- tlltd_front → "a target you pick (~0.5); achieved comes from springs/ARB later"
- motion_ratio → "from the linkage: damper travel ÷ wheel travel"
Also add a **"Load previous-year baseline" preset** (see P1.5 preset system):
loads a saved full-Master set so a new designer starts from last year, not blank.
**Accept:** hovering a Master key shows its sourcing hint; the baseline preset
populates the whole Master in one click.

### P1.4 — "Value not frozen / not set" warning on linked cells
**Where:** the calculator engine, for every **green linked** cell.
**Do:** when a tool reads a Master key, check that key's state:
- **Empty** → render "—" with an **amber solid border**; tooltip: "Not set in
  Vehicle Spec yet."
- **Set but `frozen = false`** → render the value with an **amber dashed border**;
  tooltip: "Value not frozen — may still change."
- **Frozen** → normal green, no warning.
Pull `frozen`/`frozen_gate` from `vehicle_spec` (already stored).
**Accept:** an unfrozen linked value shows a dashed amber border + tooltip; freezing
it in Vehicle Spec clears the warning live.

### P1.5 — CSV import/export + named presets on all list tools
**Where:** `/massbudget`, DAQ channel list, `/chassis` mass tracker, wiring list —
any grid/list tool.
**Do:** three controls on each:
1. **Download CSV template** — exports the tool's current columns (with headers) and
   current rows, so a member can edit in Excel. For MassBudget/DAQ use the exact
   column order of the shipped CSVs.
2. **Upload CSV** — parse and load rows (validate headers; show a clear error on
   mismatch). Ask replace-vs-append.
3. **Save as named preset / Load preset** — store a labelled input set (in
   `tool_state`, keyed by a name) the team can reload later. This also backs the
   P1.3 "previous-year baseline."
**Accept:** export → edit in Excel → re-upload round-trips without data loss;
presets persist across sessions and are team-shared (RLS as usual).

### P1.6 — Steering effort sub-calc
**Where:** `/vehicle-dynamics` → Steering (`vd_steering`), new section/tab.
**Do:** add a pure compute for steering effort. **Reads:** `track_front`,
`mu_lat_peak`, `axle_load_front`, `rolling_radius`. **Inputs:** caster angle (deg),
pneumatic trail (mm, from TTC `Mz/Fy`, default 30), scrub radius (mm, default 10),
steering-arm length (mm, reuse the existing field), overall steering ratio `i`
(deg SW / deg road, default 5), efficiency η (0.9). **Formulas (per front tyre,
worst-case max lateral):**
- `Fy_tyre = mu_lat_peak · (axle_load_front/2)`
- `t_mech = (rolling_radius/1000)·sin(caster)` (+ optional ground offset)
- `M_kp = Fy_tyre·((t_mech) + pneumatic_trail/1000) + 0` (scrub·Fx term optional,
  default Fx=0 for pure cornering)
- `rack_force = (2·M_kp)/(steering_arm_length/1000)`
- `steering_wheel_torque = (2·M_kp)/(i·η)`
**Outputs:** kingpin moment per tyre, rack force, steering-wheel torque. Add a note:
"worst case is low-speed/parking — size driver effort here."
**Accept:** reasonable numbers (SW torque on the order of a few N·m for FS geometry);
all inputs save; nothing else in Steering changes.

### P1.7 — Brakes Bias-sweep: make it a decision aid
**Where:** `/brakes` → **Bias sweep** tab.
**Do:** keep the existing sweep (`optimal = ff + a·h/L` over a ∈ {0.4…1.4}g vs the
fixed achieved bias). Add: (a) plot the optimal curve and the fixed achieved line
together; (b) **shade the region where achieved < optimal** as "rear-locks-first
(danger)"; (c) a **recommended bias readout** = the optimal value at
`accel_brake_target` (the max expected decel). Short caption explaining: pick
hardware so you're slightly front-biased at peak decel.
**Accept:** the danger zone shades correctly; recommended bias equals `ff + a·h/L`
at the target decel.

---

## P2 — New tools & bigger builds

### P2.1 — Suspension Geometry: full 3D, live front + side view, construction lines
**Where:** `/geometry`. This is the biggest item; do it in two shippable phases.

**Extend the model to 3D.** Today hardpoints are front-view only (y, z). Add a
**longitudinal `x`** to every hardpoint so each is (x, y, z), and add the
side-view pickups needed for anti-geometry (front/rear inner pivot x-positions
define the side-view swing arm). Keep the existing front-view circle-circle solver
for camber/scrub/RC; add a **side-view solver** for anti-dive/anti-squat and
pitch-plane geometry from the x-coordinates.

**Phase 1 (ship first): live front-view diagram + export.**
- Render a **real-time SVG** of the front-view corner: lower arm, upper arm,
  upright, wheel, contact patch, and **construction lines** — the two arm lines
  extended to the **instant centre (IC)**, the line from contact patch through IC
  to the **roll centre (RC)** on the centreline. Label IC height & lateral
  distance, RC height, camber angle, scrub. **Everything redraws live as any
  hardpoint input changes.**
- **Hardpoint export button** → CSV/TXT of all hardpoints in a **documented
  coordinate convention that maps to SolidWorks** (state the origin = front axle
  centre on the ground, x = rearward, y = right, z = up; include a header block
  describing it) so the chassis designer can paste x/y/z straight into the model.

**Phase 2: full 3D with side view.**
- Add a **side-view (x–z) schematic** alongside the front view, both live: show the
  side-view swing arm, the **side-view IC**, and anti-dive/anti-squat construction
  lines, updating in real time as x-coordinates change.
- Show front **and** side hardpoints moving together in real time when any input
  changes; keep the two views synced to one 3D hardpoint set.
- Extend outputs: bump steer, roll steer, caster, and anti-dive/anti-squat % (tie
  to the P0.4 anti model). Export remains the full 3D x/y/z set.
**Accept (P1):** dragging/typing a hardpoint moves the arms and the RC/IC lines
instantly; export opens in SolidWorks at the right coordinates. **Accept (P2):**
side view renders and updates with x-changes; a chassis member can place all
hardpoints from the export without manual conversion.
**Contributes (unchanged):** `rc_height_static`, `rc_migration`, `camber_gain_bump`.

### P2.2 — `.tir` tyre-file upload, share, and parse-into-Master
**Where:** `/tyre`.
**Do:** the team has a MATLAB program that outputs a **`.tir` (Pacejka Tyre
Property File)**. Add:
1. **Upload `.tir`** into the private Tyre Storage bucket (same pattern as the
   existing MATLAB toolset), labelled (tyre name, compound, date). **Other members
   can download** it.
2. **Parse the `.tir`** (it's an INI-like `KEY = VALUE` text file) and show the
   extracted tyre parameters, then offer **"Write to Master."** Field mapping:
   - `UNLOADED_RADIUS` (m) → `rolling_radius` = `×1000` mm. Note: effective rolling
     radius ≈ 0.97×unloaded; offer both and let the user pick which writes.
   - `VERTICAL_STIFFNESS` (N/m) → `tyre_vert_stiffness` = `÷1000` (N/mm).
   - `PDY1` (+`PDY2`·dfz at operating Fz) → `mu_lat_peak` (peak lateral μ).
   - Cornering stiffness → `corner_stiffness`: `Kya = PKY1·FNOMIN·sin(2·atan(Fz/
     (PKY2·FNOMIN)))` evaluated at operating `Fz` (default `Fz = FNOMIN`), then
     **convert rad→deg**: `corner_stiffness = Kya·π/180` (N/deg).
   - `slip_peak`: compute numerically by sweeping the MF lateral curve `Fy(α)` for
     the α at peak Fy (optional; if too involved, leave the existing field and flag
     "set manually").
   Keep the **belt ≠ track** caveat visible wherever these populate.
**Accept:** uploading a valid `.tir` lists it for download by others; parsing shows
`rolling_radius`, `tyre_vert_stiffness`, `mu_lat_peak`, `corner_stiffness`; "Write
to Master" updates `vehicle_spec` (through the normal edit path, honouring freezes).

### P2.3 — DAQ interpretation module (the correlation engine)
**Where:** `/electronics` DAQ area (or a new `/daq` page linked from it).
**Do:** accept an uploaded **log CSV** matching `daq_log_template.csv` and compute
measured-vs-design correlations. Parse flexibly (ignore missing columns; match by
header name). Produce these math channels / summaries and **compare each to the
design value it validates**:

| Output | Compute from | Compare to |
|---|---|---|
| g–g scatter | `ax_g`, `ay_g` | g–g envelope (`/gg`) |
| Understeer gradient K (deg/g) | slope of `(steer_deg/i − Ackermann) vs ay_g` across speed | Balance `understeer_gradient` |
| Roll gradient (deg/g) | roll angle = `(damper_L − damper_R)/track → deg`, vs `ay_g` | Springs `roll_gradient` (target 1.2) |
| Live brake bias | `brake_pres_F/(brake_pres_F+brake_pres_R)` under braking | Olley / `achieved_front_bias` |
| Damper velocity histogram | `d(damper)/dt`, binned (±25 mm/s low/high split) | damper tuning (look for symmetry) |
| Slip ratio | `wheelspd_* vs speed_gps` | traction / lock |
| Ride freq & ζ | free-decay FFT/log-dec of a damper channel after a bump | `ride_freq_*`, ζ |
| Tyre temp spread | `in − out` per tyre | camber/pressure targets |

Show a **correlation table**: design value | measured value | Δ | pass/within-band.
Reference `daq_channel_plan.csv`'s `validates` column to label which design param
each channel backs. Keep logged data in a private bucket; results shareable like
the tyre library.
**Accept:** uploading the sample `daq_log_template.csv` yields a g–g scatter, a
measured roll gradient and a measured brake bias, each shown next to the design
number.

### P2.4 — DAQ channel plan = editable component list
**Where:** the DAQ tool (`daq`).
**Do:** replace the fixed channel set with an **editable list** (same pattern as
P1.1) whose columns match `daq_channel_plan.csv`: `channel_id, channel_name,
sensor_type, qty, location, rate_hz, bytes_per_sample, unit, range_min, range_max,
subsystem, validates, notes`. Add/delete channels; group/subtotal by `subsystem`.
Keep the bus-load maths: `load = rate_hz·bytes_per_sample·8·qty`,
`utilisation = Σload/CAN_capacity·100`. Seed from `daq_channel_plan.csv`. Wire in
CSV import/export + presets (P1.5). **→ Master:** `bus_utilisation` (unchanged).
**Accept:** a user adds a channel; bus utilisation updates; the plan exports/imports
via the shipped CSV schema.

### P2.5 — Load-transfer calculator (new VD tool)
**Where:** `/vehicle-dynamics` rail (new tool `vd_loadtransfer`) or a standalone
page. **Reads:** `mass_total`, `mass_frac_front`, `cog_height`, `track_front`,
`track_rear`, `unsprung_corner`, and front/rear roll-centre heights (`rc_height_
static` from Geometry, plus a rear RC input), and front/rear roll stiffness (from
Springs `tool_outputs`). **Input:** lateral accel `ay` (g, default = `accel_lat_
target`). **Steady-state model (per axle):**
- Geometric: `ΔW_geo = (W_axle · ay · z_RC)/t`
- Elastic: roll moment `M = W_sprung·ay·(h − h_roll_axis)`, split by roll-stiffness
  fraction `K_axle/ΣK`, then `ΔW_elastic = M·(K_axle/ΣK)/t`
- Unsprung: `ΔW_unsprung = W_unsprung_axle·ay·h_unsprung/t`
- `ΔW_axle = ΔW_geo + ΔW_elastic + ΔW_unsprung`; per-corner load = static ± ΔW.
**Outputs:** per-corner vertical loads at `ay`, front/rear ΔW, and the **achieved
TLLTD** = `ΔW_front/(ΔW_front+ΔW_rear)`. **→ Master:** write the computed
`tlltd_front` (so the current *guessed* TLLTD becomes a *derived* one; feeds
Balance). Show it next to the user's target TLLTD.
**Accept:** TLLTD comes out in 0.45–0.55 for balanced inputs and responds correctly
to stiffer front roll stiffness (TLLTD_front ↑).

### P2.6 — Lap-time simulator (fills the Stage-1 Targets gap)
**Where:** new `/lapsim` (also surface on Home as the missing "Targets/LapSim").
**Do:** a **quasi-steady point-mass** sim. **Reads:** `mass_total`, g–g inputs
(`mu_lat_peak`/peak long μ, launch g, braking g), `cl_a`, `cd_a`, ρ, and powertrain
`max_wheel_torque`/`final_drive` for straight-line accel. **Track input:** an
editable segment list (straight length, or corner radius + arc length), with CSV
import/export + presets (P1.5); seed a simple autocross-like loop.
**Method:**
- Corner speed: `v_corner = sqrt(mu_lat·g·R·k_aero(v))`, solved by iterating
  `k_aero(v) = (W + ½ρv²ClA)/W`.
- Straights: accelerate from previous corner-exit speed at
  `a = min(power-limited, traction-limited)·g` (reuse traction/g–g logic), then
  brake into the next corner at `brake_g·k_aero(v)`; integrate time over distance.
- Lap time = Σ segment times. Map to events: **accel** (75 m from `/events`),
  **skidpad** (`/events`), **autocross** = one lap, **endurance** = laps × lap time.
  Optionally accept reference/best times to estimate FSAE points (points formulas
  need the comp's best + max; keep points optional, predicted *times* are the core).
**Accept:** a closed track returns a plausible lap time; raising `mu_lat_peak`
lowers it; adding downforce lowers corner times but raises drag on straights.

### P2.7 — Setup-sheet generator
**Where:** new `/setup-sheet` (or a button on Home/Validation).
**Do:** one-click **export of a track setup sheet** from the current Master +
`tool_outputs`: tyre hot-pressure targets, static cambers (from `vd_setup`), spring
rates F/R, ARB settings, ride heights, brake bias, damper settings, corner weights.
Export as CSV and as a printable sheet. Read-only snapshot (doesn't change Master).
**Accept:** the sheet reflects the live Master values and prints cleanly.

---

## Cross-cutting acceptance / non-regression
- No existing `compute()` formula changes except P0.4 (anti split) and the new
  tools. The WORKSPACE_REFERENCE numbers must still reproduce.
- All new inputs persist via `tool_state`; all new Master writes go through the
  existing (freeze-aware, change-logged) `edit_param()` path.
- New list tools (DAQ, load-transfer track, lap-sim track) get CSV + presets.
- Keep the belt≠track tyre caveat visible wherever tyre grip numbers appear.
- Mobile: new diagrams (geometry views, g–g overlay, histograms) must render in the
  cockpit's single-viewport layout / chip strip.

## Suggested build order
1. P0.1–P0.4 (an afternoon of fixes). ✅ done 2026-10-10
2. P1.4 (freeze warnings) + P1.5 (CSV/presets) — they're infrastructure the rest
   reuses.
3. P1.1 / P2.4 (editable components for MassBudget + DAQ) together.
4. P1.2, P1.3, P1.6, P1.7 (small self-contained calcs).
5. P2.2 (`.tir`) and P2.3 (DAQ interpretation) — high value, moderate size.
6. P2.5 (load transfer), P2.6 (lap sim), P2.7 (setup sheet).
7. P2.1 Geometry Phase 1, then Phase 2 (largest).
