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

export interface Tool {
  title: string;
  /** Anchor id within the discipline page (tools are built later). */
  anchor: string;
  blurb: string;
  /** TOOL_SPECS.md section this tool ports, for traceability. */
  spec?: string;
}

export interface Discipline {
  slug: string;
  title: string;
  blurb: string;
  tools: Tool[];
  /** Original workbook offered as a download on the discipline page. */
  workbook?: string;
  /** True once the discipline has its own hand-built page (not the stub route). */
  built?: boolean;
}

/** The six landing-page disciplines and their tools (BRIEF §D, TOOL_SPECS). */
export const DISCIPLINES: Discipline[] = [
  {
    slug: 'vehicle-dynamics',
    title: 'Vehicle Dynamics',
    blurb: 'Setup, suspension geometry, springs & dampers, loads, steering, brakes.',
    workbook: 'Blitz_Vehicle_Dynamics_WorkingFile.xlsx',
    built: true,
    tools: [
      { title: 'Setup / kinematics', anchor: 'setup', blurb: 'Kinematic targets + platform values from Master.', spec: 'TOOL_SPECS §7a' },
      { title: 'Suspension geometry & hardpoints', anchor: 'geometry', blurb: 'RC height, VSAL, scrub, KPI, caster; hardpoint table (freeze at G3).', spec: 'TOOL_SPECS §7c' },
      { title: 'Springs & dampers', anchor: 'springs', blurb: 'Ride-frequency sizing: wheel rate, spring rate, damping.', spec: 'TOOL_SPECS §7d' },
      { title: 'Suspension loads', anchor: 'loads', blurb: 'Corner verticals, pushrod force, anti-dive / anti-squat.', spec: 'TOOL_SPECS §7e' },
      { title: 'Steering', anchor: 'steering', blurb: 'Ackermann split + rack & pinion geometry.', spec: 'TOOL_SPECS §7f' },
      { title: 'Brakes', anchor: 'brakes', blurb: 'Clamp, brake torque, achieved vs Olley-optimum bias.', spec: 'TOOL_SPECS §7b' },
    ],
  },
  {
    slug: 'powertrain',
    title: 'Powertrain',
    blurb: 'Drivetrain & traction, plus the Cooling Dyno Analyzer.',
    workbook: 'Blitz_Powertrain_WorkingFile.xlsx',
    built: true,
    tools: [
      { title: 'Drivetrain & traction', anchor: 'traction', blurb: 'Wheel torque, tractive force vs traction limit, launch accel.', spec: 'TOOL_SPECS §6' },
      { title: 'Cooling — Dyno Analyzer', anchor: 'cooling', blurb: 'Heat rejection vs speed, fan model, power/torque curves (re-skinned).', spec: 'BRIEF §E2' },
    ],
  },
  {
    slug: 'electronics',
    title: 'Electronics',
    blurb: 'Power budget, wiring / harness list, DAQ & telemetry.',
    workbook: 'Blitz_Electronics_WorkingFile.xlsx',
    built: true,
    tools: [
      { title: 'Power budget', anchor: 'power', blurb: 'Load currents vs stator output; margin.', spec: 'TOOL_SPECS §4a' },
      { title: 'Wiring / harness list', anchor: 'wiring', blurb: 'Connection table + colour-code guide (editable grid).', spec: 'TOOL_SPECS §4b' },
      { title: 'DAQ & Telemetry', anchor: 'daq', blurb: 'CAN bus load per channel + utilisation.', spec: 'TOOL_SPECS §3' },
    ],
  },
  {
    slug: 'chassis',
    title: 'Chassis',
    blurb: 'Tube stress & FoS, torsional stiffness, component-mass tracker.',
    workbook: 'Blitz_Chassis_WorkingFile.xlsx',
    built: true,
    tools: [
      { title: 'Tube stress & FoS', anchor: 'tube', blurb: 'Section area, axial stress, factor of safety; torsional stiffness.', spec: 'TOOL_SPECS §2a' },
      { title: 'Component-mass tracker', anchor: 'mass', blurb: 'CAD vs measured per component → feeds MassBudget.', spec: 'TOOL_SPECS §2b' },
    ],
  },
  {
    slug: 'aerodynamics',
    title: 'Aerodynamics',
    blurb: 'Downforce / drag vs speed.',
    workbook: 'Blitz_Aero_WorkingFile.xlsx',
    built: true,
    tools: [
      { title: 'Downforce / drag vs speed', anchor: 'aero', blurb: 'Downforce, drag, %-of-weight, L/D across the speed range.', spec: 'TOOL_SPECS §1' },
    ],
  },
  {
    slug: 'ergonomics',
    title: 'Ergonomics',
    blurb: 'Driver fit + egress checklist.',
    workbook: 'Blitz_Ergonomics_WorkingFile.xlsx',
    built: true,
    tools: [
      { title: 'Driver fit + egress', anchor: 'fit', blurb: '5th/95th-%ile fit, reach, egress < 5 s checklist.', spec: 'TOOL_SPECS §5' },
    ],
  },
];

/** Cross-cutting pages in the persistent top nav (BRIEF §D; MASTER_BUILD_PLAN §3). */
export const TOP_NAV = [
  { href: '', label: 'Home' },
  { href: 'vehicle-dynamics', label: 'VD Workspace' },
  { href: 'vehicle-spec', label: 'Vehicle Spec' },
  { href: 'validation', label: 'Validation' },
  { href: 'tyre', label: 'Tyre' },
  { href: 'gates', label: 'Gates / Phases' },
  { href: 'resources', label: 'Resources' },
  { href: 'change-log', label: 'Change Log' },
] as const;

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
