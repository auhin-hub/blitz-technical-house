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

/** Cross-cutting pages in the persistent top nav (BRIEF §D). */
export const TOP_NAV = [
  { href: '', label: 'Home' },
  { href: 'vehicle-spec', label: 'Vehicle Spec' },
  { href: 'tyre', label: 'Tyre' },
  { href: 'gates', label: 'Gates / Phases' },
  { href: 'resources', label: 'Resources' },
  { href: 'change-log', label: 'Change Log' },
] as const;
