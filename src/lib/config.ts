/**
 * Site configuration + the navigation model.
 *
 * Base-aware paths (BRIEF §C): every internal link is built with `url()` so the
 * GitHub Pages subpath (/blitz-technical-house) works now and a custom domain
 * works later with no rewrite. Never hard-code the base.
 */

/** Build a base-aware absolute path from a site-relative one. */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const clean = path.replace(/^\/+/, '');
  return clean ? `${base}/${clean}` : `${base}/`;
}

export const SITE = {
  name: 'MIST Blitz',
  tagline: 'Formula Student Workspace',
  // Internal, team-only — not public, not indexed (BRIEF §A).
  description: 'Internal engineering workspace for MIST Blitz Formula Student.',
} as const;

/**
 * One tool in a team's registry. Exactly one of `anchor` / `href`:
 *  - `anchor` — a calculator living in the team page's cockpit (`<slug>#<anchor>`;
 *    CockpitShell opens it from the hash);
 *  - `href`   — a tool with its own page (site-relative, e.g. 'brakes').
 *
 * THIS REGISTRY IS THE SINGLE SOURCE for the Teams menu, the landing cards, the
 * command palette, each team page's "More tools" strip and the breadcrumbs —
 * add a tool here and it is findable everywhere. Keep it in step with the pages.
 */
export interface Tool {
  title: string;
  anchor?: string;
  href?: string;
  blurb: string;
  /** TOOL_SPECS.md section this tool ports, for traceability. */
  spec?: string;
}

export interface Discipline {
  slug: string;
  title: string;
  /** Short name for tight spots (menu, breadcrumbs). Defaults to `title`. */
  short?: string;
  blurb: string;
  tools: Tool[];
  /** Original workbook offered as a download on the discipline page. */
  workbook?: string;
  /** True once the discipline has its own hand-built page (not the stub route). */
  built?: boolean;
}

/** The teams (BRIEF §D discipline-first nav) and every tool each one owns. */
export const DISCIPLINES: Discipline[] = [
  {
    slug: 'vehicle-dynamics',
    title: 'Vehicle Dynamics',
    short: 'VD',
    blurb: 'Guided design sequence: geometry, springs, brakes, balance, tyre, g–g, lap sim and on-car measurement.',
    workbook: 'Blitz_Vehicle_Dynamics_WorkingFile.xlsx',
    built: true,
    tools: [
      { title: 'Setup / kinematics', anchor: 'setup', blurb: 'Kinematic targets + platform values from Master.', spec: 'TOOL_SPECS §7a' },
      { title: 'Suspension geometry & hardpoints', href: 'geometry', blurb: 'RC height, camber, scrub, KPI, caster; hardpoint table (freeze at G3).', spec: 'TOOL_SPECS §7c' },
      { title: 'Springs & dampers', href: 'springs', blurb: 'Ride-frequency sizing: wheel rate, spring rate, damping.', spec: 'TOOL_SPECS §7d' },
      { title: 'Suspension loads', anchor: 'loads', blurb: 'Corner verticals, pushrod force, anti-dive / anti-squat.', spec: 'TOOL_SPECS §7e' },
      { title: 'Steering', anchor: 'steering', blurb: 'Ackermann split + rack & pinion geometry.', spec: 'TOOL_SPECS §7f' },
      { title: 'Steering effort', anchor: 'steereffort', blurb: 'Steering-wheel torque and rack force.' },
      { title: 'R&P gear sweep', anchor: 'rpsweep', blurb: 'Rack-and-pinion ratio sweep.' },
      { title: 'Load transfer', anchor: 'loadtransfer', blurb: 'Lateral / longitudinal load transfer and TLLTD.' },
      { title: 'Brake system', href: 'brakes', blurb: 'Clamp, brake torque, achieved vs Olley-optimum bias.', spec: 'TOOL_SPECS §7b' },
      { title: 'Balance', href: 'balance', blurb: 'Understeer gradient, static margin, TLLTD pair.' },
      { title: 'Mass budget', href: 'massbudget', blurb: 'Mass, front fraction, CoG height, yaw inertia.' },
      { title: 'Tyre', href: 'tyre', blurb: 'Tyre toolset download, shared fit results, guides.' },
      { title: 'g–g diagram', href: 'gg', blurb: 'Acceleration envelope: grip ellipse, power/brake limits, aero.' },
      { title: 'Lap-time simulator', href: 'lapsim', blurb: 'Point-mass lap sim on the shared values.' },
      { title: 'Event predictors', href: 'events', blurb: 'Acceleration, skidpad, grip budget.' },
      { title: 'Coupling & sensitivity', href: 'sensitivity', blurb: 'Change one Master number, see which results move.' },
      { title: 'Measurement', href: 'measurement', blurb: 'CoG tilt-test, corner-weight, quarter-car, trifilar Izz.' },
      { title: 'Setup sheet', href: 'setup-sheet', blurb: 'Trackside setup record.' },
    ],
  },
  {
    slug: 'chassis',
    title: 'Chassis',
    blurb: 'Impact forces, twist-test torsional & relative stiffness, tube stress & FoS, buckling, bolted joints, mass tracker.',
    workbook: 'Blitz_Chassis_WorkingFile.xlsx',
    built: true,
    tools: [
      { title: 'Impact forces', anchor: 'impact', blurb: 'Front / rear / side F = m·n·g from the Master mass.', spec: 'TOOL_SPECS §2c' },
      { title: 'Torsional & relative stiffness', anchor: 'stiffness', blurb: 'Twist test → K chassis → K sus, K vehicle, K relative.', spec: 'TOOL_SPECS §2d' },
      { title: 'Tube stress & FoS', anchor: 'tube', blurb: 'Section area, axial stress, factor of safety.', spec: 'TOOL_SPECS §2a' },
      { title: 'Component-mass tracker', anchor: 'mass', blurb: 'CAD vs measured per component → feeds MassBudget.', spec: 'TOOL_SPECS §2b' },
      { title: 'Tube buckling', anchor: 'buckling', blurb: 'Euler critical load for a round tube.' },
      { title: 'Bolted joint', anchor: 'bolt', blurb: 'Proof load, clamp and tightening torque.' },
    ],
  },
  {
    slug: 'aerodynamics',
    title: 'Aerodynamics',
    short: 'Aero',
    blurb: 'Downforce, drag & cornering performance; per-element balance, CoP and axle loads; CFD mesh y+.',
    workbook: 'Blitz_Aero_WorkingFile.xlsx',
    built: true,
    tools: [
      { title: 'Downforce, drag & performance', anchor: 'aero', blurb: 'Downforce, drag, drag power, L/D; corner speed and skidpad time with / without aero.', spec: 'TOOL_SPECS §1 · §1b' },
      { title: 'Aero balance / CoP / axle loads', anchor: 'aerobalance', blurb: 'Per-element downforce → %front, centre of pressure, axle loads with the drag couple.', spec: 'TOOL_SPECS §1d' },
      { title: 'CFD mesh y+', anchor: 'mesh', blurb: 'First-layer height for a target y+ (full-vehicle CFD).', spec: 'TOOL_SPECS §1c' },
    ],
  },
  {
    slug: 'powertrain',
    title: 'Powertrain',
    blurb: 'Drivetrain & traction, gear speeds, intake restrictor, Cooling Dyno Analyzer.',
    workbook: 'Blitz_Powertrain_WorkingFile.xlsx',
    built: true,
    tools: [
      { title: 'Drivetrain & traction', anchor: 'traction', blurb: 'Wheel torque, tractive force vs traction limit, launch accel.', spec: 'TOOL_SPECS §6' },
      { title: 'Cooling — Dyno Analyzer', anchor: 'cooling', blurb: 'Heat rejection vs speed, fan model, power/torque curves (re-skinned).', spec: 'BRIEF §E2' },
      { title: 'Gear speed', anchor: 'gearspeed', blurb: 'Road speed per gear.' },
      { title: 'Intake restrictor', anchor: 'restrictor', blurb: 'Restrictor sizing.' },
    ],
  },
  {
    slug: 'electronics',
    title: 'Electronics',
    blurb: 'Power budget, wiring / harness list, DAQ & telemetry, battery and wire sizing.',
    workbook: 'Blitz_Electronics_WorkingFile.xlsx',
    built: true,
    tools: [
      { title: 'Power budget', anchor: 'power', blurb: 'Load currents vs stator output; margin.', spec: 'TOOL_SPECS §4a' },
      { title: 'Wiring / harness list', anchor: 'wiring', blurb: 'Connection table + colour-code guide (editable grid).', spec: 'TOOL_SPECS §4b' },
      { title: 'DAQ & Telemetry', anchor: 'daq', blurb: 'CAN bus load per channel + utilisation.', spec: 'TOOL_SPECS §3' },
      { title: 'Battery sizing', anchor: 'battery', blurb: 'Ah / Wh from load, time and depth of discharge.' },
      { title: 'Wire voltage drop', anchor: 'wiredrop', blurb: 'Round-trip voltage drop for a run.' },
      { title: 'DAQ log interpretation', href: 'daq', blurb: 'Read logged channels back against the plan.' },
    ],
  },
  {
    slug: 'ergonomics',
    title: 'Ergonomics',
    short: 'Ergo',
    blurb: 'Cockpit packaging studio (Percy + your drivers vs FSAE / FS UK / FS Japan / FS China rules, SolidWorks STL), driver roster, fit checklist.',
    workbook: 'Blitz_Ergonomics_WorkingFile.xlsx',
    built: true,
    tools: [
      { title: 'Cockpit packaging studio', anchor: 'studio', blurb: 'Side view: Percy + drivers, seat / pedal / wheel setups, helmet clearance, belt angles, driver CoG, sightline, STL backdrop, DXF export.', spec: 'TOOL_SPECS §5b' },
      { title: 'Driver roster', anchor: 'drivers', blurb: 'Driver names and body measurements (estimates from height where missing).', spec: 'TOOL_SPECS §5c' },
      { title: 'Egress & fit checklist', anchor: 'checklist', blurb: 'Shared fit / egress < 5 s checklist.' },
    ],
  },
  {
    slug: 'business',
    title: 'Business & Ops',
    short: 'Business',
    blurb: 'Cost report, team budget, season Gantt and the competition points predictor.',
    built: true,
    tools: [
      { title: 'Cost report (FSAE-J)', href: 'cost', blurb: 'Cost / BOM in the FSAE-J format.' },
      { title: 'Budget', href: 'budget', blurb: 'Team budget vs actual.' },
      { title: 'Season Gantt', href: 'gantt', blurb: 'Schedule against the gates.' },
      { title: 'Points predictor', href: 'points', blurb: 'Competition points by event.' },
    ],
  },
];

/** Site-relative link for a tool (anchor tools live on their team page). */
export function toolHref(team: Discipline, t: Tool): string {
  return t.href ? url(t.href) : `${url(team.slug)}#${t.anchor}`;
}

export interface NavLink { href: string; label: string; hint?: string; }
export interface NavGroup { label: string; links: NavLink[]; }

/** Programme (process & governance) and Resources — the two cross-team menus. */
export const PROGRAMME_LINKS: NavLink[] = [
  { href: 'gates', label: 'Gates / Phases', hint: 'G0–G9, freeze-and-log' },
  { href: 'taskmap', label: 'Task Map', hint: 'who waits on whom' },
  { href: 'readiness', label: 'Design Readiness', hint: 'component requirements' },
  { href: 'validation', label: 'Validation', hint: 'targets vs achieved' },
  { href: 'change-log', label: 'Change Log', hint: 'every frozen edit' },
  { href: 'snapshots', label: 'Snapshots', hint: 'baselines · diff · restore' },
  { href: 'report', label: 'Design report', hint: 'printable, whole store' },
];
export const RESOURCE_LINKS: NavLink[] = [
  { href: 'resources', label: 'Resources', hint: 'reference PDFs & uploads' },
  { href: 'tyre', label: 'Tyre', hint: 'toolset download & results' },
];

/** The masthead: plain links and dropdown groups, in order. */
export const NAV: (NavLink | NavGroup)[] = [
  { href: '', label: 'Home' },
  { label: 'Teams', links: DISCIPLINES.map((d) => ({ href: d.slug, label: d.title })) },
  { href: 'vehicle-spec', label: 'Vehicle Spec' },
  { label: 'Programme', links: PROGRAMME_LINKS },
  { label: 'Resources', links: RESOURCE_LINKS },
];

/**
 * Where a page sits, for breadcrumbs: the owning team (if a team tool page),
 * else the Programme / Resources group. Team hub pages return null (they're top).
 */
export function pageParent(slug: string): { label: string; href?: string } | null {
  for (const d of DISCIPLINES) {
    if (d.slug === slug) return null;
    if (d.tools.some((t) => t.href === slug)) return { label: d.title, href: d.slug };
  }
  if (PROGRAMME_LINKS.some((l) => l.href === slug)) return { label: 'Programme' };
  if (RESOURCE_LINKS.some((l) => l.href === slug)) return { label: 'Resources' };
  return null;
}

/**
 * Every tool_outputs key the workspace can produce, with the owning tool/team
 * (Handoff v2 Part 0.2). The Component Readiness requirement picker (P4) is the
 * union of these + all `vehicle_spec` keys — so a requirement can only reference
 * something the workspace actually produces.
 *
 * `upstream` lists the Master keys that actually enter the formula behind the
 * output (not everything its page reads). Component Readiness shows a contributed
 * output as AMBER while any of them is unset or unfrozen — "contributed, but
 * standing on numbers that can still move" (audit P2.4). An empty/absent list
 * means the output comes only from that tool's own inputs, so contributing it is
 * genuinely green.
 */
export const TOOL_OUTPUT_KEYS: { key: string; label: string; team: string; upstream?: string[] }[] = [
  { key: 'cl_a', label: 'Cl·A (downforce)', team: 'Aero' },
  { key: 'cd_a', label: 'Cd·A (drag)', team: 'Aero' },
  // Computed from per-element positions relative to the wheelbase (aero-balance.ts).
  { key: 'aero_balance_front', label: 'Aero balance (front)', team: 'Aero', upstream: ['wheelbase'] },
  { key: 'engine_peak_power', label: 'Engine peak power', team: 'Powertrain' },
  { key: 'final_drive', label: 'Final drive ratio', team: 'Powertrain' },
  { key: 'max_wheel_torque', label: 'Max wheel torque', team: 'Powertrain' },
  { key: 'battery_mass', label: 'Battery mass', team: 'ECS' },
  { key: 'total_current_draw', label: 'Total current draw', team: 'ECS' },
  { key: 'bus_utilisation', label: 'CAN bus utilisation', team: 'ECS' },
  { key: 'driver_mass', label: 'Driver mass', team: 'Ergonomics' },
  { key: 'driver_cog_height', label: 'Driver CoG height', team: 'Ergonomics' },
  { key: 'seat_back_angle', label: 'Seat-back angle', team: 'Ergonomics' },
  { key: 'torsional_stiffness', label: 'Torsional stiffness', team: 'Chassis' },
  { key: 'chassis_mass_built', label: 'Chassis mass (as built)', team: 'Chassis' },
  { key: 'brake_torque_front', label: 'Front brake torque / wheel', team: 'Brake', upstream: ['mass_total', 'mass_frac_front', 'cog_height', 'wheelbase', 'rolling_radius', 'accel_brake_target'] },
  { key: 'brake_torque_rear', label: 'Rear brake torque / wheel', team: 'Brake', upstream: ['mass_total', 'mass_frac_front', 'cog_height', 'wheelbase', 'rolling_radius', 'accel_brake_target'] },
  { key: 'achieved_front_bias', label: 'Achieved front brake bias', team: 'Brake', upstream: ['mass_total', 'mass_frac_front', 'cog_height', 'wheelbase', 'accel_brake_target'] },
  { key: 'spring_rate_front', label: 'Front spring rate', team: 'VD', upstream: ['mass_total', 'mass_frac_front', 'tyre_vert_stiffness'] },
  { key: 'spring_rate_rear', label: 'Rear spring rate', team: 'VD', upstream: ['mass_total', 'mass_frac_front', 'tyre_vert_stiffness'] },
  { key: 'roll_gradient', label: 'Roll gradient (springs)', team: 'VD', upstream: ['mass_total', 'mass_frac_front', 'cog_height', 'track_front', 'track_rear', 'tyre_vert_stiffness'] },
  { key: 'rc_height_static', label: 'Static roll-centre height', team: 'VD' },
  { key: 'rc_migration', label: 'RC migration over travel', team: 'VD' },
  { key: 'camber_gain_bump', label: 'Camber gain per 10 mm bump', team: 'VD' },
  { key: 'understeer_gradient', label: 'Understeer gradient', team: 'VD', upstream: ['mass_total', 'mass_frac_front', 'wheelbase', 'corner_stiffness'] },
  { key: 'static_margin', label: 'Static margin', team: 'VD', upstream: ['mass_total', 'mass_frac_front', 'wheelbase', 'corner_stiffness'] },
  { key: 'arb_front_needed', label: 'Front ARB needed', team: 'VD', upstream: ['mass_total', 'mass_frac_front', 'wheelbase', 'corner_stiffness'] },
  // tlltd_front is NOT a tool_output — it's a Master key written by Load transfer,
  // so it stays selectable in the Readiness picker under "Master", not here, where
  // it could never go green (audit P1-7).
  { key: 'pushrod_force_front', label: 'Pushrod force (front)', team: 'VD', upstream: ['mass_total', 'mass_frac_front', 'wheelbase', 'cog_height'] },
  { key: 'pushrod_force_rear', label: 'Pushrod force (rear)', team: 'VD', upstream: ['mass_total', 'mass_frac_front', 'wheelbase', 'cog_height'] },
  { key: 'anti_pct_front', label: 'Anti-dive (front)', team: 'VD', upstream: ['wheelbase', 'cog_height'] },
  { key: 'anti_pct_rear', label: 'Anti-squat (rear)', team: 'VD', upstream: ['wheelbase', 'cog_height'] },
  { key: 'ackermann_split', label: 'Ackermann split', team: 'VD', upstream: ['wheelbase', 'track_front'] },
  { key: 'steering_wheel_torque', label: 'Steering-wheel torque', team: 'VD', upstream: ['mu_lat_peak', 'axle_load_front', 'rolling_radius'] },
  { key: 'rack_force', label: 'Rack force', team: 'VD', upstream: ['mu_lat_peak', 'axle_load_front', 'rolling_radius'] },
  { key: 'lap_time_s', label: 'Lap time', team: 'VD', upstream: ['mass_total', 'mu_lat_peak'] },
  { key: 'endurance_fuel_l', label: 'Endurance fuel', team: 'Powertrain', upstream: ['mass_total', 'mu_lat_peak'] },
  // radiator_area / heat_rejection_kw were registered for the Cooling tool, which
  // is an embedded iframe that contributes nothing — removed so the Readiness
  // picker only offers keys the workspace actually produces (audit P1-7).
];

/**
 * Coupling knock-ons per Master parameter (handbook Table H-1), shown when a
 * FROZEN value is edited (MASTER_BUILD_PLAN §5.1/§8) so the member sees what else
 * moves before the change is logged.
 */
export const COUPLING_BY_KEY: Record<string, string> = {
  cog_height: 'Lower CoG = more grip, less dive/squat/roll (all-positive). Raising it hurts everything — re-check load transfer, brakes, g–g.',
  track_front: 'Wider track = less lateral load transfer (more grip) but more drag, worse packaging, line changes. Re-check balance (TLLTD) and steering.',
  track_rear: 'Wider track = less lateral load transfer (more grip) but more drag/packaging. Re-check balance (TLLTD).',
  wheelbase: 'Longer = more stable, less pitch transfer; but heavier, larger turning radius. Re-check kinematics, steering, Ackermann.',
  mass_total: 'Mass drives every load-transfer & balance number — re-check axle loads, brakes, springs, g–g.',
  mass_frac_front: 'Front fraction shifts balance and axle loads — re-check brakes (bias), springs, understeer.',
  unsprung_corner: 'Lighter unsprung = better bump following + less yaw inertia (two gains). Re-check ride/damping.',
  mu_lat_peak: 'Grip propagates to brakes, traction, g–g and lap time — re-check all of them.',
  tlltd_front: 'Shifts balance: more front → understeer; more rear → oversteer. Tie to ARB / roll-stiffness distribution.',
  ride_freq_front: 'Stiffer = less roll but less mechanical grip on bumps. Re-check spring rate, damping, roll gradient.',
  ride_freq_rear: 'Stiffer = less roll but less mechanical grip on bumps. Re-check spring rate, damping, roll gradient.',
  motion_ratio: 'Changes wheel rate for a given spring — re-check spring sizing and damping.',
  rolling_radius: 'Affects wheel torque, traction, brake torque and speed-from-rpm — re-check powertrain & brakes.',
  corner_stiffness: 'Drives the understeer gradient and yaw response — re-check Balance.',
};

export interface ValidationRow {
  label: string;
  targetMaster?: string;   // Master key holding the target
  targetFixed?: number;    // or a fixed EDP limit
  achievedKey?: string;    // tool_outputs key holding the achieved value
  cmp: 'approx' | 'max' | 'min';
  unit: string;
}

/** Targets & Validation rows (MASTER_BUILD_PLAN §8 + §6.4/§6.5 EDP targets). */
export const VALIDATION_ROWS: ValidationRow[] = [
  { label: 'Roll gradient', targetMaster: 'roll_grad_target', achievedKey: 'roll_gradient', cmp: 'approx', unit: 'deg/g' },
  { label: 'Understeer gradient (≥0 = understeer)', targetFixed: 0, achievedKey: 'understeer_gradient', cmp: 'min', unit: 'deg/g' },
  { label: 'Camber gain / 10 mm bump', targetFixed: 0.5, achievedKey: 'camber_gain_bump', cmp: 'max', unit: 'deg' },
  { label: 'RC migration over travel', targetFixed: 60, achievedKey: 'rc_migration', cmp: 'max', unit: 'mm' },
  { label: 'Torsional stiffness', targetFixed: 1600, achievedKey: 'torsional_stiffness', cmp: 'min', unit: 'N·m/deg' },
  { label: 'Front spring rate', achievedKey: 'spring_rate_front', cmp: 'approx', unit: 'N/mm' },
  { label: 'Rear spring rate', achievedKey: 'spring_rate_rear', cmp: 'approx', unit: 'N/mm' },
  { label: 'Achieved front brake bias', achievedKey: 'achieved_front_bias', cmp: 'approx', unit: '-' },
  { label: 'Static RC height', achievedKey: 'rc_height_static', cmp: 'approx', unit: 'mm' },
  { label: 'CAN bus utilisation', targetFixed: 70, achievedKey: 'bus_utilisation', cmp: 'max', unit: '%' },
];

// ============================================================================
// VD Workspace (MASTER_BUILD_PLAN §5) — the guided design sequence + coupling map,
// grounded in the Team Blitz VD Handbook (Book Two Part I and Table H-1 Part H).
// ============================================================================

export interface VdStage {
  n: number;
  name: string;
  gate: string;               // owning build gate (matches gates.id)
  tool: string;               // the tool that drives this stage
  /** VD cockpit tool id to reveal on click (same page), if built. */
  toolId?: string;
  /** Cross-page link to the tool, if it lives elsewhere. */
  href?: string;
  pending?: boolean;          // tool not built yet (shell shows the card only)
  prerequisites: string;
  produces: string;           // what it writes to Master
  feeds: string;
  guidance: string;           // one line paraphrased from the handbook Part I
}

/** The 9 stages (handbook Part I → tool → gate). */
export const VD_STAGES: VdStage[] = [
  { n: 1, name: 'Set performance targets', gate: 'G0', tool: 'Targets / LapSim', href: 'lapsim',
    prerequisites: 'None — this is where you start.',
    produces: 'Target lateral g, braking g, event focus → Master targets',
    feeds: 'Everything downstream',
    guidance: 'Decide what the car must do and defend it in the design event — these set everything below.' },
  { n: 2, name: 'Fix mass targets', gate: 'G0', tool: 'MassBudget', href: 'massbudget',
    prerequisites: 'Targets set',
    produces: 'Mass, front fraction, CoG height, yaw inertia (Izz)',
    feeds: 'Every load-transfer & balance calculation',
    guidance: 'Mass budget + weight distribution + CoG + mass centralisation feed every later number.' },
  { n: 3, name: 'Choose the tyre', gate: 'G1', tool: 'Tyre', href: 'tyre',
    prerequisites: 'Mass targets (operating loads)',
    produces: 'Peak μ, cornering stiffness Cα, rolling radius, peak slip',
    feeds: 'Suspension, brakes, g–g',
    guidance: 'The tyre decides the grip you design the car to deliver — don’t design suspension before you know it.' },
  { n: 4, name: 'Set the footprint', gate: 'G2', tool: 'Track & wheelbase', href: 'vehicle-spec',
    prerequisites: 'Tyre chosen; packaging + turning-radius trade',
    produces: 'Track (F/R), wheelbase — then freeze',
    feeds: 'Kinematics, load transfer, steering',
    guidance: 'From the load-transfer / packaging / turning-radius trade. Hard to change later.' },
  { n: 5, name: 'Design the kinematics', gate: 'G3', tool: 'Suspension geometry', href: 'geometry',
    prerequisites: 'Footprint fixed',
    produces: 'Hardpoints, RC / camber curve / caster-KPI-scrub, Ackermann, anti-geometry',
    feeds: 'Springs, chassis, uprights',
    guidance: 'HARDPOINTS — permanent once welded; spend the most CAE time here, then freeze at G3.' },
  { n: 6, name: 'Size springs & bars', gate: 'G5', tool: 'Springs & dampers', href: 'springs',
    prerequisites: 'Kinematics + motion ratio',
    produces: 'Spring & ARB rates, ride frequency, TLLTD',
    feeds: 'Balance, dampers, validation',
    guidance: 'Ride-frequency → wheel rates → springs via MR; roll-gradient → roll stiffness; TLLTD → ARBs. Trim at track.' },
  { n: 7, name: 'Choose dampers', gate: 'G5', tool: 'Dampers', href: 'springs',
    prerequisites: 'Spring rates set',
    produces: 'Damper rates (bump/rebound), damping ratios',
    feeds: 'Track tuning',
    guidance: 'From damping-ratio targets; refine on track with velocity histograms. Last — it tunes what the rest set up.' },
  { n: 8, name: 'Instrument it', gate: 'G5', tool: 'DAQ & telemetry', href: 'electronics',
    prerequisites: 'Architecture known',
    produces: 'Sensor & logging channel plan',
    feeds: 'Validation & correlation',
    guidance: 'Plan sensors & logging now, not after build — shock pots, IMU, wheel speed, steering, brake pressure, strain-gauged pushrods.' },
  { n: 9, name: 'Validate & correlate', gate: 'G8', tool: 'Validation · g–g · Understeer', pending: true,
    prerequisites: 'Car built + instrumented',
    produces: 'Measured CoG, roll gradient, understeer gradient; sim correlation',
    feeds: 'Iteration back into the loop',
    guidance: 'Corner-weight, skidpad, step-steer; correlate to the sim and iterate — the loop that turns a design into a fast car.' },
];

export interface CouplingRow { change: string; direct: string; knockOns: string; }

/** Table H-1 — the coupling map (handbook Book Two Part H). Read the knock-ons
 *  before committing the change. */
export const COUPLING_MAP: CouplingRow[] = [
  { change: 'Lower CoG height', direct: 'Less lateral & longitudinal load transfer', knockOns: 'More total grip; less dive/squat/roll — usually all-positive, chase it hard.' },
  { change: 'Wider track', direct: 'Less lateral load transfer', knockOns: 'More grip; but more frontal area/drag, worse packaging, tighter-corner line changes.' },
  { change: 'Longer wheelbase', direct: 'Less longitudinal transfer; more stable', knockOns: 'Heavier; larger turning radius; packaging/line changes.' },
  { change: 'Lighter unsprung mass', direct: 'Better bump following; less yaw inertia', knockOns: 'Steadier contact-patch load → more grip AND quicker direction change — two gains (costly).' },
  { change: 'Stiffer front ARB', direct: 'More front roll stiffness', knockOns: 'Higher front TLLTD → more understeer; lazier yaw, larger turning radius.' },
  { change: 'Stiffer rear ARB', direct: 'More rear roll stiffness', knockOns: 'Higher rear TLLTD → more oversteer; watch snap on a rear-heavy car.' },
  { change: 'Stiffer springs (both ends)', direct: 'Less roll & ride motion', knockOns: 'LESS mechanical grip on bumps; harsher ride.' },
  { change: 'Higher roll centre', direct: 'More geometric transfer; less roll', knockOns: 'Jacking risk, harshness, mid-corner balance shift if the RC migrates.' },
  { change: 'More static negative camber', direct: 'Better grip in hard corners', knockOns: 'Worse braking/traction grip (patch tilted straight-line), inner-edge overheating, more wear.' },
  { change: 'More caster', direct: 'More self-centring & corner camber', knockOns: 'Heavier steering, driver fatigue; more dynamic camber (can help front grip).' },
  { change: 'More front Ackermann', direct: 'Less inside-tyre scrub at low speed', knockOns: 'Can be wrong at high load where the tyre wants a different slip — tie to tyre data.' },
  { change: 'More rebound damping', direct: 'Better settle control', knockOns: 'Car can jack down over bumps → lost travel, lost grip.' },
  { change: 'Higher tyre pressure', direct: 'Sharper response, less rolling drag', knockOns: 'Smaller patch, centre overheats, peak grip can drop.' },
  { change: 'More front brake bias', direct: 'Later front lock-up margin', knockOns: 'Rear can lock first if over-shifted; interacts with longitudinal load transfer.' },
  { change: 'More downforce', direct: 'More grip at speed', knockOns: 'More drag; balance shifts with speed (CoP vs CoG); needs stiffer springs to hold ride height.' },
];
