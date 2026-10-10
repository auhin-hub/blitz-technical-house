# MIST Blitz FS Workspace — Build Handoff v2 (supersedes v1)

> **This supersedes `CLAUDE_CODE_HANDOFF.md` (v1).** It keeps every v1 item and
> adds: geometry dual-mode (synthesis + solver) with live front/side diagrams,
> four business/ops tools (Cost/BOM, Budget, Season Gantt, Points predictor), the
> Component Readiness dashboard, and the new promote-to-Master keys that back it.
>
> **Companion files (read these):**
> - `WORKSPACE_REFERENCE.md` — architecture, shared-state model, routes, and the
>   **authoritative existing formulas**. Do not change an existing formula unless
>   an item here says to.
> - `Suspension_Geometry.xlsx` — the reference geometry workbook (Bhavik Joshi).
>   **The synthesis math and the live-diagram series come from here** (P3.1).
> - `daq_channel_plan.csv`, `daq_log_template.csv` — DAQ schemas (v1 P2.3/P2.4).
> - `component_readiness_seed.csv` — seed for the Component Readiness board (P4).
> - **FSAE Japan 2026 cost files** (the `Japan Cost Report files` folder): the 3
>   templates (`FSAEJ_CostReportEntrySheet_2026.xlsx`, `FSAEJ_BOM_Template_2026_v0.xlsx`,
>   `FSAEJ_FCA_Template_2026_v0.xlsx`) and the **`2026 Cost Table Final/`** lookup
>   tables (Materials v18.1, Processes v16.1, ProcessMultipliers v2.0, Fasteners
>   v12.1, Tooling v11.1) + `Cost_Table_Add_Request.xlsx`. Ignore the older
>   `Cost Table/` folder and `~$` lock files.
>
> **Ground rules (unchanged):** tools read green Master cells, store blue inputs in
> `tool_state`, push results via `tool_outputs` (or `vehicle_spec` for MassBudget).
> Every computed value in a pure `compute()`. Preserve the colour legend
> (blue=input, green=linked, black=computed) and the "—" render rule. All new
> Master writes go through the freeze-aware, change-logged `edit_param()` path.

Tiers: **P0** bugs · **P1** feature upgrades to existing tools · **P2** new
engineering tools · **P3** business/ops tools · **P4** Component Readiness board.
Build order is at the end.

---

## Part 0 — New Master keys & tool_outputs to add first

Everything downstream references these, so add them before the tools that use them.

### 0.1 New **Master keys** (`vehicle_spec`) — freezeable, same as any other
These "promote-to-Master" entries make procurement/rules decisions trackable by the
Component Readiness board (P4). They're normal freezeable keys; some hold a
short text/boolean "selected" state rather than a number.

| key | label | unit/type | source | owner team |
|---|---|---|---|---|
| `engine_selected` | Engine chosen (model) | text | input | Powertrain |
| `wheel_selected` | Wheel/rim chosen (size, PCD) | text | input | VD |
| `damper_selected` | Damper chosen (eye-to-eye, travel) | text | input | VD |
| `restrictor_dia` | Intake restrictor Ø (rules) | mm | input | Powertrain |
| `diff_selected` | Differential chosen | text | input | Powertrain |
| `rear_rc_height` | Rear roll-centre height | mm | Geometry | VD |

A text/boolean Master key counts as **green/frozen** when it is non-empty **and**
frozen at a gate — identical freeze mechanic to numeric keys.

### 0.2 New **tool_outputs** (`tool_outputs`) — add contributions where missing
The readiness seed references these; ensure each exists as a contribution:

- **Suspension loads** (`vd_loads`): contribute `pushrod_force_front`,
  `pushrod_force_rear`, `anti_pct_front`, `anti_pct_rear`.
- **Steering** (`vd_steering`): contribute `ackermann_split`,
  `steering_wheel_torque` (from P1.6), `rack_force`.
- **Balance** (`balance`): contribute `arb_front_needed`.
- **Load transfer** (P2.5): contribute `tlltd_front` (derived).
- **Cooling** (`cooling`): contribute `radiator_area` (or `heat_rejection_kw`).
- **Lap sim** (P3.4 / P2.6): contribute `endurance_fuel_l`, `lap_time_s`.

**Rule for P4:** the Component Readiness requirement picker is populated from the
**union of all `vehicle_spec` keys + all `tool_outputs` keys** — so a requirement
can only reference something the workspace actually produces. If a seed row names a
`source_key` that doesn't exist yet, add it per the lists above.

---

## P0 — Bugs & quick fixes (from v1, unchanged)

- **P0.1 Legend swatches transparent** — on every calculator's legend, fill the
  swatch squares: blue→`var(--input)`, green→`var(--linked)`, black→`var(--computed)`.
- **P0.2 MassBudget `y_cg` not shown** — `y_cg=Σ(m·y)/total` is computed; render it
  next to `x_cg`/`z_cg` (mm).
- **P0.3 Brakes target decel not linked** — make the Sizing-tab target deceleration
  a green linked cell reading `accel_brake_target`; fall back to local input + amber
  (P1.4) if the Master key is empty.
- **P0.4 Suspension-loads anti "share" mislabelled; %anti can exceed 1** — relabel
  and split into **anti-dive** (share = that axle's brake-bias fraction) and
  **anti-squat** (share = drive-torque share; RWD rear=1, front=0). Keep
  `antiPct = share·tan(svsa)·(L/h)`; display as %; >100% shows an amber "over 100%
  anti" advisory, not an error (it's physically valid).

---

## P1 — Feature upgrades to existing tools (from v1, unchanged)

- **P1.1 Editable components with assembly grouping** (MassBudget + DAQ): replace
  fixed names with editable rows carrying `name`, `subassembly`, `assembly`; add
  per-assembly subtotals + grand total; seed a default set. Master contributions
  unchanged in maths.
- **P1.2 Proper Izz path**: (a) optional `local_Izz` column per component →
  parallel-axis `Izz = Σ[local_Izz_i + m_i·(dx²+dy²)]`; (b) new Measurement tool
  **Trifilar pendulum** (`ms_trifilar`): `Izz=(m·g·r²·T²)/(4π²·L)`, with
  Contribute→`yaw_inertia`.
- **P1.3 First-pass sourcing tooltips + "Load previous-year baseline" preset** on
  Vehicle Spec (sources, not values — see v1 for the per-key text).
- **P1.4 Freeze-state warnings on linked cells**: empty→amber solid border + "Not
  set"; set-but-unfrozen→amber dashed + "Value not frozen"; frozen→normal green.
  **This is the mechanic P4 reuses for its green lights.**
- **P1.5 CSV import/export + named presets** on all list tools (MassBudget, DAQ,
  chassis mass tracker, wiring, and all new list tools). Round-trip via the shipped
  CSV schemas; presets team-shared in `tool_state`.
- **P1.6 Steering effort sub-calc** (`vd_steering`): reads `track_front`,
  `mu_lat_peak`, `axle_load_front`, `rolling_radius`; inputs caster, pneumatic trail
  (def 30mm), scrub radius, steering-arm length, steering ratio `i`, η. Computes
  kingpin moment, rack force, `steering_wheel_torque`. Contribute the outputs.
- **P1.7 Bias-sweep as decision aid** (`/brakes`): plot optimal(a) vs fixed
  achieved; shade "rear-locks-first" where achieved<optimal; show recommended bias =
  `ff+a·h/L` at `accel_brake_target`.

---

## P2 — New engineering tools

### P2.2 `.tir` tyre-file upload/share/parse (from v1, unchanged)
Upload Pacejka `.tir` to the private Tyre bucket (downloadable by others); parse the
INI-style `KEY=VALUE`; map `UNLOADED_RADIUS`→`rolling_radius` (×1000, offer 0.97×
effective option), `VERTICAL_STIFFNESS`→`tyre_vert_stiffness` (÷1000), `PDY1`(+PDY2·dfz)
→`mu_lat_peak`, cornering-stiffness `Kya=PKY1·FNOMIN·sin(2·atan(Fz/(PKY2·FNOMIN)))`
→`corner_stiffness` (rad→deg). "Write to Master" via `edit_param()`. Keep belt≠track
caveat.

### P2.3 DAQ interpretation module (from v1, unchanged)
Upload a log CSV matching `daq_log_template.csv`; compute g–g scatter, understeer
gradient, roll gradient (from damper L−R), live brake bias, damper-velocity
histogram, slip ratio, ride freq/ζ, tyre-temp spread; show a **design-vs-measured**
correlation table using the `validates` column of `daq_channel_plan.csv`.

### P2.4 DAQ channel plan = editable list (from v1, unchanged)
Editable list matching `daq_channel_plan.csv` columns; group/subtotal by subsystem;
bus-load `= rate·bytes·8·qty`, utilisation `=Σ/capacity·100`→`bus_utilisation`;
CSV+presets.

### P2.5 Load-transfer calculator (from v1, unchanged)
`vd_loadtransfer`: geometric + elastic + unsprung ΔW per axle at `ay`; outputs
per-corner loads and **achieved TLLTD**→ writes `tlltd_front`.

---

## P3 — New tools (geometry rework + business/ops)

### P3.1 — Suspension Geometry: dual-mode, 3D, live front + side diagrams
**Where:** `/geometry`. **This replaces the v1 P2.1 spec.** One shared hardpoint
set is the single source of truth (exported to SolidWorks, read by Validation).
Two modes sit over it; **synthesis writes hardpoints, the solver reads them.**

**Mode A — Solver (analysis; the current forward tool, kept and fixed).**
- Takes the 3D hardpoint set and computes RC/IC/camber/scrub through travel (keep
  the existing circle–circle front-view solver; extend to 3D per below).
- **Fix the broken side view** seen in the current build: the side view must show
  the **side-view swing arm and the anti-dive/anti-squat construction line** from
  the contact patch to the side-view instant centre, scaled to the car — **not** a
  dominating SVSA circle. Clip/scale the view to the wheelbase region.

**Mode B — Synthesis (target-driven; from `Suspension_Geometry.xlsx`).**
- Inputs = desired parameters (match the Excel's input block, cells D11–D28):
  RC height, virtual swing-axle length (VSAL), scrub radius, kingpin inclination,
  lower/upper outer hard-point heights, lower/upper arm lengths, caster, mechanical
  trail, lower/upper inner longitudinal distances (fore & aft), pushrod attach
  points.
- **Generate hardpoints** button *writes* the shared set. Core relations (verbatim
  from the workbook — open it for exactness):
  - `rc_axis_angle = atan(RC_height / (track/2))`
  - `IC_height = VSAL · tan(rc_axis_angle)`
  - lower-arm ground angle `= atan((lower_outer_height − IC_height)/(VSAL − lower_outer_y))`,
    with `lower_outer_y = scrub + tan(KPI)·lower_outer_height`
  - lower-arm spans `= L_lower·cos(angle)` (transverse), `L_lower·sin(angle)` (vertical)
  - inner lower pickup `y = lower_outer_y + x_span`... (and the upper-arm analogues,
    cells D81–D95) → derive inner pickup (x,y,z). Longitudinal x of inner pickups
    from the fore/aft inner-distance inputs (D21–D24).
  - **front-view y/z comes from synthesis; longitudinal x comes from the inner-
    distance inputs** (synthesis is planar — state this in the UI).

**Shared: target-vs-achieved.** Retain the synthesis targets even after hardpoints
are hand-edited or imported from CAD, and show **target vs solved** (RC height
target 50 → solved 48; scrub target 40 → solved 43), using the site's existing
target-vs-achieved pattern. This is how a designer sees drift from intent.

**Live diagrams (both modes).** Reproduce the workbook's scatter diagram as a
**real-time SVG** that redraws on every input change, with hardpoints visibly
moving:
- **Front view (y–z):** 15 two-point line-series exactly as the Excel chart —
  upper arm (outer→inner), lower arm (outer→inner), **three IC construction lines**
  (from upper-outer, lower-outer, and contact-patch each to the IC at (VSAL,
  IC_height)), RC marker at (track/2, RC_height), tyre rectangle (4 edges), chassis
  lines, pushrod. Label IC height/offset, RC height, camber, scrub.
- **Side view (x–z):** side-view swing arm, side-view IC, anti-dive/anti-squat
  lines to the contact patch; updates live as the longitudinal x inputs change.
- Both views share one 3D hardpoint set and move together.

**Export.** "Export hardpoints" → CSV/TXT of all (x,y,z) in a documented
SolidWorks-ready convention (origin = front-axle centre on ground; x rearward,
y right, z up; include a header block). Chassis designer pastes directly.

**Contributes (unchanged):** `rc_height_static`, `rc_migration`, `camber_gain_bump`;
plus `rear_rc_height` when the rear corner is defined.
**Accept:** typing/dragging a hardpoint moves arms + RC/IC lines instantly in both
views; synthesis "Generate" populates the hardpoint set and the solver then reports
target-vs-achieved; export opens in SolidWorks at the right coordinates; side view
no longer shows a runaway circle.

### P3.2 — Cost / BOM tool (FSAE Japan 2026) — staged
**Where:** new `/cost` (own page; link from Home + Chassis/Business). Build the
**BOM capture layer first (Phase 1)**; the per-part **FCA detail is Phase 2**.

**The FSAE-J cost system is three layers** (decoded from the templates):
1. **Cost Tables** (bundled, read-only seed): Materials (unit cost + density),
   Processes (unit cost, unit, category, tooling-required flag), Process Multipliers
   (named factors), Fasteners (size-priced), Tooling (cost + PVF). Ingest the
   `2026 Cost Table Final/` xlsx files once as the dropdown source; **admin can
   re-upload** next year's versions. `Cost_Table_Add_Request.xlsx` = the petition
   format for a missing entry (store requests in a list; no pricing effect until
   approved).
2. **FCA (Final Cost Analysis)** — one card per part. Four cost blocks:
   - **Materials:** pick from Materials table (auto-fills unit cost + density);
     for stock shapes, `mass = volume·density` (Area×Length or size fields) →
     `cost = mass·unit_cost` (or direct unit×qty for catalogue items).
   - **Processes:** pick from Processes table (auto-fills unit cost); `sub =
     unit_cost·quantity·multiplier` (multiplier from the Process Multipliers table,
     e.g. "Repeat 2"=×2).
   - **Fasteners:** pick from Fasteners table (size-priced); `sub = unit_cost·qty`.
   - **Tooling:** pick from Tooling table; `FracIncld = quantity/PVF`,
     `sub = tool_cost·FracIncld` (amortise across the comp's production volume).
   - Assemblies also reference sub-parts (Part block): `sub = part_cost·qty`.
   - Part total = Σ the four blocks (+ sub-parts).
3. **BOM + Cost Summary** (roll-up): every part as a BOM row — `Line, System Code,
   Asm/Prt #, Rev, Component, Description, Unit Cost, Qty, Material, Process,
   Fastener, Tooling, Total, FCA link`. Cost Summary aggregates by **System/Area**
   (Brake, Drivetrain, Frame & Body, Electrical, Misc, Steering, Suspension,
   Wheels…) → **Total Vehicle Cost**.

**Phase 1 (ship first):** the BOM list + Cost Summary. Editable rows with
`name/subassembly/assembly` (reuse P1.1) **plus `system_code` and `team`**; unit
cost either typed or pulled from a table dropdown; system subtotals + total vehicle
cost; CSV import/export matching the BOM template columns (reuse P1.5). Seed systems
from the template's System list.
**Phase 2:** the per-part **FCA card** with the four blocks above and table-driven
dropdowns; BOM `Total Cost` becomes the FCA roll-up; "export to FSAE-J template"
(write the BOM + per-part FCA back into the official `.xlsx` layout so submission is
a download, not a re-type).
**Accept (P1):** a member adds a part under a system with a team, types costs, and
the Cost Summary + total vehicle cost update; CSV round-trips the BOM template.
**Accept (P2):** picking a material/process/fastener/tooling from the dropdown
auto-fills unit cost; a part's four-block FCA total flows into its BOM row; export
produces a template-shaped file.

### P3.3 — Budget panel (planned vs actual)
**Where:** new `/budget`. **Editable item rows; each row MUST carry `subassembly`
and `team`** (VD, Chassis, Aero, Ergonomics, Powertrain, ECS, Brake) — the graphs
and summaries are generated *by team*. Columns: `item, subassembly, team, category,
planned_cost, actual_cost, status, date, notes`. CSV import/export + presets (P1.5).
**Behaviour:**
- **Planned** is a locked baseline once committed (editing a committed plan goes
  through a reason-logged path, like a mini change-log, so overshoot isn't hidden by
  quietly raising the plan).
- **Actual** logged as spend happens; `variance = actual − planned`.
- **Alarms:** amber when a line (or a team's rollup) reaches **≥90%** of its plan,
  red at **≥100%**. Show on the row and on the team summary.
**Views:** per-team planned-vs-actual bar pairs, a total planned-vs-actual gauge,
and a top-overshoots list. (Money is team budget, not a judged doc — distinct from
P3.2 Cost.)
**Accept:** a row without a team/subassembly is rejected; team charts sum only that
team's rows; a line over plan flags red.

### P3.4 — Season Gantt (technical teams)
**Where:** new `/gantt`. **Swimlanes = the 7 technical teams only** (VD, Chassis,
Aero, Ergonomics, Powertrain, ECS, Brake), laid against the build gates **G0–G9** as
vertical milestone markers. Subteam leads add tasks: `task, team, owner, start, end,
depends_on, gate, status, %complete`. CSV import/export + presets.
**Behaviour:** horizontal bars per task in the team's lane; dependency arrows
(`depends_on`); a "today" line; gate markers; overdue tasks flagged. Optional link:
a task may reference a Master key it will freeze, so the Gantt and the Component
Readiness board (P4) can cross-reference ("this task frozen `spring_rate_front`").
**Accept:** a lead adds a task in the VD lane with dates and a dependency; the bar
and arrow render; overdue tasks highlight.

### P3.5 — Points predictor (FS Japan + FS UK, 2026)
**Where:** new `/points`. **Competition selector:** FS Japan 2026 or FS UK 2026
(each with its own static/dynamic point allocation and formulas; code both,
selectable). **Reads:** predicted event times from the lap sim (P2.6) / Events
tools where available; otherwise manual entry.
**Method:** FSAE/FS scoring is **relative to the field**, so each event needs the
competition's best/worst reference (`T_min`, `T_max`, `P_max`, etc.). Implement the
published per-event formulas:
- **Acceleration, Skidpad, Autocross/Sprint, Endurance:** `points = P_max ·
  (T_max/T_team − 1)/(T_max/T_min − 1)` (per each event's defined `T_max` multiple
  and `P_max`); **Efficiency** per its CO₂/energy formula; **Static** events
  (Design, Cost, Business) entered as judged scores.
- Use each competition's 2026 point ceilings (verify FS-UK's at build — IMechE
  adjusts yearly). Inputs for `T_min/T_max`: let the user enter target-comp reference
  times (or last year's results) to calibrate where predicted times would place.
**Outputs:** per-event predicted points + total; a "what-if" (how many seconds to
gain N points). **Accept:** entering predicted times + references yields a per-event
and total score that moves correctly with faster times.

---

## P4 — Component Readiness dashboard
**Where:** new top-nav tab `/readiness` ("Design Readiness"). Seed from
`component_readiness_seed.csv`.

**Data model.** Each **component** has: `name, owner_team, subassembly` and a list of
**prerequisites**. Each prerequisite has: `label, bin (blocking|soft), source_type
(master|tool_output|rules|procurement), source_key, produced_by_team`. The
`source_key` must resolve to a `vehicle_spec` key or a `tool_outputs` key (rules/
procurement ones resolve to the promoted Master keys from Part 0.1).

**Status (reuse the P1.4 freeze mechanic).** Per prerequisite:
- **grey** = source not set
- **amber** = set but not frozen (Master) / contributed but upstream unfrozen
- **green** = frozen (Master key) / contributed (tool_output)

**Readiness.** A component shows **"Ready to start"** only when **every Blocking
prerequisite is green**. Otherwise it displays exactly which blocking items are
pending **and the team that owns each** ("Rear upright blocked on: Brake →
`brake_torque_rear`, Powertrain → `max_wheel_torque`"). Soft items don't block but
show their colour.

**Interactions.**
- **Two bins per component (Blocking / Soft) with drag-drop** to move a prerequisite
  between them. Persist per team.
- **Add component** (name, owner team, subassembly).
- **Add requirement** — picker populated from the **union of all `vehicle_spec` +
  `tool_outputs` keys** (Part 0.2). Free text is not allowed — you can only require
  something the workspace produces.
- CSV import/export + presets (P1.5), matching `component_readiness_seed.csv`.

**Views.** A board grouped by owner team; each component a card with a green/amber
progress ring (green blocking ÷ total blocking) and a "GO" badge when ready; a
filter by team; a "what's blocking the most components" summary (which unfrozen key
is gating the most downstream work — the single most useful thing for a team lead).

**Accept:** freezing `rc_height_static` turns every dependent prerequisite green and
flips the components whose blocking set is now complete to "Ready"; a requirement
that isn't a Master/tool_output key cannot be added; dragging an item from Blocking
to Soft lets a component go "Ready" without it.

---

## Cross-cutting acceptance / non-regression
- No existing `compute()` changes except P0.4 and the new tools; WORKSPACE_REFERENCE
  numbers must still reproduce.
- All new inputs persist via `tool_state`; all Master writes via `edit_param()`.
- Every list tool (MassBudget, DAQ, cost BOM, budget, gantt, readiness, lap-sim
  track, load-transfer) gets CSV import/export + presets.
- Belt≠track tyre caveat stays visible wherever tyre grip appears.
- Mobile: new diagrams (geometry front/side, g–g overlay, histograms, Gantt) render
  in the cockpit single-viewport layout / chip strip.

## Build order
1. **P0.1–P0.4** (fixes) + **Part 0** new Master keys & tool_outputs.
2. **P1.4** (freeze warnings) + **P1.5** (CSV/presets) — infrastructure the rest reuses.
3. **P1.1** editable components (MassBudget + DAQ P2.4).
4. **P1.2, P1.3, P1.6, P1.7** (small self-contained calcs).
5. **P4 Component Readiness** — high value, mostly reuses P1.4; do it early so teams
   get the dependency board fast.
6. **P2.2 `.tir`, P2.3 DAQ interpretation, P2.5 load transfer.**
7. **P3.2 Cost Phase 1, P3.3 Budget, P3.4 Gantt, P3.5 Points** (business block).
8. **P3.1 Geometry** (solver fix + live front view first, then synthesis mode +
   side view) and **P3.2 Cost Phase 2 FCA** — the two largest builds, last.
