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
**Writes:** Cl·A, Cd·A. (Aero balance now comes from §1d, where it is computed.)

**Source for §1b–§1d:** the Aero team's request,
`reference/requests/Aero_Calculator_Requirements.docx` (equations only, no worked
examples — the tests in `aero-request.test.ts` use hand values + physical identities).
Its §1 (downforce, drag, L/D) is the sheet above; Cl·A is kept as one product.

**§1b Performance impact** (request §4) — inside the downforce tool, so Cl·A, Cd·A
and ρ keep one home. Reads `mass_total`, `mu_lat_peak`; input corner radius R
(skidpad centreline ≈ 9.125 m).
- `V0 = √(μt·g·R)`; `V = √[μt·m·g / (m/R − μt·½ρ·ClA)]`; `t = 2πR/V`;
  `ΔV% = (V−V0)/V0·100`; `ay = V²/R` (÷ g). If `m/R ≤ μt·½ρ·ClA` the model has no
  speed limit — shown as "downforce-limited", never a number.
- Per speed row: drag power `P = ½ρ·CdA·V³` (kW).

**§1c CFD mesh y+** (request §3) — standalone. Inputs ρ, U, L, μ_air, target y+.
- `Re = ρUL/μ`; `Cf = 0.058·Re^−0.2`; `τw = Cf·½ρU²`; `u* = √(τw/ρ)`;
  `y = y+·μ/(ρ·u*)` (first cell centre); `Δ1 = 2y` (first layer); `δ = 0.37·L·Re^−1/5`.

**§1d Aero balance / CoP / axle loads** (request §2) — replaces the earlier
front/rear Cl·A balance (two elements on the axles reproduce it). Reads
`wheelbase`, `mass_total`, `mass_frac_front`. Inputs per element (front wing,
floor/diffuser, rear wing, other): Cl·Aᵢ, xᵢ (mm from the front axle, +rearward);
plus speed, ρ, drag centre height. Cd·A is **linked** from the Downforce tool's
contributed `cd_a` (engine `data-output` link), not re-typed — axle loads show
"—" until it has been contributed.
- `Fᵢ = ½ρV²·ClAᵢ`; `Nf,aero = ΣFᵢ(l−xᵢ)/l`; `Nr,aero = ΣFᵢxᵢ/l`;
  `%front = Nf,aero/(Nf,aero+Nr,aero)·100`; `x_cp = Σ(Fᵢxᵢ)/ΣFᵢ`;
  `Nf = m·g·ff + Nf,aero − F_drag·h_drag/l`; `Nr = m·g·(1−ff) + Nr,aero + F_drag·h_drag/l`.
**Writes:** aero balance (front fraction) → `aero_balance_front`.

## 2. Chassis  (`Blitz_Chassis_WorkingFile.xlsx`)
**Reads:** mass_total, cog_height, wheelbase, track_front, track_rear,
axle_load_front, axle_load_rear.
Two parts.
**(a) Tube / FoS calc.** Inputs: design member force = 1455 N (from LoadCases),
tube OD = 25 mm, wall = 2 mm, yield = 435 MPa.
- Section area = `π/4*(OD²−(OD−2·wall)²)`
- Axial stress = `force/area`
- Factor of safety = `yield/stress` (target ≥ 1.5)
- Torsional stiffness: target 1600 N·m/deg; measured value now computed by the
  twist-test tool (c/d below) rather than typed here.
**(b) ComponentMass tracker** (CAD vs measured, per component): rows for
front/rear upper & lower arms, pushrod, bell crank, damper, upright, hub, wheel,
tyre, rotor, caliper, fasteners. Per row: CAD total = `unit·qty`, Δ = `meas−CAD`;
TOTAL = sums. This feeds the MassBudget.
**Writes:** chassis mass (as built) → MassBudget; torsional stiffness (measured).

**Source for (c)–(d):** the Chassis team's request,
`reference/requests/FSAE_Chassis_Calculator_Requirements.pdf` (not the workbook).
Its worked examples are the unit-test expectations in `chassis-stiffness.test.ts`.

**(c) Impact forces** (request §2–5). Reads `mass_total` (car + driver) from
Master — the request's "enter mass once" is satisfied by the Master, not a
page-local field (golden rule). Inputs: deceleration n (g) — front 20, rear 10,
side 10 — labelled as design assumptions.
- `F = m · n · 9.81` (N; also shown in kN). Example: 300 kg × 20 g = 58,860 N.

**(d) Torsional stiffness → relative stiffness** (request §6–7). One tool, so
K chassis flows from the twist test into the relative calc without retyping.
Inputs: F (N), d (m), δ1, δ2 (mm), Kf, Kr (N·m/deg, total roll stiffness).
- `T = F·d`; `θ = arctan((δ1+δ2)/1000 / d)` — δ converted mm → m (the request's
  example does this implicitly); `K = T/θ` in N·m/rad, ÷ 57.2958 → N·m/deg.
  Example: 1000 N, 0.6 m, 0.8 + 0.8 mm → 600 N·m, 0.1528°, ≈ 3,927 N·m/deg.
- `1/K_sus = 1/Kf + 1/Kr`; `1/K_vehicle = 1/Kf + 1/Kr + 1/K_chassis`;
  `K_relative = K_chassis / K_sus × 100 %`.
  Example: 1600, 133.07, 221.37 → 83.11, 79.01, 1,925.15 %.
**Writes:** K chassis (N·m/deg) → `torsional_stiffness` (replaces the typed
"measured" input previously on the tube tool).

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
**Workbook (original):** driver height 5th %ile 1600 mm / 95th %ile 1870 mm;
driver mass 75 kg; driver CoG height 300 mm; seat-back angle 45°; pedal-box adj
range 275 mm; steering reach 360 mm; helmet-to-roll-hoop 60 mm; wheelbase from
Master. **Web:** the old "Driver fit" calculator (CalcTool `fit`, tool `erg_fit`)
is RETIRED — its inputs are superseded by the studio + roster, and its three
ToMaster contributions now come from the studio's **Contribute selected driver to
Master** button (tool `erg_studio`): `driver_mass` (kg, roster mass in race gear),
`driver_cog_height` (mm above ground, the CoG estimate below) and
`seat_back_angle` (deg, the cockpit's seat-back-from-vertical setting). Any saved
`erg_fit` row is simply no longer read.
**Checklist (Y/N):** 95th-%ile fits with helmet; 5th-%ile reaches controls;
egress < 5 s; clear view; belts anchored per rules. Render as a checklist.

**§5b Cockpit packaging studio** (team request, not a workbook port). Side view,
mm, x rearward from the front axle, z up from ground (`src/lib/ergo/`).
- **Rulebook selector:** FSAE 2027 V1.0, FS Rules 2026 v1.0 (FS UK), FSAE Japan
  2026 (FSAE base + JSAE Local Rules 4th ed. — no cockpit-geometry overrides),
  FS China 2026 (CSAE English edition). Values + rule
  numbers in `rules.ts`; anything not confirmed from the source is listed as
  unverified and shown on the page. Rulebook PDFs are © their publishers and are
  not stored in the repo.
- **Percy** placed per the rulebook: lower 200 mm circle on the seat bottom at
  ≥ 915 mm from the rearmost pedal face (pedals forward, seat rearmost); middle
  circle on the seat back, 490 mm on; 300 mm head circle 280 mm on, at the
  rulebook gap (25 mm; FSC 25.4 mm) from the head restraint.
- **Checks:** helmet ≥ 50 mm from main–front hoop line and from the
  main hoop–rear brace line (or not behind the main hoop if braced forward);
  upright vs reclined (template back line ≤ 30° from vertical); lap belt 45–65°
  upright / 60–80° reclined, and 0–75/76 mm forward of the seat junction
  (upright, "should"); shoulder belt +10° to −20°; front hoop top ≥ wheel top and
  wheel ≤ 250 mm rearward of the front hoop. Each driver: helmet clearance, belts,
  head restraint ≤ 25 mm from the helmet, reaches pedals and wheel.
- **Drivers** drawn as the rulebook's figure scaled to their measurements (hip /
  shoulder 200 mm circles, 300 mm helmet), legs and arms as two-link chains to the
  heel/pedal and the wheel (9-and-3 = wheel centre in side view).
- **Joint angles** hip / knee / ankle / elbow; no comfort range assumed — team
  enters a target band.
- **Driver CoG (estimate)** — `cog.ts`. Dempster segment parameters as tabulated
  in Winter, *Biomechanics and Motor Control of Human Movement*, Table 4.1. Mass
  fractions (one segment): hand 0.006, forearm 0.016, upper arm 0.028, foot 0.0145,
  leg/shank 0.0465, thigh 0.100, head+neck 0.081, trunk 0.497; CoM from the proximal
  end: hand 0.506, forearm 0.430, upper arm 0.436, foot 0.50, leg 0.433, thigh 0.433,
  trunk 0.50 (hip → shoulder), head+neck at the head-circle centre. Arms and legs
  are doubled (side view) so the fractions sum to 1.000. Total mass = roster *mass
  in race gear*. Wrist = fist centre − ½ hand, hand length = 0.108·stature
  (Drillis & Contini). Segment end points are the studio's posed joints (foot =
  ankle → toe). Shown as a marker on the drawing and as x / z in the checks area;
  labelled an estimate everywhere.
- **Sightline (information only)** — `sightline.ts`. New roster measurement
  *Sitting eye height* (seat → eye); estimate = sitting height − 0.064·stature
  (Drillis & Contini: eye 0.936·H standing), flagged as estimated. Eye point = on
  the posed neck/head line from the shoulder at (eye height − sitting shoulder
  height), then moved `EYE_FORWARD_OF_HEAD_CENTRE_MM` = **80 mm** toward the front
  — that constant is an ASSUMED approximation (not from a source) and is labelled
  so in the UI. New cockpit point *Nose / bodywork top* (default x 250, z 400: an
  example, replace with CAD). The sightline is the line from the eye that just
  clears the highest-slope obstruction among steering-wheel top, front-hoop top and
  nose top; reported: which part blocks, angle below horizontal, and where it meets
  the ground (mm ahead of the front axle). **No pass/fail**: FSAE / FS rules have
  no side-view visibility requirement and none is invented.
- **CAD:** SolidWorks STL (binary/ASCII), read in the browser only, projected to a
  side-view silhouette with axis / unit / origin mapping. Export DXF (R12) + CSV.

**§5c Driver roster** — name + 11 measurements (ISO-7250-style landmarks: stature,
mass, sitting height ± helmet, sitting shoulder height, thigh, lower leg, ankle
height, foot, upper arm, elbow-to-grip) + per-driver seat insert / pedal shift /
head-restraint shift. Missing values estimated from stature (Drillis & Contini
1966 via Winter; sitting height 0.52·H) and flagged. Stored in `tool_state`
(`erg_drivers`) behind the login; the studio state is `erg_studio`.

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
- Ackermann split δin−δout = `DEGREES(ATAN(L/(R−t/2)) − ATAN(L/(R+t/2)))` where
  R = turning radius (mm). (Earlier drafts wrote `L` in the denominator; the code
  and the pinned workbook value 7.41° both use R — audit P3-2.)
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
