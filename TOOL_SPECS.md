# MIST Blitz FS Workspace — Per-Tool Build Spec

Companion to `BRIEF.md`. Extracted directly from the actual workbook formulas
(`MIST_Blitz_FS_Master_Workbook.xlsx` + the seven `team_files/*.xlsx`). This is
the build list for the calculators: port **these** formulas; do not invent or
"improve" them without Tahmid's sign-off. The exact Excel formula is given so
nothing is lost in translation.

**Convention (from the workbook colour legend):** input = member-typed; linked =
read from the shared Master store (read-only in the tool); computed = formula
output (read-only). In the UI, show these three states distinctly (the brief's
blue / green / black legend).

**Note on the live-link mechanism.** The workbooks use Google Sheets IMPORTRANGE
to pull from a shared Master. The website replaces that with the Supabase
**Vehicle Spec (Master) store** — same concept (one shared source of truth),
but with real logins, freeze/lock, and change logging. Each tool's `FromMaster`
list below = the parameters it reads from the store; its `ToMaster` list = the
results it writes back.

---

## 0. Vehicle Spec (Master) store — the shared schema

The canonical parameters every tool reads from / writes to. Seed values shown are
the current workbook values (treat as defaults, editable). Mass, mass fraction,
CoG and axle loads are themselves computed in the Master from the **MassBudget**
(build MassBudget as a sub-tool of Vehicle Spec; everything else flows from it).

| Key | Parameter | Symbol | Unit | Seed | Source |
|---|---|---|---|---|---|
| mass_total | Total mass (with driver) | m | kg | 264 | MassBudget |
| mass_frac_front | Front mass fraction | — | - | 0.4569 | MassBudget |
| cog_height | CoG height | h | mm | 263.4 | MassBudget |
| wheelbase | Wheelbase | L | mm | 1550 | input |
| track_front | Front track | — | mm | 1200 | input |
| track_rear | Rear track | — | mm | 1180 | input |
| ride_height | Ride height | — | mm | 40 | input |
| mu_lat_peak | Peak lateral μ | — | - | 1.5 | Tyre |
| corner_stiffness | Cornering stiffness | Cα | N/deg | 1100 | Tyre |
| rolling_radius | Loaded rolling radius | — | mm | 228 | Tyre |
| accel_lat_target | Target lateral accel | — | g | 1.5 | target |
| motion_ratio | Motion ratio (wheel→spring) | MR | - | 0.7 | VD |
| axle_load_front | Front axle static load | — | N | 1183.2 | =mass·g·ff |
| axle_load_rear | Rear axle static load | — | N | 1406.6 | =mass·g·(1−ff) |

Each parameter row also carries: **frozen** flag + the **gate** that froze it +
**confidence** (Live/Est) + **source**. Freezing is enforced per BRIEF §E5.

---

## 1. Aero  (`Blitz_Aero_WorkingFile.xlsx`)
**Reads:** ride_height, cog_height, mass_total, accel_lat_target.
**Inputs:** Cl·A = 0.8 m², Cd·A = 0.6 m², air density ρ = 1.18 kg/m³,
aero balance front = 0.45.
**Computes** (per speed row, speeds 40/60/80/100/120 km/h; `v = kmh/3.6`):
- Downforce N = `0.5*ρ*v²*ClA` → `=0.5*B8*(A/3.6)^2*B6`
- Drag N = `0.5*ρ*v²*CdA` → `=0.5*B8*(A/3.6)^2*B7`
- % of weight = `Downforce/(mass_total*9.81)`
- L/D = `ClA/CdA`
**Chart:** downforce & drag vs speed (line), + downforce-%-of-weight.
**Writes:** Cl·A, Cd·A, aero balance (front).

## 2. Chassis  (`Blitz_Chassis_WorkingFile.xlsx`)
**Reads:** mass_total, cog_height, wheelbase, track_front, track_rear,
axle_load_front, axle_load_rear.
Two parts.
**(a) Tube / FoS calc.** Inputs: design member force = 1455 N (from LoadCases),
tube OD = 25 mm, wall = 2 mm, yield = 435 MPa.
- Section area = `π/4*(OD²−(OD−2·wall)²)`
- Axial stress = `force/area`
- Factor of safety = `yield/stress` (target ≥ 1.5)
- Torsional stiffness: target 1600 N·m/deg; measured (twist test) entered later.
**(b) ComponentMass tracker** (CAD vs measured, per component): rows for
front/rear upper & lower arms, pushrod, bell crank, damper, upright, hub, wheel,
tyre, rotor, caliper, fasteners. Per row: CAD total = `unit·qty`, Δ = `meas−CAD`;
TOTAL = sums. This feeds the MassBudget.
**Writes:** chassis mass (as built) → MassBudget; torsional stiffness (measured).

## 3. DAQ / Telemetry  (`Blitz_DAQ_Telemetry_WorkingFile.xlsx`)
**Reads:** mass_total, accel_lat_target.
**Inputs (per channel):** sample rate (Hz) × bytes — damper pos ×4 (500/8),
IMU (200/12), wheel speed ×4 (200/8), steering (100/2), brake pressure (200/4),
throttle (100/2), pushrod load ×4 (500/8), tyre temp/press (10/8), GPS (20/16);
CAN capacity = 500000 bit/s.
**Computes:** bus load per channel = `rate*bytes*8`; total bus load = `SUM`;
bus utilisation = `total/capacity` (keep < 60–70%).
**Chart:** bus load per channel (bar) + utilisation gauge/meter vs 60–70% band.
**Writes:** logged channels confirmed; bus utilisation (%).

## 4. Electronics  (`Blitz_Electronics_WorkingFile.xlsx`)
**Reads:** mass_total.
Two parts.
**(a) Power budget.** Loads (A): ECU+sensors 3, fuel pump 5, fan 8,
DAQ+telemetry 2, dash+lights 2, ignition/coils 6; stator output = 22.1 A;
main fuse = 150 A; battery mass = 4 kg.
- Total current = `SUM(loads)`
- Margin = `stator − total` (keep positive)
**(b) Wiring / harness connection list** — table, one row per wire (Sl, src comp,
source name, connector, pins, dst comp, destination name, pin#, colour) + a
colour-code guide. This is a data table, not a calc; make it an editable grid.
**Chart:** current draw by load (bar) with stator line + margin highlighted.
**Writes:** battery mass → MassBudget; total current draw → ECS.

## 5. Ergonomics  (`Blitz_Ergonomics_WorkingFile.xlsx`)
**Reads:** wheelbase, cog_height, mass_total.
**Inputs:** driver height 5th %ile 1600 mm / 95th %ile 1870 mm; driver mass
75 kg; driver CoG height 300 mm; seat-back angle 45°; pedal-box adj range 275 mm;
steering reach 360 mm; helmet-to-roll-hoop 60 mm (keep positive margin).
**Computes:** wheelbase pulled from Master (`=FromMaster!B6`).
**Checklist (Y/N):** 95th-%ile fits with helmet; 5th-%ile reaches controls;
egress < 5 s; clear view; belts anchored per rules. Render as a checklist.
**Writes:** driver mass (strapped) → MassBudget; driver CoG height; seat-back angle.

## 6. Powertrain  (`Blitz_Powertrain_WorkingFile.xlsx`)
**Reads:** mass_total, axle_load_rear, mu_lat_peak, rolling_radius.
**Inputs:** engine peak torque 35.3 N·m, peak power 32 kW, peak-power rpm 9500,
primary reduction 3, 1st gear 2.5, final drive 3, driveline eff 0.9.
**Computes:**
- Wheel torque (1st) = `τ·primary·1st·final·η` → `=B5*B8*B9*B10*B11`
- Tractive force = `wheel_torque/(rolling_radius/1000)`
- Traction limit = `μ·rear_axle_load`
- Grip-limited? = `IF(tractive>limit,"traction limited","power limited")`
- Launch accel = `MIN(tractive,limit)/(mass_total*9.81)` (g)
**Chart:** tractive force vs traction limit (bar/line); optional gearing trace.
**Writes:** engine peak power; final drive ratio; max torque per wheel.

## 7. Vehicle Dynamics  (`Blitz_Vehicle_Dynamics_WorkingFile.xlsx`)
The richest tool; 6 sub-sheets. **Reads:** mass_total, mass_frac_front,
cog_height, wheelbase, track_front, track_rear, mu_lat_peak, corner_stiffness,
motion_ratio.

**7a. Setup** — kinematic targets (static/dynamic camber F/R, roll-centre heights,
bump steer, caster, toe F/R) + platform values pulled from Master. Mostly an
input/target sheet.

**7b. Brakes** (front/rear columns):
- Pushrod force = `pedal·ratio`
- MC area = `π·d²/4`; line pressure = `force/(area·circuits)`
- Caliper piston area = `π·d²/4`; clamp = `P·area·pistons`
- Friction force = `clamp·2·μpad`
- Effective radius = `(2/3)·((Ro³−Ri³)/(Ro²−Ri²))`
- Brake torque/wheel = `friction·eff_radius`; achieved front bias = `Tf/(Tf+Tr)`
- **Olley optimum bias** = `ff + μ·h/L` (uses Master ff, h, L, μ)
- Decel sweep 0.4→1.4 g: optimum front bias = `ff + g·h/L` per row.
**Chart:** achieved vs Olley-optimum front bias across the decel sweep (line).

**7c. SuspensionGeom** — RC height, VSAL, scrub, KPI, caster, trail, arm lengths,
ball-joint heights; caster/KPI in rad; + a **hardpoint coordinate table** (x,y,z
per point, one corner) to **freeze at G3**. Table + a few derived angles.

**7d. SpringsDampers** (ride-frequency method, F/R):
- Sprung corner mass = `m·ff/2 − unsprung` (rear: `m·(1−ff)/2 − unsprung`)
- Wheel rate = `(2π·f)²·m_sprung /1000` (N/mm)
- Spring rate = `wheel_rate/MR²`
- Re-check freq with chosen rate = `√(k·MR²/m·1000)/(2π)`
- Spring travel = `(bump+droop)·MR`
- Critical damping = `2·√(k·m)`; damper rate = `ζ·Cc`
**Chart:** optional wheel-rate / frequency readout; mainly a sizing table.

**7e. SuspensionLoads** (F/R):
- Static corner vertical = `m·9.81·ff/2` (rear uses `1−ff`)
- Max vertical case = `static·DMF + downforce`
- Pushrod force = `vertical/sin(θ)`
- % anti-dive/anti-squat = `share·tan(θ_svsa)·L/h`

**7f. Steering** (Ackermann + rack&pinion):
- Ackermann split δin−δout = `DEGREES(ATAN(L/(L−t/2)) − ATAN(L/(L+t/2)))`
- Rack & pinion geometry: module = `d/N`, circular pitch = `π·m`, base dia =
  `PCD·cos20°`, addendum `0.8m`, dedendum `1.0m`, tooth thk `1.5708m`,
  rack travel/rev = `π·d`.

**Writes (ToMaster):** measured roll gradient; understeer gradient; front/rear
brake-torque target; achieved brake bias; spring rate F/R.

---

## Build notes
- **Navigation grouping (BRIEF §D):** tools are grouped under discipline pages,
  not shown as one flat list. Vehicle Dynamics page = Setup + SuspensionGeom +
  SpringsDampers + SuspensionLoads + Steering + Brakes (§7). Powertrain page =
  Drivetrain & traction (§6) + Cooling Dyno Analyzer (re-skinned). Electronics =
  Power budget + Wiring + DAQ/Telemetry (§3, §4). Chassis = §2. Aerodynamics =
  §1. Ergonomics = §5.
- Every tool: shared inputs come from the Vehicle Spec store (read-only, shown as
  "linked"); internal inputs are editable; outputs recompute live; a
  "Download original workbook (.xlsx)" button sits on each tool page.
- ToMaster values write back to the store (with the freeze/log rules).
- Charts use Chart.js (as the Cooling tool already does).
- Keep units exactly as in the workbook; show them next to every field.
- The Master-level sheets not owned by a subteam (LoadTransfer, Springs,
  LoadCases, LapSim, Targets, Validation, DecisionMatrix, Procurement, TestLog,
  Setup, Units, Nomenclature) live under Vehicle Spec / governance tabs — port
  from the master workbook when those tabs are built (read the file; don't guess).
