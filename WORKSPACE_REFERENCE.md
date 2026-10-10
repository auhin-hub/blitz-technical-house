# MIST Blitz FS Workspace — Complete Reference

> **What this file is.** A single, self-contained description of the MIST Blitz
> Formula Student Workspace website: its purpose, layout, navigation, the shared
> parameter model, and **every calculator with its exact formulas, inputs,
> outputs, and the values it reads from / writes to the shared store.** It is
> written to be pasted into a fresh Claude chat so that Claude understands the
> whole site well enough to produce **guide documents** and **step-by-step
> practice walkthroughs** — "set these goal numbers → here's what to type into
> calculator A → now go to calculator B which uses A's result → …" — end to end.
>
> **For the assistant reading this:** everything below is extracted verbatim from
> the site's source (the pure `compute()` modules and the page definitions), so
> the formulas are the real ones. Treat formulas as authoritative. When you build
> a walkthrough, follow the **data-flow chains** in Part 3 and Part 4 — a value a
> tool *writes to Master* is the value a later tool *reads from Master*. Never
> invent a formula that isn't here; if something isn't covered, say so.

---

## Part 0 — TL;DR of the mental model

- The site is an internal, login-gated web workspace that re-creates the team's
  Excel engineering workbooks as live browser calculators.
- There is **one shared set of car numbers** called the **Master** (a.k.a.
  "Vehicle Spec"). **Golden rule: no private copies of a shared number — you
  enter it once and every tool reads it.**
- Tools **read** some numbers from the Master (shown green/"linked"), take their
  own **inputs** (shown blue, saved for the whole team), **compute** outputs
  (shown black), and some **contribute** a result **back** to the Master so the
  next tool downstream can use it.
- There is a **recommended order** to use the tools (the "VD design sequence",
  9 stages tied to build gates). That order *is* the natural spine of any
  end-to-end guide: Targets → Mass → Tyre → Footprint → Kinematics → Springs →
  Dampers → Instrumentation → Validation.

---

## Part 1 — The website

### 1.1 Purpose & scope
Internal, team-only site for MIST Blitz FSAE. It brings the team's calculators
onto one site, sharing one live set of car parameters so coordination is easy:
run calculators in the browser, share the "Master" spec across every tool, track
design gates with freeze-and-log change control, download the original Excel
workbooks and tyre toolset, and share tyre results + reference PDFs.

### 1.2 Tech stack (so you describe it correctly)
- **Astro** static front-end, near-zero JS; each calculator is a small vanilla
  `<script>` "island." Charts use **Chart.js**. Hosted on **GitHub Pages**.
- **Supabase** backend (free tier): **Auth** (real per-member login, invite-only
  magic-link), **Postgres** (the shared stores), **Storage** (private buckets for
  workbooks, the tyre toolset, tyre plots, resource PDFs).
- Security is via Postgres **Row-Level Security** — an un-authenticated call
  returns nothing. The Supabase anon key is public by design.

### 1.3 Field-colour legend (appears on every calculator)
- **Blue = input** — your own value, saved for the whole team.
- **Green = linked** — read live from the Master (edit it in Vehicle Spec).
- **Black = computed** — a formula result (read-only).
- A linked/empty value renders as **"—"**, never a silent 0.

### 1.4 Layout — the "cockpit"
Each discipline page is a two-pane **cockpit**: a slim **tool rail** on the left
lists that discipline's tools; the right pane shows one tool at a time (inputs →
key outputs → chart on a single viewport). On mobile the rail becomes a chip
strip. Big tools (Brakes, Springs, Geometry, Balance, g–g, MassBudget) are their
own full pages and appear in the rail as a card that links out.

### 1.5 Navigation map
**Landing page (Home `/`)** has:
- A **Dashboard** ("Car at a glance"): KPI tiles pulled from the Master + tool
  contributions (mass, front fraction, CoG height, yaw inertia, target lat g,
  spring F/R, brake bias, roll gradient) and a live **g–g snapshot** chart.
- Quick cards: Gate status, Vehicle Spec, Latest tyre results, g–g diagram,
  "Predictors & helpers" (Events + Measurement).
- The **discipline grid** — six cards, each opens a discipline cockpit.

**Persistent top navigation** (every page):
`Home · VD Workspace · Vehicle Spec · Validation · Tyre · Gates / Phases ·
Resources · Change Log`.

**The six disciplines and their routes:**
| Discipline | Route | Tools (rail) |
|---|---|---|
| Vehicle Dynamics (**VD Workspace**) | `/vehicle-dynamics` | Setup · Suspension geometry → · Springs & dampers → · Suspension loads · Steering · **R&P gear sweep** · Brakes → · Balance → |
| Powertrain | `/powertrain` | Drivetrain & traction · Cooling (Dyno Analyzer) · Gear speed · Intake restrictor |
| Electronics | `/electronics` | Power budget · Wiring/harness · DAQ & Telemetry · Battery sizing · Wire voltage drop |
| Chassis | `/chassis` | Tube stress & FoS · Component-mass tracker · Tube buckling · Bolted joint |
| Aerodynamics | `/aerodynamics` | Downforce/drag vs speed · Aero balance / CoP |
| Ergonomics | `/ergonomics` | Driver fit + egress |

**Standalone calculator pages** (linked from the VD rail or Home):
`/massbudget · /geometry · /springs · /brakes · /balance · /gg`

**Predictors / helpers:** `/events` (accel, skidpad, grip budget) ·
`/measurement` (CoG tilt test, corner-weight, quarter-car ride).

**Platform pages:** `/vehicle-spec` (the Master editor + freeze control) ·
`/validation` (targets vs achieved) · `/tyre` · `/gates` · `/resources` ·
`/change-log` · `/login`.

---

## Part 2 — The shared-state model (how "enter once, see everywhere" works)

### 2.1 The three Supabase tables that matter for calculators
- **`vehicle_spec`** — the **Master**. One row per parameter (`key`, `value`,
  `unit`, `frozen`, `frozen_gate`, …). This is the canonical car spec.
- **`tool_state`** — each tool's own **blue inputs**, stored as one JSON blob per
  tool id, shared across the team and auto-saved (debounced) as you type.
- **`tool_outputs`** — **ToMaster contributions**: results a tool pushes out
  (`key`, `value`, `unit`, `label`) for the Dashboard, Validation, and other
  tools to read. (This is distinct from `vehicle_spec`; MassBudget is the one
  tool that writes straight into `vehicle_spec`.)

### 2.2 The calculator engine (every CalcTool works identically)
`mountCalculator({ root, tool, compute, digits, charts, toMaster })`:
1. reads the green **linked** cells' Master values,
2. loads the team's saved blue **inputs** from `tool_state`,
3. runs the pure `compute(inputs, master) → outputs`,
4. renders outputs (black), draws charts,
5. auto-saves inputs back to `tool_state`,
6. on "Contribute results to Master" writes the mapped outputs to `tool_outputs`.

Every tool's maths lives in a pure function, so formulas are auditable. The
engine only moves numbers between the page and that function.

### 2.3 The Master parameter set (`vehicle_spec`)
Ships **blank** — names/units/typical ranges only; the team fills in the real
car. `source` tells you where a value comes from; **"input"** = typed in Vehicle
Spec, a tool name = contributed by that tool, **`=…`** = computed inside Vehicle
Spec. "Typical" is an orientation range (FS = FSAE-typical, HB = Team Blitz VD
Handbook), **not a target**.

| key | label (symbol) | unit | source | typical |
|---|---|---|---|---|
| `mass_total` | Total mass with driver (m) | kg | MassBudget | 230–300 |
| `mass_frac_front` | Front mass fraction (ff) | – | MassBudget | 0.45–0.50 |
| `cog_height` | CoG height (h) | mm | MassBudget | 250–320 |
| `yaw_inertia` | Yaw inertia (Izz) | kg·m² | MassBudget | — |
| `unsprung_corner` | Unsprung mass per corner | kg | VD | 8–14 |
| `wheelbase` | Wheelbase (L) | mm | input | 1530–1600 (≥1525 rule) |
| `track_front` | Front track (tf) | mm | input | 1200–1300 |
| `track_rear` | Rear track (tr) | mm | input | 1180–1280 |
| `avg_track` | Average track (t) | mm | `=(tf+tr)/2` | — |
| `ride_height` | Ride height | mm | input | 30–50 |
| `mu_lat_peak` | Peak lateral μ (μ) | – | Tyre | 1.4–1.7 (belt ≠ track) |
| `corner_stiffness` | Cornering stiffness (Cα) | N/deg | Tyre | — |
| `slip_peak` | Peak slip angle | deg | Tyre | 6–10 |
| `rolling_radius` | Loaded rolling radius (Re) | mm | Tyre | 220–235 (13") |
| `tyre_vert_stiffness` | Tyre vertical stiffness (Kt) | N/mm | Tyre | 90–130 |
| `accel_lat_target` | Target lateral accel | g | target | 1.4–1.8 |
| `accel_brake_target` | Target braking decel | g | target | 1.3–1.8 |
| `roll_grad_target` | Roll gradient target | deg/g | target | 1.0–1.5 |
| `ride_freq_front` | Ride frequency front | Hz | target | 2.3–2.9 |
| `ride_freq_rear` | Ride frequency rear | Hz | target | 2.5–3.1 (> front) |
| `tlltd_front` | Front lateral load-transfer distribution (TLLTD) | – | VD | 0.45–0.55 |
| `motion_ratio` | Motion ratio wheel→spring (MR) | – | VD | — |
| `weight` | Weight (W) | N | `=m·g` | — |
| `axle_load_front` | Front axle static load | N | `=W·ff` | — |
| `axle_load_rear` | Rear axle static load | N | `=W·(1−ff)` | — |

### 2.4 The ToMaster contribution keys (`tool_outputs`)
These are the results tools push out, and what the Dashboard/Validation/other
tools read. (Tool → key.)
- **Aero:** `cl_a`, `cd_a`, `aero_balance_front`
- **Powertrain traction:** `engine_peak_power`, `final_drive`, `max_wheel_torque`
- **Electronics power:** `battery_mass`, `total_current_draw`
- **DAQ:** `bus_utilisation`
- **Ergonomics:** `driver_mass`, `driver_cog_height`, `seat_back_angle`
- **Chassis tube:** `torsional_stiffness`; **Chassis mass:** `chassis_mass_built`
- **Brakes:** `brake_torque_front`, `brake_torque_rear`, `achieved_front_bias`
- **Springs:** `spring_rate_front`, `spring_rate_rear`, `roll_gradient`
- **Geometry:** `rc_height_static`, `rc_migration`, `camber_gain_bump`
- **Balance:** `understeer_gradient`, `static_margin`
- **MassBudget** writes **directly to `vehicle_spec`:** `mass_total`,
  `mass_frac_front`, `cog_height`, `yaw_inertia`.

---

## Part 3 — The recommended end-to-end flow (the spine of any guide)

The VD Workspace lays the tools out as the **handbook design sequence**, 9 stages
each tied to a build **gate**. This is the order to teach and to walk through.
Each stage says what it needs first, what it produces into the Master, and what
it feeds.

| # | Stage | Gate | Tool / route | Needs first | Produces (→ Master) | Feeds |
|---|---|---|---|---|---|---|
| 1 | Set performance targets | G0 | Targets / LapSim *(not built — enter targets in Vehicle Spec)* | nothing | target lat g, braking g, event focus | everything |
| 2 | Fix mass targets | G0 | **MassBudget** `/massbudget` | targets | mass, front fraction, CoG height, yaw inertia | every load-transfer & balance calc |
| 3 | Choose the tyre | G1 | **Tyre** `/tyre` | mass (operating loads) | peak μ, Cα, rolling radius, peak slip | suspension, brakes, g–g |
| 4 | Set the footprint | G2 | Track & wheelbase (**Vehicle Spec**) | tyre chosen | track F/R, wheelbase → then freeze | kinematics, load transfer, steering |
| 5 | Design the kinematics | G3 | **Suspension geometry** `/geometry` | footprint fixed | hardpoints, RC/camber/caster/scrub, anti-geometry | springs, chassis, uprights |
| 6 | Size springs & bars | G5 | **Springs & dampers** `/springs` | kinematics + motion ratio | spring & ARB rates, ride freq, TLLTD | balance, dampers, validation |
| 7 | Choose dampers | G5 | **Dampers** `/springs` | spring rates set | damper rates, damping ratios | track tuning |
| 8 | Instrument it | G5 | **DAQ & telemetry** `/electronics` | architecture known | sensor & logging channel plan | validation & correlation |
| 9 | Validate & correlate | G8 | **Validation · g–g · Understeer** (`/validation`, `/gg`, `/balance`, `/measurement`) | car built + instrumented | measured CoG, roll gradient, understeer gradient; sim correlation | iteration back into the loop |

**Concrete data-flow chains to exploit in walkthroughs:**
- MassBudget → writes `mass_total, mass_frac_front, cog_height, yaw_inertia` →
  used by **everything** (brakes, springs, loads, balance, traction, g–g, aero %).
- Tyre → `mu_lat_peak, corner_stiffness, rolling_radius` → used by traction,
  brakes (Olley bias), balance (understeer), g–g.
- Powertrain traction → `final_drive` → consumed by the Cooling tool's gearing;
  → launch g is the natural input to g–g's "Launch g" cap.
- Springs → `spring_rate_front/rear, roll_gradient` → Dashboard, Validation, and
  the "from springs" roll-rate inputs of Balance.
- Geometry → `rc_height_static, rc_migration, camber_gain_bump` → Validation EDP
  limits; motion ratio informs Springs.
- Brakes → `achieved_front_bias` → Validation (compare vs Olley optimum).
- Balance → `understeer_gradient` → Validation (sign tells understeer/oversteer).

---

## Part 4 — Every calculator, in detail

> Notation: **Reads** = Master keys used (green). **Inputs** = blue fields
> (label — unit — default/typical). **Formulas** = exactly as computed.
> **Outputs** = black results. **→ Master** = ToMaster contributions.
> `g = 9.81 m/s²` throughout. Speeds convert as `v[m/s] = kmh/3.6`.

### 4.1 Aerodynamics — Downforce / drag vs speed  (`/aerodynamics`, tool `aero`)
- **Reads:** `mass_total`.
- **Inputs:** Cl·A — m² (0.8) · Cd·A — m² (0.6) · air density ρ — kg/m³ (1.18) ·
  aero balance front — – (0.45).
- **Formulas** at speeds 40/60/80/100/120 km/h:
  - `q = 0.5·ρ·v²`
  - `downforce = q·ClA` (N) · `drag = q·CdA` (N)
  - `% of weight = downforce / (mass·g) · 100`
  - `L/D = ClA / CdA`
- **Outputs:** per-speed downforce, drag, %-of-weight; L/D.
- **→ Master:** `cl_a` (from ClA), `cd_a` (from CdA), `aero_balance_front`.

### 4.2 Aerodynamics — Aero balance / CoP  (`/aerodynamics`, tool `aero_balance`)
- **Reads:** `mass_frac_front` (CG front fraction, ff).
- **Inputs:** front Cl·A — m² (0.36) · rear Cl·A — m² (0.44).
- **Formulas:** `total = clAfront + clArear` · `balanceFront = clAfront/total` ·
  `delta = balanceFront − ff` (Δ>0 = front-biased downforce vs the CG).
- **Outputs:** total Cl·A, CoP−CG (front) delta, aero balance (front).

### 4.3 Powertrain — Drivetrain & traction  (`/powertrain`, tool `pt_traction`)
- **Reads:** `rolling_radius`, `axle_load_rear`, `mu_lat_peak`, `mass_total`.
- **Inputs:** engine peak torque — N·m (35.3) · engine peak power — kW (32) ·
  peak-power rpm (9500) · primary reduction (3) · 1st gear ratio (2.5) · final
  drive (3) · driveline efficiency (0.9).
- **Formulas:**
  - `wheelTorque = peakTorque · primary · firstGear · finalDrive · drivelineEff`
  - `tractiveForce = wheelTorque / (rolling_radius/1000)`
  - `tractionLimit = mu_lat_peak · axle_load_rear`
  - `launchAccel = min(tractiveForce, tractionLimit) / (mass_total·g)` (g)
  - `gripLimited = tractiveForce > tractionLimit ? "traction limited" : "power limited"`
- **Outputs:** wheel torque, tractive force, traction limit, launch g, grip-limited?.
- **→ Master:** `engine_peak_power`, `final_drive`, `max_wheel_torque` (=wheelTorque).

### 4.4 Powertrain — Cooling Dyno Analyzer  (`/powertrain`, iframe `tools/cooling.html`)
A self-contained heat-rejection app (dyno data → engine heat load → radiator via
NTU-effectiveness; heat vs speed, fan model, gearing, power/torque curves). Its
physics are the original tool's, re-skinned. It has a **"From Vehicle Spec"**
strip that reads live Master values and offers two labelled one-click links:
- **rolling radius → tyre Ø** (tyre Ø ≈ 2 × `rolling_radius`),
- **final drive → rear sprocket** (keeps front sprocket, sets rear = round(front ×
  `final_drive`); `final_drive` comes from `tool_outputs`).
Total mass is shown for context only — the heat model has no mass input.

### 4.5 Powertrain — Gear speed  (`/powertrain`, tool `pt_gearspeed`)
- **Reads:** `rolling_radius` (Re).
- **Inputs:** engine rpm (9500) · primary reduction (3) · gear ratio (2.5) ·
  final drive (3).
- **Formulas:** `wheelRpm = rpm/(primary·gear·final)` ·
  `speed = wheelRpm·2π·(Re/1000)/60 · 3.6` (km/h).
- **Outputs:** wheel rpm, road speed.

### 4.6 Powertrain — Intake restrictor ⚖  (`/powertrain`, tool `pt_restrictor`)
- **Inputs:** restrictor Ø — mm (20, ⚖ rulebook: 20 petrol / 19 E85) · discharge
  coeff Cd (0.95) · upstream pressure — kPa (101.3) · upstream temp — K (298) ·
  air/fuel ratio (14.7) · fuel LHV — MJ/kg (44) · thermal efficiency (0.3).
- **Formulas** (choked flow, γ=1.4, R=287):
  - `A = π·(dia/1000)²/4`
  - `ṁ = Cd·A·(p0·1000)·√( γ/(R·t0) · (2/(γ+1))^((γ+1)/(γ−1)) )` (kg/s)
  - `maxPower = (ṁ/afr)·(lhv·1e6)·thermalEff` (W)
- **Outputs:** choked air flow (g/s), power ceiling (kW).

### 4.7 Electronics — Power budget  (`/electronics`, tool `elec_power`)
- **Inputs (load currents, A):** ECU+sensors (3) · fuel pump (5) · fan (8) ·
  DAQ+telemetry (2) · dash+lights (2) · ignition/coils (6); plus stator output —
  A (22.1) · main fuse — A (150) · battery mass — kg (4).
- **Formulas:** `total = Σ loads` · `margin = stator − total` (keep positive).
- **Outputs:** total current, margin. **→ Master:** `battery_mass`,
  `total_current_draw` (=total).

### 4.8 Electronics — DAQ & Telemetry  (`/electronics`, tool `daq`)
- **Channels (rate Hz × bytes):** damper pos ×4 (500×8) · IMU (200×12) · wheel
  speed ×4 (200×8) · steering (100×2) · brake pressure (200×4) · throttle
  (100×2) · pushrod load ×4 (500×8) · tyre temp/press (10×8) · GPS (20×16);
  CAN capacity — bit/s (500000).
- **Formulas:** per channel `load = rate·bytes·8` (bit/s) · `total = Σ` ·
  `utilisation = total/capacity·100` (%, keep < 60–70%).
- **Outputs:** per-channel load, total bus load, utilisation. **→ Master:**
  `bus_utilisation`.

### 4.9 Electronics — Battery sizing  (`/electronics`, tool `elec_battery`)
- **Inputs:** average load current — A (26, = from Power budget) · endurance time
  — min (25) · usable depth of discharge — % (80, LiFePO₄) · system voltage — V (12).
- **Formulas:** `ah = loadA·(timeMin/60)/(dodPct/100)` · `wh = ah·voltage`.
- **Outputs:** required capacity (Ah), energy (Wh).

### 4.10 Electronics — Wire voltage drop  (`/electronics`, tool `elec_wiredrop`)
- **Inputs:** conductor area — mm² (2.5, AWG13≈2.6) · run length one-way — m (3) ·
  current — A (20) · system voltage — V (12).
- **Formulas** (copper ρ=1.724e-8 Ω·m, round trip):
  `R = ρ·2·lengthM/(areaMm2·1e-6)` (Ω) · `drop = currentA·R` (V) ·
  `dropPct = drop/systemV·100` (keep < 3%).
- **Outputs:** loop resistance (mΩ), voltage drop (V), % drop.

### 4.11 Electronics — Wiring / harness list  (`/electronics`, section `wiring`)
Not a formula tool: an editable, team-shared grid (one row per wire: src comp,
src name, connector, pins, dst comp, dst name, pin #, colour), stored as JSON, with
a DIN colour-code key. Add/delete rows; auto-saved.

### 4.12 Chassis — Tube stress & FoS  (`/chassis`, tool `chassis_tube`)
- **Inputs:** design member force — N (1455) · tube OD — mm (25) · tube wall — mm
  (2) · material yield — MPa (435) · torsional stiffness target — N·m/deg (1600) ·
  torsional stiffness measured — N·m/deg (0).
- **Formulas:** `sectionArea = π/4·(OD² − (OD−2·wall)²)` (mm²) ·
  `axialStress = force/area` (MPa) · `fos = yield/stress` (target ≥ 1.5).
- **Outputs:** section area, axial stress, factor of safety.
- **→ Master:** `torsional_stiffness` (from the measured twist-test value).

### 4.13 Chassis — Component-mass tracker  (`/chassis`, tool `chassis_mass`)
Grid of 14 components (arms, pushrod, bellcrank, damper, upright, hub, wheel,
tyre, rotor, caliper, fasteners). Per row: `cad = unit·qty` · `delta = measured −
cad`; TOTAL row sums. **→ Master:** `chassis_mass_built` (= measured total; feeds
MassBudget).

### 4.14 Chassis — Tube buckling (Euler)  (`/chassis`, tool `chassis_buckling`)
- **Inputs:** tube OD — mm (25) · tube ID — mm (21) · Young's modulus E — GPa
  (200, steel) · member length L — mm (500) · end-fixity K — – (1, range 0.5–2).
- **Formulas:** `I = π/64·(OD⁴ − ID⁴)` (mm⁴) · `Pcr = π²·(E·1000)·I/(K·L)²` (N).
- **Outputs:** second moment I, critical load Pcr.

### 4.15 Chassis — Bolted joint  (`/chassis`, tool `chassis_bolt`)
- **Inputs:** tensile stress area At — mm² (58, M10≈58) · proof strength — MPa
  (830; grade 8.8≈580, 10.9≈830) · nut factor K — – (0.2, range 0.18–0.22) ·
  nominal diameter — mm (10).
- **Formulas:** `proofLoad = At·proofStrength` (N) · `clamp = 0.75·proofLoad` ·
  `torque = K·(dia/1000)·clamp` (N·m).
- **Outputs:** proof load, target clamp (75%), tightening torque.

### 4.16 Ergonomics — Driver fit + egress  (`/ergonomics`, tool `erg_fit`)
- **Reads:** `wheelbase`.
- **Inputs:** driver height 5th %ile — mm (1600) · 95th %ile — mm (1870) · driver
  mass strapped — kg (75) · driver CoG height — mm (300) · seat-back angle — deg
  (45) · pedal-box adjustment range — mm (275) · steering reach — mm (360) ·
  helmet top → roll-hoop line — mm (60, keep positive).
- **Checklist (pass/fail):** 95th-%ile fits with helmet · 5th-%ile reaches all
  controls · egress < 5 s (timed) · clear view of track & marshals · belts
  anchored per rules.
- **→ Master:** `driver_mass`, `driver_cog_height`, `seat_back_angle`.

### 4.17 Vehicle Dynamics — Setup / kinematics  (`/vehicle-dynamics`, tool `vd_setup`)
A **target sheet** (no computed outputs). **Reads:** `track_front`, `track_rear`,
`wheelbase`, `mu_lat_peak`. **Inputs** (targets, saved for the team): static
camber F/R (−2 / −1 deg) · dynamic camber at max roll (−0.8) · RC height F/R
(30 / 45 mm) · bump steer (≈0) · caster (5 deg) · and more kinematic targets.

### 4.18 Vehicle Dynamics — Suspension loads  (`/vehicle-dynamics`, tool `vd_loads`)
- **Reads:** `mass_total`, `mass_frac_front`, `wheelbase`, `cog_height`. Front
  (f) and rear (r) columns.
- **Inputs per side:** dynamic magnification factor `dmf` · downforce (N) · pushrod
  angle `pushrodAngle` (deg) · anti-geometry force share `share` · side-view
  swing-arm angle `svsaAngle` (deg).
- **Formulas:**
  - static corner: front `= m·g·ff/2`, rear `= m·g·(1−ff)/2`
  - `maxVertical = staticCorner·dmf + downforce`
  - `pushrodForce = maxVertical / sin(pushrodAngle)`
  - `antiPct = share · tan(svsaAngle) · (L/h)` (L, h in mm → ratio)
- **Outputs (per side):** static corner, max vertical, pushrod force, anti %.

### 4.19 Vehicle Dynamics — Steering  (`/vehicle-dynamics`, tool `vd_steering`)
- **Reads:** `wheelbase` (L), `track_front` (t).
- **Inputs:** target turning radius — m (3.5) · kingpin-to-kingpin — mm (1100) ·
  steering-arm length — mm (90) · rack travel lock-to-lock — mm (120) ·
  steering-wheel turns L-to-L — (1.5) · pinion pitch dia d — mm (50) · teeth N (18).
- **Formulas:**
  - `R = turningRadius·1000` (mm);
    `ackermannSplit = atan(L/(R − t/2)) − atan(L/(R + t/2))` (deg)
  - `module m = d/N` · `circularPitch = π·m` · `baseDia = d·cos20°` ·
    `addendum = 0.8·m` · `dedendum = 1.0·m` · `toothThickness = 1.5708·m` ·
    `rackTravelPerRev = π·d`
- **Outputs:** Ackermann split + the gear-geometry set above.

### 4.20 Vehicle Dynamics — R&P gear sweep  (`/vehicle-dynamics`, section `rpsweep`)
A companion sweep (local only). **Input:** pinion PCD — mm (50). For the standard
tooth counts **N ∈ {15,17,19,21,23,25}**: `module = PCD/N` · `circPitch = π·module`
· `toothThk = 1.5708·module` · `addendum = 0.8·module`. Also shows
`rackTravelPerRev = π·PCD` (constant across the sweep). Fewer teeth = coarser
module, thicker/stronger teeth, faster/coarser steering; more teeth = finer,
smoother.

### 4.21 MassBudget & weight / balance  (`/massbudget`)
- **Reads:** `wheelbase`, `track_front`, `track_rear`.
- **Inputs:** per component (22 seeded: arms, pushrods, bellcranks, dampers,
  uprights, hubs, wheels, tyres, rotors, calipers, chassis, engine, drivetrain,
  driver, battery, electronics, bodywork, cooling, misc): **mass (kg)** and
  position **x, y, z (mm)**. Coordinates: x from front axle (0 → wheelbase),
  y from centreline (+ right), z from ground.
- **Formulas:**
  - `total = Σ mass`
  - `x_cg = Σ(mass·x)/total` (same for `y_cg`, `z_cg`)
  - `Izz = Σ mass·(((x−x_cg)/1000)² + ((y−y_cg)/1000)²)` (kg·m²)
  - `frontFraction = 1 − x_cg/wheelbase`
  - plus sprung/unsprung split and per-subsystem totals.
- **Outputs:** total mass, CG (x/y/z), yaw inertia, front fraction.
- **→ Master (directly into `vehicle_spec`):** `mass_total` (=total),
  `mass_frac_front` (=frontFraction), `cog_height` (=z_cg), `yaw_inertia` (=Izz).

### 4.22 Suspension geometry  (`/geometry`)
Front-view double-wishbone kinematics through travel (planar y–z, one corner;
RCVD Ch.17). **Inputs = 6 hardpoints**, each (y, z) in mm: lower inner pivot
(150,120) · upper inner pivot (230,330) · lower outer ball joint (620,135) ·
upper outer ball joint (560,365) · wheel centre (610,228) · contact patch (620,0).
- **Method:** for each heave step, rotate the lower arm about its inner pivot;
  find the upper ball joint as the circle–circle intersection of (upper arm about
  its inner pivot) and (rigid upright length about the new lower ball joint). The
  upright is rigid, so the same transform maps wheel centre and contact patch.
  Then `IC =` intersection of the two extended arm lines; `RC =` where the line
  (contact patch → IC) crosses the centreline y=0; `camber =` upright rotation;
  `scrub =` contact-patch lateral move.
- **Outputs/summary:** static RC height; camber gain per 10 mm bump; RC migration
  over travel; RC/camber/scrub curves.
- **Anti-geometry:** `% anti = share · tan(θ_svsa) · (L/h) · 100`.
- **→ Master:** `rc_height_static`, `rc_migration`, `camber_gain_bump`.

### 4.23 Springs & dampers  (`/springs`)
- **Reads:** `mass_total`, `mass_frac_front`, `tyre_vert_stiffness` (Kt),
  `cog_height`, `track_front`, `track_rear`. Front (f) / rear (r) columns.
- **Inputs per side:** target ride frequency — Hz (f 2.6 / r 2.8; typ 2.3–2.9) ·
  unsprung mass/corner — kg (12; 8–14) · motion ratio wheel→spring (0.9) · chosen
  spring rate — N/mm (0 = none) · wheel travel bump — mm (f 30 / r 25) · droop — mm
  (25) · target damping ratio ζ (0.65; 0.6–0.7).
- **Key correction (tyre in series):**
  - sprung corner: front `= m·ff/2 − unsprung`, rear `= m·(1−ff)/2 − unsprung`
  - ride rate `Kr = (2π·f)²·m_sprung` (N/m)
  - wheel rate `Kw = Kr·Kt/(Kt − Kr)` (tyre spring in series; needs Kt > Kr)
  - spring rate `Ks = Kw/MR²`
  - re-check freq (if a spring is chosen): `Kw' = Ks·1000·MR²`,
    `Kr' = Kw'·Kt/(Kw'+Kt)`, `f' = √(Kr'/m_sprung)/2π`
  - spring travel `= (bump+droop)·MR`
  - critical damping `Cc = 2·√(Kw·m_sprung)`; damper rate `= ζ·Cc`
  - roll stiffness per axle `Kφ = ½·Kw·t²` (N·m/rad → N·m/deg);
    roll gradient `= (m·g·(h/1000) / Kφ_total)·(180/π)` (deg/g)
  - motion ratio helper: `MR = L_damper·cosθ_d / (L_pushrod·cosθ_p)`
- **Outputs:** per side sprung corner, ride rate, wheel rate, spring rate, re-check
  freq, spring travel, critical damping, damper rate; roll stiffness F/R; roll gradient.
- **→ Master:** `spring_rate_front`, `spring_rate_rear`, `roll_gradient`.

### 4.24 Brakes  (`/brakes`) — tabs: **Sizing · Bias sweep · Advanced**
- **Reads:** `mass_frac_front` (ff), `cog_height` (h), `wheelbase` (L),
  `mu_lat_peak` (μ), `rolling_radius`, `mass_total`.
- **Inputs per side (front/rear):** pedal force — N (400) · pedal ratio (5) ·
  master-cyl bore — mm (15.875) · circuits fed (2) · caliper piston bore — mm
  (25) · pistons per side (f 2 / r 1) · pad friction μ (0.45) · rotor outer dia —
  mm (180) · pad radial depth — mm (27). Plus target decel for the sizing point.
- **Sizing formulas (per side):**
  - `pushrodForce = pedalForce·pedalRatio`
  - `mcArea = π·(mcBore/1000)²/4`; `linePressure = pushrodForce/(mcArea·circuits)`
  - `caliperArea = π·(caliperBore/1000)²/4`; `clamp = linePressure·caliperArea·pistons`
  - `friction = clamp·2·padMu`
  - effective radius `= (2/3)·((Ro³−Ri³)/(Ro²−Ri²))/1000`, Ro=OD/2, Ri=Ro−padDepth
  - `brakeTorque = friction·effRadius` (N·m per wheel)
  - `achievedFrontBias = T_front/(T_front + T_rear)`
  - **Olley optimum** `= ff + μ·(h/L)`
  - dynamic axle loads at target decel a: front `= W·(ff + a·h/L)`,
    rear `= W·(1−ff − a·h/L)`; `optimalBiasTarget = ff + a·h/L`
  - required wheel torque front `= (W·a·optimalBias·Re)/2` (rear uses 1−optimalBias)
- **Bias sweep** over a ∈ {0.4,0.6,0.8,1.0,1.2,1.4}g: optimal `= ff + a·h/L`
  vs the fixed achieved hardware bias.
- **Advanced (optional lock-up realism; needs the team's own longitudinal TTC
  Pacejka coefficients):**
  - Magic Formula `Fx = D·sin(C·atan(Bκ − E·(Bκ − atan Bκ)))`, `D = μx·Fz`,
    κ = slip ratio (−1 locked … 0 rolling).
  - Analytic lock-up: front locks at `a = μx·ff/(biasF − μx·h/L)`; rear at
    `a = μx·(1−ff)/((1−biasF) + μx·h/L)`; achievable = min; earlier one locks first.
  - Thermal (one stop): `energy = ½·m·(v1²−v2²)`; per rotor `= energy/nRotors`;
    `ΔT = perRotor/(rotorMass·cp)`; peak temp `= ambient + ΔT`; fade margin
    `= maxTemp − peakTemp`.
  - **Guidance shown in-tab:** sizing never needs Pacejka (constant-μ is fine);
    Advanced only means something with real longitudinal tyre data.
- **→ Master:** `brake_torque_front`, `brake_torque_rear`, `achieved_front_bias`.

### 4.25 Balance  (`/balance`) — understeer + roll-stiffness distribution
- **Reads:** `mass_total`, `mass_frac_front`, `wheelbase`, `corner_stiffness`,
  `tlltd_front`. (On load, both axle `Cα` inputs are seeded to `2·corner_stiffness`.)
- **Inputs:** front axle cornering stiffness Cαf — N/deg (2200) · rear Cαr — N/deg
  (2200) · roll rate from springs F/R — N·m/deg (176.8) · ARB contribution F/R (0) ·
  target front fraction (0.5).
- **Bicycle-model formulas:**
  - `Wf = m·g·ff`, `Wr = m·g·(1−ff)`, `L = wheelbase/1000`
  - understeer gradient `K = Wf/Cαf − Wr/Cαr` (deg/g); K>0 understeer, ≈0 neutral, <0 oversteer
  - static margin `SM = Cαr/(Cαf+Cαr) − (1−ff)`
  - characteristic speed (K>0) `= √(57.3·L·g/K)·3.6` (km/h);
    critical speed (K<0) `= √(−57.3·L·g/K)·3.6`
  - yaw-rate gain(V) `= (V/L)/(1 + (K/57.3)·V²/(g·L))`
- **Roll distribution:** `frontFraction = (ksF+arbF)/((ksF+arbF)+(ksR+arbR))`;
  front ARB needed for a target `= (target·(ksR+arbR) − (1−target)·ksF)/(1−target)`.
- **Outputs:** K, SM, balance verdict, char/crit speed, yaw-gain curve, front
  roll-stiffness fraction, ARB-needed.
- **→ Master:** `understeer_gradient` (=K), `static_margin` (=SM).

### 4.26 g–g diagram  (`/gg`)
The acceleration envelope. **Inputs:** peak longitudinal μ — g (1.4; 1.4–1.6) ·
peak lateral μ — g (1.5; 1.4–1.7) · launch g power/traction limit — g (0.8; from
Powertrain) · max braking g — g (0 = grip-limited; from Brakes) · Cl·A — m² (0.8;
from Aero) · air density ρ — kg/m³ (1.18). (Also reads mass from the Master for
the Home snapshot.)
- **Formulas:**
  - aero factor `k(v) = (W + DF)/W`, `DF = ½·ρ·v²·ClA`, `W = m·g`
  - grip ellipse `(ax/μx)² + (ay/μy)² = 1` (in g), with both axes scaled by k(v)
  - truncated at top by launch g (`accelCap = min(μx·k, accelLimit)`) and at the
    bottom by braking g (`brakeCap = min(μx·k, brakeLimit)`) — a 0 limit means
    "grip-limited, no extra cap".
- **Outputs:** envelope curve + operating points; summary k, latMax, accelCap,
  brakeCap.

### 4.27 Events (predictors)  (`/events`)
- **Acceleration** (`ev_accel`): input launch g (0.8). `a = launchG·g`;
  `time75 = √(2·75/a)` (s); `trapSpeed = a·t·3.6` (km/h).
- **Skidpad** (`ev_skidpad`): inputs μ, radius R (m, ~8.5). `v = √(μ·g·R)`;
  `speed = v·3.6`; `lapTime = 2πR/v`.
- **Grip budget** (`ev_grip`): inputs ax, ay, μ (all g). `used = √(ax²+ay²)`;
  `usedPct = used/μ·100`; `marginG = μ − used`.

### 4.28 Measurement (test-day helpers)  (`/measurement`)
- **CoG tilt test** (`ms_cog`): inputs ΔW — N (200) · wheelbase L — mm (1550) ·
  total weight W — N (2590) · tilt angle θ — deg (30) · wheel radius — mm (228).
  `cogAboveAxle = ΔW·L/(W·tanθ)`; `cogHeight = cogAboveAxle + wheelRadius`.
- **Corner-weight balance** (`ms_corner`): inputs are four corner scale readings
  FL/FR/RL/RR — N (600/620/650/640). `total = ΣW`; `frontPct = (FL+FR)/total·100`;
  `leftPct = (FL+RL)/total·100`; `crossPct = (FR+RL)/total·100`.
- **Quarter-car ride** (`ms_quarter`): inputs spring rate at wheel — N/mm (30) ·
  tyre vertical rate — N/mm (100) · sprung corner mass — kg (50) · unsprung — kg
  (12). Converting N/mm→N/m: `kRide = ks·kt/(ks+kt)`;
  `fnSprung = √(kRide/mSprung)/2π` (Hz); `fnHop = √((ks+kt)/mUnsprung)/2π`.

---

## Part 5 — The coupling map (handbook Table H-1)

"If you change X → direct effect → knock-ons." Read before committing a change.
When a **frozen** Master value is edited, the matching knock-on note is shown in
the change-reason prompt.

| Change | Direct effect | Knock-ons |
|---|---|---|
| Lower CoG height | Less lateral & longitudinal load transfer | More total grip; less dive/squat/roll — usually all-positive. |
| Wider track | Less lateral load transfer | More grip; but more drag, worse packaging, line changes. |
| Longer wheelbase | Less longitudinal transfer; more stable | Heavier; larger turning radius; packaging/line changes. |
| Lighter unsprung mass | Better bump following; less yaw inertia | Steadier contact-patch load → more grip AND quicker direction change (two gains). |
| Stiffer front ARB | More front roll stiffness | Higher front TLLTD → more understeer; lazier yaw. |
| Stiffer rear ARB | More rear roll stiffness | Higher rear TLLTD → more oversteer; watch snap. |
| Stiffer springs (both) | Less roll & ride motion | LESS mechanical grip on bumps; harsher ride. |
| Higher roll centre | More geometric transfer; less roll | Jacking risk, harshness, mid-corner shift if RC migrates. |
| More static negative camber | Better grip in hard corners | Worse braking/traction grip, inner-edge overheating, wear. |
| More caster | More self-centring & corner camber | Heavier steering, fatigue; more dynamic camber. |
| More front Ackermann | Less inside-tyre scrub at low speed | Can be wrong at high load — tie to tyre data. |
| More rebound damping | Better settle control | Car can jack down over bumps → lost travel/grip. |
| Higher tyre pressure | Sharper response, less rolling drag | Smaller patch, centre overheats, peak grip can drop. |
| More front brake bias | Later front lock-up margin | Rear can lock first if over-shifted. |
| More downforce | More grip at speed | More drag; balance shifts with speed; needs stiffer springs. |

**Per-parameter knock-on prompts** (shown when editing a frozen Master key) exist
for: `cog_height, track_front, track_rear, wheelbase, mass_total,
mass_frac_front, unsprung_corner, mu_lat_peak, tlltd_front, ride_freq_front,
ride_freq_rear, motion_ratio, rolling_radius, corner_stiffness`.

---

## Part 6 — Validation targets, gates & change control

### 6.1 Validation page (`/validation`) — target vs achieved
Compares each `tool_outputs` "achieved" value against a Master target or a fixed
EDP (Engineering Design Process) limit:

| Metric | Target | Compare | Achieved key |
|---|---|---|---|
| Roll gradient | `roll_grad_target` | ≈ | `roll_gradient` |
| Understeer gradient (≥0 = understeer) | 0 | ≥ | `understeer_gradient` |
| Camber gain / 10 mm bump | 0.5 deg | ≤ | `camber_gain_bump` |
| RC migration over travel | 60 mm | ≤ | `rc_migration` |
| Torsional stiffness | 1600 N·m/deg | ≥ | `torsional_stiffness` |
| Front spring rate | — | ≈ | `spring_rate_front` |
| Rear spring rate | — | ≈ | `spring_rate_rear` |
| Achieved front brake bias | — | ≈ | `achieved_front_bias` |
| Static RC height | — | ≈ | `rc_height_static` |
| CAN bus utilisation | 70 % | ≤ | `bus_utilisation` |

### 6.2 Gates / Phases (`/gates`) and freeze-and-log
- Build gates **G0–G9**, each open / in-review / signed-off.
- A Master parameter can be **frozen at a gate**. A database trigger **blocks**
  direct edits to a frozen value; the only way to change it is the `edit_param()`
  path, which **requires a reason** and writes a **Change Log** entry (and shows
  the coupling knock-ons first). Freezing/unfreezing is itself logged.
- **Change Log** (`/change-log`) is the audit trail of every frozen-value edit and
  freeze toggle.

---

## Part 7 — Platform features

- **Auth:** invite-only email magic-link (Supabase). Everything is behind login;
  RLS returns nothing to anonymous users.
- **Vehicle Spec editor (`/vehicle-spec`):** edit any Master value; freeze/unfreeze
  at a gate; frozen edits go through the reason-logged path.
- **Dashboard (Home):** KPI tiles + live g–g snapshot from the Master and
  `tool_outputs`.
- **Tyre (`/tyre`):** download the MATLAB tyre toolset (private Storage), a shared
  tyre-results library, and reference guides. Tyre results are anonymised; a
  "belt ≠ track grip" caveat is kept visible wherever tyre numbers appear.
- **Resources (`/resources`):** foldered file-or-link store (PDFs etc.) in a
  private bucket.
- **Workbook downloads:** each discipline page offers the original `.xlsx`
  (private bucket) — the Excel Master stays the authoritative archive.

---

## Part 8 — Constants & conventions (so generated maths matches the site)
- `g = 9.81 m/s²`. Speed: `v[m/s] = km/h ÷ 3.6`.
- Angles in formulas are radians; trig inputs shown in degrees are converted.
- Lengths are **mm** in most tools; convert to m where a formula needs SI (e.g.
  `/1000` on rolling radius, track, wheelbase, CoG height).
- Rates: spring/wheel/tyre rates are entered in **N/mm**, converted to **N/m**
  (`·1000`) inside frequency/damping maths.
- Render rule: non-finite or missing → shown as **"—"**. A tool reading a blank
  Master value shows "—" rather than computing a misleading 0.
- "Typical" ranges are orientation only — **not targets, not validated.**

---

## Part 9 — How to use this file to build guides & practice walkthroughs

When asked for a guide or a step-by-step practice problem, do this:

1. **Pick a spine.** Default to the Part 3 sequence (Targets → Mass → Tyre →
   Footprint → Kinematics → Springs → Dampers → DAQ → Validation). For a
   discipline-only guide, use that discipline's tool rail order.
2. **Set goal numbers up front.** Choose realistic targets from the "typical"
   columns (e.g. mass 250 kg, ff 0.47, CoG 300 mm, μ 1.5, ride freq 2.6/2.8 Hz,
   roll gradient 1.2 deg/g). State them as the "mission."
3. **Walk one tool at a time.** For each tool give: *where to go* (route + rail
   tab), *what it reads from Master* (and therefore what must already be filled
   in), *exactly what to type* into each blue input, the *formula it will apply*,
   and the *expected output*. Then say **"Contribute to Master"** if that tool
   feeds a downstream one.
4. **Hand off along the real data-flow.** The next tool is whichever one *reads*
   the value you just produced (use the chains in Part 3 and each tool's
   "Reads"/"→ Master" lines). Example hand-offs:
   - MassBudget `mass_total, mass_frac_front, cog_height` → **enables** Suspension
     loads, Brakes, Springs, Balance, Traction, g–g.
   - Tyre `mu_lat_peak, corner_stiffness, rolling_radius` → **enables** Traction,
     Brakes (Olley bias), Balance (understeer), g–g.
   - Springs `roll_gradient, spring_rate_*` → check in **Validation**; feed the
     "from springs" roll-rate inputs of **Balance**.
   - Brakes `achieved_front_bias` vs Olley optimum → **Validation**.
   - Geometry `rc_height_static, rc_migration, camber_gain_bump` → **Validation**.
5. **Make the practice math checkable.** Because every formula here is exact, you
   can pre-compute the expected answer for the chosen inputs and tell the learner
   what number they should see — then interpret it (e.g. "K = +0.3 deg/g → mild
   understeer, good; characteristic speed ≈ … km/h").
6. **Teach the couplings.** When a step changes a sensitive parameter, cite the
   Part 5 knock-ons ("you lowered CoG — re-check load transfer, brakes, g–g").
7. **Respect integrity.** Use only the formulas, inputs, and Master keys in this
   file. If a learner asks for something not represented (a tool not here, a
   formula not listed), say it isn't in the workspace rather than inventing it.
   Keep honest labels (e.g. the tyre belt-vs-track grip caveat).

### A worked micro-example (pattern to imitate)
> **Goal:** mild understeer on a 250 kg, front-47% car with a 1550 mm wheelbase.
> 1. **MassBudget** (`/massbudget`): enter component masses/positions so total ≈
>    250 kg, front fraction ≈ 0.47, CoG z ≈ 300 mm → **Contribute** (writes
>    `mass_total, mass_frac_front, cog_height, yaw_inertia`).
> 2. **Vehicle Spec**: set `wheelbase = 1550`, and from Tyre set
>    `corner_stiffness ≈ 1100 N/deg` (per tyre).
> 3. **Balance** (`/balance`): it reads mass, ff, wheelbase, corner_stiffness; it
>    seeds Cαf = Cαr = 2200 N/deg. Expected `K = Wf/Cαf − Wr/Cαr`
>    `= (250·9.81·0.47)/2200 − (250·9.81·0.53)/2200 ≈ −0.066 deg/g` → slight
>    **oversteer**. To hit mild understeer, raise front Cα or shift balance
>    (more front roll stiffness / ARB) and re-check — then **Contribute**
>    `understeer_gradient`, and confirm it's ≥ 0 on **Validation**.

*(Numbers above illustrate the method; recompute for whatever goals you set.)*
