# MIST Blitz FS Workspace — MASTER BUILD PLAN

**The single source of truth. Hand this one file to Claude Code.** It merges the
whole planning pack (build-brief, tool-specs, enrichment, upgrade-brief,
upgrade-v2, additional-tools) and adds the guided **VD Workspace**. Where this and
any older doc differ, **this wins**. The older docs remain in the repo/project as
detailed appendices (tool-specs = the per-cell formula appendix).

Goal: the best tool the team can work in — complete, accurate, graph-rich, and
**compact** (one calculator per screen). It lets the team do as much design-stage
engineering as possible in-browser, alongside (not replacing) ANSYS/SolidWorks/
ADAMS. Special emphasis on Vehicle Dynamics (§5).

---

## 0. Ground rules

**Authoritative sources, in order:** (1) the Team Blitz VD Handbook (98-pg main +
Book 5) — "ours"; (2) the Master workbook + subteam/FRS-2.0 formulas; (3) primary
texts for verification — Milliken & Milliken *RCVD*, Pacejka. These are standard
textbook equations: implement the **verified standard forms**, cite primary
sources in a per-tool footer, no third-party credit.

**Vehicle Spec ships BLANK.** The numbers in the old workbooks were leftovers from
last year's calculations and are deliberately not carried in. Seed Vehicle Spec
with parameter names + units + sensible input ranges only — **no values** — and the
team fills in the new car in-app. No canonical-spec reconciliation needed; the tool
starts empty by design.

**Every tool:** a pure `compute(inputs, master) → outputs`, reads/writes the shared
Vehicle Spec, **unit-tested against the workbook's known values**, method + source
in a footer, honest labels (estimate vs measured vs validated), and the compact
one-screen layout (§2). Never invent a formula; ambiguous → flag, don't guess.

---

## 1. Architecture

- **Front-end:** Astro (static), near-zero JS, light islands, on **GitHub Pages**.
  Base-aware paths (`site`/`base`) so the Pages subpath works now and a custom
  domain later with no rewrite. Chart.js for charts. `@supabase/supabase-js`.
- **Back-end:** **Supabase** (free tier) — Auth (invite-only magic link),
  Postgres (Vehicle Spec, tool_state/tool_outputs, gates, change_log, tyre_results,
  resources), Storage (workbooks, tyre toolset + plots, PDFs; ≤50 MB/file, private).
- **Security:** Row-Level Security on every table (the real wall; the login page is
  convenience). Anon key is public by design.
- **Free-tier reality:** ~7-day idle pause (one-click un-pause); no auto-backups →
  keep the Excel Master as the archive + add a "snapshot/export" (CSV/JSON + Master
  → Excel).
- **Licence:** no raw TTC `.mat` / full `.tir` in the repo (Pages is public even
  from a private repo); tyre zip = a GitHub Release asset; anonymise tyre results.

## 2. Design system + the compact "cockpit" layout

- **Design system (locked):** Archivo (display) · IBM Plex Sans (body) · IBM Plex
  Mono (all numbers/units — instrument feel) · blueprint-paper light + night-shift
  dark · amber #E8A33D (fill) / #A86A12 (text) · maroon #9B1E22→#D14B4F · sky data
  #4A6D82 / hairline #9FC3DB · halftone buttons · engineering-annotation accents
  (sparingly). Blitz logo in masthead + login. WCAG AA; `prefers-reduced-motion`.
- **The input/linked/computed legend everywhere:** blue = typed input · green =
  linked from Master (read-only here) · black = computed. Frozen values show a lock.
- **Compact cockpit (the one-screen rule).** Per-discipline **two-pane** on desktop:
  left = a slim rail of that discipline's tools; right = the selected tool as a
  **single-viewport calculator** — inputs column (left) + outputs & primary chart
  (right), fitting ~one 1080p screen, no scroll for one tool. Dense rows
  (label · input · unit on one line), 2-col input grids, mono numerals, a sticky
  mini-summary of the key output on top. Add a **"compact" spacing variant** of the
  tokens used only inside calculators. If a tool genuinely exceeds one screen
  (e.g. Brakes), use **in-tool tabs** (Sizing · Bias sweep · Advanced), each its own
  one-screen view — never a long scroll. **Mobile:** tool rail → top chip strip/
  dropdown; stack inputs → key outputs → chart, aim ≤1.5 screens.
- **Render completeness (fix a bug from the last build):** every field renders with
  its label + unit, and the input/linked/computed legend always renders its
  swatches **and** its text labels — never a blank or unlabeled legend. A linked
  value with nothing entered yet shows "—", never an empty or broken control;
  inputs show their placeholder/default. Nothing in a tool ships blank or unlabeled,
  even when Vehicle Spec is empty.
- **Acceptance:** on 1920×1080, every core calculator's inputs + primary output +
  chart show without scrolling; on a mid-range phone, no tool needs more than a
  short single scroll; every legend and field label is visibly populated.

## 3. Site structure

```
HOME            discipline grid + Dashboard & g–g hero ("car at a glance")
VD WORKSPACE    the guided VD section (§5) — emphasis
POWERTRAIN      drivetrain & traction · cooling dyno analyzer
ELECTRONICS     power budget · wiring/harness · DAQ & telemetry
CHASSIS         tube stress & FoS · component-mass tracker
AERODYNAMICS    downforce/drag vs speed
ERGONOMICS      driver fit + egress checklist
— cross-cutting top nav —
VEHICLE SPEC · TYRE · GATES/PHASES · RESOURCES · CHANGE LOG · [auth]
```
VD is its own top-level section with the guided workflow (§5). The emphasis is
**depth, not decoration**: it is styled exactly like every other discipline (same
components, same colours, same restraint) — it just carries more tools and the
guided sequence. Do not visually single it out. Every tool page has a "Download
original workbook (.xlsx)" button.

## 4. Vehicle Spec (Master store) — schema

One row per parameter: value, symbol, unit, source, confidence (Live/Est),
**frozen flag + owning gate**. Ship empty — names + units only (§0); the team
fills values in-app. Parameters (the full set, not the earlier 14):

mass_total · mass_frac_front · cog_height · yaw_inertia · unsprung_corner ·
wheelbase · track_front · track_rear · avg_track(=（tf+tr)/2) · ride_height ·
mu_lat_peak · corner_stiffness · slip_peak · rolling_radius · tyre_vert_stiffness ·
accel_lat_target · accel_brake_target · roll_grad_target · ride_freq_front ·
ride_freq_rear · tlltd_front · motion_ratio · weight(=m·g) · axle_load_front(=W·ff)
· axle_load_rear(=W·(1−ff)).

Mass, fraction, CoG, yaw inertia are **computed by MassBudget** (§6.2) and written
here. Freezing a value locks it; edits route through the change log (§8).

---

## 5. THE VD WORKSPACE — guided, foolproof workflow

This is the emphasis — in **depth, not styling**. The VD section looks and behaves
like the rest of the site (same components, same colours); what makes it special is
that it presents **all VD tools as a flowchart** that follows the handbook's own
design sequence (Book Two Part I) and build gates (G0–G9), with arrows and stage
names. Any tool is usable anytime, but the map shows
the recommended order and the prerequisites, so a new member can't get lost.

### 5.1 Layout
- A **workflow map** at the top: 9 stage nodes left-to-right / top-down with arrows;
  each node shows the stage name, its gate, and a status chip (not started / in
  progress / frozen ✓). Click a node → opens that stage's tool in the cockpit below.
- Each stage node is also a **card**: Prerequisites (what must be set/frozen first) ·
  Tool(s) · Produces (what it writes to Master) · Feeds (next stages) · Gate.
- A persistent **Coupling-map panel** (collapsible, from Book Two Part H): the
  if-you-change-X table. And when a member edits a **frozen** value, show the
  handbook's prompt — "this changes [direct]; it will also move [X] and [Y]; verify
  with [measurement]" — before the change is logged. Foolproofing built into the
  freeze governance.
- Short inline guidance per stage, paraphrased from the handbook (it's the team's
  own book — fine to use).

### 5.2 The 9 stages (handbook Part I → tools → gate)
1. **Set performance targets** → *Targets / LapSim* tool. Lateral g, braking g,
   autocross-vs-endurance, driver level. *Produces:* targets in Master. **Gate G0.**
2. **Fix mass targets** → *MassBudget* (§6.2). Mass budget, weight distribution,
   CoG height, yaw inertia (mass centralisation). *Produces:* mass, ff, CoG, Izz.
3. **Choose the tyre** → *Tyre* (§6.1, from the tyre study/MATLAB results). Size,
   compound, loads, peak μ, cornering stiffness, load sensitivity. "Don't design
   suspension before you know the tyre." *Produces:* μ, Cα, Re, slip. **Gate G1.**
4. **Set the footprint** → *Track & wheelbase* (via Load-transfer §6.3 / packaging /
   turning-radius trade). Hard to change later. *Produces:* track, wheelbase
   (freeze). **Gate G2 (Concept: targets frozen).**
5. **Design the kinematics** → *Suspension geometry* (§6.4): camber curve, roll
   centres/roll axis, caster/KPI/scrub, Ackermann, bump steer ≈0, anti-geometry.
   HARDPOINTS — permanent once welded; most CAE time. *Produces:* hardpoints,
   RC/camber/anti-dive. **Gate G3 (Hardpoints frozen).**
6. **Size springs & bars** → *Springs/dampers* + *Roll-stiffness distribution /
   ARB* + *Balance* (§6.5, §6.7): ride-frequency → wheel rates → springs via MR;
   roll-gradient → total roll stiffness; TLLTD → ARB sizing. Trim at track.
   *Produces:* spring/ARB rates, TLLTD. **Gate G5 (Rates).**
7. **Choose dampers** → *Dampers* (§6.5): from damping-ratio targets; refine on
   track with velocity histograms. Last, because it tunes what the rest set up.
8. **Instrument it** → *DAQ & telemetry* (§6.10): plan sensors & logging now, not
   after build (shock pots, IMU, wheel speed, steering, brake pressure, strain-gauged
   pushrods). *Produces:* channel plan.
9. **Validate & correlate** → *Validation* + *g–g* + *Understeer* (§6.7, §7):
   corner-weight, measure CoG & roll gradient, skidpad, step-steer; correlate to the
   sim; iterate. **Gate G8 (Performance).**

*Iteration note on the page:* not a one-pass waterfall — step 3 (tyre) can send you
back to step 2 (mass); step 5 (kinematics) can move step 4 (track). But **freeze
hardpoints (4–5) as early as responsibly possible** — every week geometry stays
"open," chassis & uprights can't finalise. Show this as the handbook states it.

---

## 6. The tools (consolidated specs)

Formulas are the workbook's, verified. `Master!x` = Vehicle Spec value.

### 6.1 Tyre
Download the MATLAB toolset (Release asset) + the shared results library (upload a
fit: anonymised label, run, scope, R²/RMS, LMUX/LMUY, `.tir` link, plot). Round 8
run table + the belt-to-track grip caveat + licence reminder always visible.
Writes to Master: μ, Cα, peak slip, rolling radius.

### 6.2 MassBudget + weight/balance (FRS 2.0 component list)
Component table (CAD vs measured): arms, pushrods, bellcranks, dampers, hubs,
knuckles, wheels, tyres, fasteners, rotors, calipers — mass, x/y/z, status, owner.
- Total = `SUM(mass)`; x_cg/y_cg/z_cg = `SUMPRODUCT(mass,coord)/SUM(mass)`;
  Izz = `SUMPRODUCT(mass, ((x−x_cg)/1000)²+((y−y_cg)/1000)²)`;
  front fraction = `1 − x_cg/wheelbase`. Writes mass, ff, CoG, Izz to Master.
- **Charts:** mass breakdown (bar/treemap by subsystem); weight-distribution donut
  (F/R and L/R); **CG plan-view** (dot on a wheelbase×track rectangle + %front &
  CoG height); corner-weight diagram (4 corners, N & %, cross-weight); sprung/
  unsprung split.

### 6.3 Load transfer
ΔWt(lat) = `m·ay·g·h/t_avg`; front = `TLLTD·ΔWt`, rear = `(1−TLLTD)·ΔWt`;
ΔWx(long) = `m·ax·g·h/L`. Per-corner at limit: `Wf/2 ± ΔWf`, `Wr/2 ± ΔWr`; under
braking front `Wf+ΔWx`, rear `Wr−ΔWx`. Chart: per-corner vertical-load bars.

### 6.4 Suspension geometry (estimates in-browser; 3D stays in ADAMS)
- **Roll-centre / camber / scrub through travel** — front-view double-wishbone
  instant-centre method (planar, y–z). For each heave step: swing the lower arm
  about its inner pivot; solve the upper ball-joint by circle–circle intersection
  (upper-arm length & upright length); rotate the rigid upright to find wheel-centre,
  contact patch; **IC** = intersection of the two extended arm lines; **RC** =
  intersection of (contact-patch→IC) with the centreline; **camber** = upright
  rotation; **scrub** = contact-patch lateral move. Sweep heave ±~30 mm; output
  RC-height/camber/scrub vs heave + gradients; RC-in-roll by opposite-heave. Verify
  the static point reproduces the input RC height (unit test). (RCVD Ch.17; no
  RC-CALCS needed.)
- **3D hardpoint table** (FRS 2.0 Hardpoints): editable, feeds the estimate; the
  single source of hardpoints; full 3D kinematics is ADAMS's job.
- **Anti-dive/anti-squat** (FRS 2.0): from SVSA length/height,
  `% anti = moment_opposing/moment_causing·100`.
- **Steering:** **Ackermann (corrected)** `cot δo − cot δi = t/L`; per radius R:
  `δi=atan(L/(R−t/2))`, `δo=atan(L/(R+t/2))`; %Ackermann = achieved/ideal. Plus the
  **R&P gear sweep** over tooth counts 15–25 (module `d/N`, circular pitch `πm`,
  PCD, base circle `PCD·cos20°`, addendum `0.8m`, dedendum `1.0m`, tooth thk
  `1.5708m`, clearance `0.2m`, root fillet `0.4m`, rack travel/rev `πd`, rack teeth).
- **Design-target tracker (EDP):** ride freq 2.3–2.9 Hz, camber gain bump <0.5°/10mm
  & roll <0.8°/°, RC migration <60 mm, knuckle FoS >2, wheelbase > rule min, wheel
  travel >50 mm — target / actual / met ✓ → feeds Validation.

### 6.5 Springs & dampers (fixed model + selection)
- Target ride rate `Kr = 4π²·m_sprung_corner·f²`.
- **Wheel rate with tyre in series (the fix):** `Kw = Kr·Kt/(Kt−Kr)` (Kt = tyre
  vertical stiffness). The old tool omitted the tyre → overstated softness.
- Spring rate `Ks = Kw/MR²`; chosen spring (catalog); re-check `f`.
- **MR from 3D rocker geometry** (FRS 2.0): `MR = L_damper·cosθ_damper /
  (L_pushrod·cosθ_pushrod)`, or MR input fallback.
- Damping: `Cc = 2√(k·m)`, damper rate = `ζ·Cc`, bump/rebound split.
- **Damper catalog selector** (FOX DHX etc.) length/travel/sag vs required.
- Outputs: roll stiffness, ride frequency F/R, roll gradient.

### 6.6 Brakes — one complete Brake System tool (in-tool tabs)
Merge Final_Torque + Pray_Final_Torque + Brake_System_Calculator_v1.0 + the FRS 2.0
write-up. **Inputs:** mass, front %, CoG, wheelbase, μ, (aero DF F/R), tyre size,
target decel, pedal force, pedal ratio, MC bore, caliper piston dias (≤3/axle) F/R,
pad μ F/R, rotor OD + pad radial depth F/R, bias-bar %, optional proportioning valve
(knee psi + slope). **Hardware presets:** Tilton 78-series MC, ISR 22-048/049,
GP200 (dropdowns fill bores/areas).
- Dynamic loads: front `Wf+m·a·g·h/L`, rear `Wr−m·a·g·h/L`.
- Required axle/wheel torque = braking force × rolling radius ÷ wheels.
- Ideal/Olley front bias = `ff + a·h/L`.
- Hydraulics: pushrod `F_pedal·ratio`; MC pressure `F/A_mc`; clamp `P·ΣA_piston·n`;
  pad friction `clamp·2·μ_pad`; `Re = ⅔(Ro³−Ri³)/(Ro²−Ri²)`; torque = friction·Re.
- **Recommended MC diameter** (from required pressure + target pedal effort/ratio),
  MC & pedal travel, pedal effort, lock-up margin.
- **Decel sweep 0.4→1.4 g** (tab): dynamic F/R weight, torque required, optimal
  bias, achieved bias (MC-area ratio + bias-bar + proportioning valve),
  bias-vs-optimal, optimal/safe band.
- **Advanced (tab):** Magic-Formula Fx–slip (`Fx=Dx·sin(Cx·atan(Bxκ−Ex(Bxκ−atan
  Bxκ)))`, `Dx=μx·Fz`) + iterative rolling/skidding (per-tyre grip vs demand,
  iterate decel↔loads).
- **Thermal add-on:** energy per stop, rotor mass & temp rise, fade margin.
- **Charts:** achieved vs optimal bias across decel (+optimal band); per-wheel
  torque bars; pressure vs decel.

### 6.7 Balance (new — the "where does it push/loose" pair)
- **Understeer gradient / steady-state** (bicycle model): K (deg/g),
  characteristic/critical speed, static margin, yaw-rate gain vs speed. Chart: yaw
  gain vs speed; understeer line.
- **Roll-stiffness distribution → load-transfer balance:** front/rear roll-rate
  split (springs + ARBs) vs TLLTD; the balance knob; ARB-rate helper.

### 6.8 Powertrain (+ cooling)
Drivetrain & traction: wheel torque `τ·primary·1st·final·η`, tractive force
`/(Re)`, traction limit `μ·rear_load`, grip-vs-power limited, launch g. Chart:
tractive force vs traction limit. **Cooling:** the existing Dyno Analyzer,
re-skinned, placed here (heat rejection vs speed, fan state, power/torque).

### 6.9 Aero
Downforce `0.5·ρ·v²·ClA`, drag `0.5·ρ·v²·CdA`, %weight, L/D over 40–120 km/h. Chart:
downforce & drag vs speed. (Add: aero balance / CoP → g–g at speed.)

### 6.10 Electronics / DAQ
Power budget (loads vs stator, margin, fuse), wiring/harness grid; DAQ CAN bus load
`rate·bytes·8`, utilisation vs 60–70%. Channel plan from handbook Part J
(shock pots, IMU, wheel speed, steering, brake pressure, strain-gauged pushrods).

### 6.11 Chassis
Tube stress & FoS (`A=π/4(OD²−(OD−2t)²)`, stress `F/A`, FoS `yield/stress`);
torsional stiffness target vs measured; component-mass tracker (feeds MassBudget).

### 6.12 Ergonomics
Driver-fit dimensions (5th/95th %ile), seat/pedal/steering reach, helmet clearance;
egress & fit checklist.

## 7. g–g diagram + Dashboard + Figures
- **g–g (flagship):** grip ellipse `(ax/μx)²+(ay/μy)²=1` in g, truncated at top by
  power/traction-limited accel (Powertrain) and bottom by max braking (Brakes);
  aero expansion `×(W+DF(v))/W` with a speed slider (g–g–V); operating points
  overlaid (skidpad/braking/launch). Instrument styling. Dashboard centrepiece.
- **Dashboard:** KPI tiles (mass, ff, CoG, Izz, target lat g, skidpad V, F/R spring,
  brake bias, roll gradient) + per-discipline pickup. Make it the Home hero.
- **Figures (EDR):** tyre Fy-vs-slip, mass breakdown, per-corner load, g–g.

## 8. Governance
Gates G0–G9 (status + sign-off, attributed/timestamped) + freeze-list; freezing a
Vehicle-Spec value locks it; edits to a frozen value require a change-log entry
(who/what/old→new/reason) — enforced by the `edit_param()` RPC + trigger. **Wire the
coupling-map prompt (§5.1) into this edit flow.** Targets & Validation tabs
(target/achieved, predicted/measured %error) are the write-back destinations for
tool "Contribute to Master" outputs.

## 9. Additional tools backlog (condensed — full list in additional-tools.md)
Handling: transient yaw/step-steer · quarter-car ride · grip-budget. Events:
acceleration (75 m) & skidpad predictors · point-mass lap · points predictor ⚖.
Powertrain: gear/shift tool · intake restrictor ⚖ · injector/fuel · chain life.
Brakes: (thermal already in §6.6) · MC/pedal-travel. Chassis: **SES helper** ⚖ ·
**impact-attenuator** ⚖ · tube buckling · bolted-joint/fastener. Aero: balance/CoP ·
wing sizing. Suspension: MR-from-geometry (done §6.5) · bump/roll-steer. Electrical:
battery sizing · wire gauge/ampacity. Measurement: **CoG tilt-test** · corner-weight
balancing. Business: **cost/BOM** ⚖ · weight-cost trade · budget/cash-flow ·
Gantt-vs-gates. ⚖ = read constants from the current rulebook as labelled inputs.

## 10. Build order · testing · deploy · open items

**Build order:**
1. Layout rework to the compact cockpit + compact token variant + **VD Workspace
   shell** (the stage flowchart + coupling panel).
2. Canonical Vehicle Spec (§0, §4) + **MassBudget** + weight/balance charts.
3. **Brakes** complete tool.
4. **Springs & dampers** (tyre-series + MR-from-geometry + catalog).
5. **g–g + Dashboard**.
6. **Suspension geometry** (RC/camber/scrub + anti-dive + hardpoints + EDP targets).
7. **Balance pair** (understeer + roll-stiffness distribution).
8. Governance polish + Tyre page + Resources; then additional tools over time.

**Testing:** unit tests on every `compute()` vs workbook values; a "numbers match
the Excel Master" cross-check before relying on a tab; Lighthouse ≥90 mobile; both
themes.

**Deploy:** private repo; Pages (base-aware); Supabase project; tyre zip as Release
asset. Add the two VD Handbook PDFs + the reference calculators to `reference/`.

**Open items for Tahmid:** (1) invite vs open sign-up; (2) tyre-zip URL;
(3) confirm: 3D kinematics stays in ADAMS, Brakes as one tabbed tool, compact
cockpit default, primary-source citations/no third-party credit. (Vehicle Spec is
blank by design — no canonical-spec decision needed.)

## 11. Source-file → tool manifest (open EVERY one; port formula-by-formula)

Put all of these in `reference/` (or `workbooks/`). For each tool, **open the named
files and port the real formulas** — this manifest is a map, not a substitute for
reading them. Apply the documented corrections (Ackermann §6.4, tyre-in-series
spring rate §6.5, roll-centre reconstruction §6.4) and unit-test against each
file's own numbers.

| Source file(s) | Feeds | Notes |
|---|---|---|
| `MIST_Blitz_FS_Master_Workbook.xlsx` (28 sheets) | Vehicle Spec, MassBudget, LoadTransfer, Springs, LoadCases, LapSim, Targets, Validation, DecisionMatrix, Dashboard, Figures, Setup, Units, Nomenclature, Procurement, TestLog, ECS, Telemetry, Gates, ChangeLog | the backbone; per-discipline hand-off sheets = each discipline's starter calc |
| `Blitz_{Aero,Chassis,DAQ_Telemetry,Electronics,Ergonomics,Powertrain,Vehicle_Dynamics}_WorkingFile.xlsx` | the matching discipline tools | each has StartHere / FromMaster / domain sheets / ToMaster |
| `Suspension_Parameters_FRS_2.0.xlsx` | MassBudget (component weights), Springs & dampers, Suspension geometry, Targets/Validation | ride-rate **with tyre in series**; anti-dive/squat (3. Suspension links); MR from rocker coords (Damper-pushrod coordinates); damper catalog (Damper Datasheet); 3D Hardpoints; EDP design-target tracker |
| `Suspension_Geometry.xlsx` (Bhavik) | Suspension geometry | front-view RC/camber/scrub-through-travel — external `RC-CALCS` unavailable → **reconstruct** via §6.4 algorithm |
| `Braking_Calculation.xlsm` (Bhavik) | Brakes → Advanced tab | longitudinal Pacejka (Tyre Char. / TYRE-PACEJKA), multi-piston, pedal/bias-bar, iterative Rolling-or-Skidding, Brake Bias Calc. |
| `Brake_System_Calculator_-_v1.0.xlsx` | Brakes → Sizing + Bias-sweep tabs | recommended MC Ø, pedal effort/travel, proportioning valve, bias-vs-optimal sweep |
| `Final_Torque.xlsx`, `Pray_Final_Torque.xlsx`, `Torque_Calculation_Final.docx` | Brakes → core chain + hardware presets | the team's real sizing: Tilton 78-series MC, ISR 22-048/049, GP200 |
| `Steering.xlsx` (Bhavik) | Steering → gear sweep | R&P gear geometry across tooth counts 15–25 |
| `Load_Calculations.xlsx` (Bhavik) | Load transfer (optional per-wheel sweep) | accel/braking/cornering transfer |
| `Cooling_Cacl.html` | Powertrain → Cooling | existing dyno analyzer — re-skin, keep physics |
| Team Blitz VD Handbook (main + Book 5) PDFs | VD Workspace guidance + method verification | design sequence (Part I), coupling map (Part H), gates, derivations (Book 5) |

Max out the Excel-style web tool: everything the workbooks compute should be a live
web calculator here, with its chart, reading/writing the shared Vehicle Spec — the
goal is for the team to do as much design-stage work in-browser as possible.

### Kickoff for Claude Code
> Read `MASTER_BUILD_PLAN.md` fully (and the VD Handbook PDFs in `reference/`).
> Start build-order step 1: the compact cockpit layout + the VD Workspace shell
> (stage flowchart per §5, wired to the gates). Show me the structure before
> coding, add unit tests against the workbook values, commit in small steps.
