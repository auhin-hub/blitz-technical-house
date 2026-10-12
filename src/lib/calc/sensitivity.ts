/**
 * Quantified coupling (feature review Tier 4 #10).
 *
 * `COUPLING_BY_KEY` tells you *that* raising the CoG hurts load transfer, dive,
 * squat and brakes. This tells you *by how much*: perturb one Master value, re-run
 * the real tool computes, and report what moved.
 *
 * It works because every tool's maths is a pure `compute(inputs, master)` — the
 * same functions the pages mount. Nothing here re-derives a formula; the adapters
 * below only map Master rows into each compute's own master argument (exactly as
 * its page does) and name the outputs worth watching. If a tool's wiring changes,
 * its adapter is the one place to follow.
 *
 * Reported as a central difference, (f(x+h) − f(x−h)) / 2h, which is second-order
 * accurate and symmetric — so a result that is linear in the parameter gives the
 * exact slope, and one that is capped (a MIN/MAX, a verdict) shows a smaller
 * slope rather than a misleading one-sided jump.
 */
import { brakesCompute } from './vd-brakes';
import { loadsCompute } from './vd-loads';
import { steeringCompute, steeringEffortCompute } from './vd-steering';
import { tractionCompute } from './pt-traction';
import { aeroCompute } from './aero';
import { springsCompute, type SpringSide } from './springs';
import { loadTransfer } from './vd-loadtransfer';

type Flat = Record<string, number>;

/** One driveable downstream calculation. */
export interface Downstream {
  /** Tool id, matching the `tool_state` row so real inputs can be loaded. */
  tool: string;
  label: string;
  /** Master keys this calculation reads — used to skip irrelevant work. */
  reads: string[];
  /** Outputs to report: output key → display label + unit. */
  outputs: Record<string, { label: string; unit: string }>;
  /** Run it with a Master snapshot and the tool's own inputs. */
  run: (master: Flat, inputs: Flat) => Record<string, number | string>;
}

/** Only numeric, finite outputs can have a slope. */
const nums = (o: Record<string, number | string>): Flat => {
  const out: Flat = {};
  for (const [k, v] of Object.entries(o)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  return out;
};

// Mirrors the Springs page's own sideIn() mapping, field for field.
const springSide = (inp: Flat, p: 'f' | 'r'): SpringSide => ({
  targetFreq: inp[`${p}_targetFreq`], unsprung: inp[`${p}_unsprung`],
  motionRatio: inp[`${p}_motionRatio`], chosenSpringRate: inp[`${p}_chosenSpringRate`],
  bump: inp[`${p}_bump`], droop: inp[`${p}_droop`], dampingRatio: inp[`${p}_dampingRatio`],
});

export const DOWNSTREAM: Downstream[] = [
  {
    tool: 'brakes',
    label: 'Brakes',
    reads: ['mass_total', 'mass_frac_front', 'cog_height', 'wheelbase', 'mu_long_peak', 'mu_lat_peak'],
    outputs: {
      achievedFrontBias: { label: 'Achieved front bias', unit: '-' },
      olleyOptimum: { label: 'Olley optimum bias', unit: '-' },
      f_brakeTorque: { label: 'Front brake torque', unit: 'N·m' },
    },
    run: (m, inp) => brakesCompute(inp, m),
  },
  {
    tool: 'vd_loads',
    label: 'Suspension loads',
    reads: ['mass_total', 'mass_frac_front', 'wheelbase', 'cog_height'],
    outputs: {
      f_pushrodForce: { label: 'Front pushrod force', unit: 'N' },
      r_pushrodForce: { label: 'Rear pushrod force', unit: 'N' },
      f_maxVertical: { label: 'Front max vertical', unit: 'N' },
    },
    run: (m, inp) => loadsCompute(inp, m),
  },
  {
    tool: 'vd_steering',
    label: 'Steering',
    reads: ['wheelbase', 'track_front'],
    outputs: { ackermannSplit: { label: 'Ackermann split', unit: 'deg' } },
    run: (m, inp) => steeringCompute(inp, m),
  },
  {
    tool: 'vd_steereffort',
    label: 'Steering effort',
    reads: ['mu_lat_peak', 'axle_load_front', 'rolling_radius'],
    outputs: {
      swTorque: { label: 'Steering-wheel torque', unit: 'N·m' },
      rackForce: { label: 'Rack force', unit: 'N' },
      kingpinMoment: { label: 'Kingpin moment', unit: 'N·m' },
    },
    run: (m, inp) => steeringEffortCompute(inp, m),
  },
  {
    tool: 'pt_traction',
    label: 'Drivetrain & traction',
    reads: ['rolling_radius', 'axle_load_rear', 'mu_long_peak', 'mu_lat_peak', 'mass_total'],
    outputs: {
      tractionLimit: { label: 'Traction limit', unit: 'N' },
      launchAccel: { label: 'Launch accel', unit: 'g' },
    },
    run: (m, inp) => tractionCompute(inp, m),
  },
  {
    tool: 'aero',
    label: 'Aerodynamics (downforce %)',
    reads: ['mass_total', 'mass_frac_front'],
    outputs: { pct_100: { label: 'Downforce at 100 km/h, % of weight', unit: '%' } },
    run: (m, inp) => aeroCompute(inp, m),
  },
  {
    tool: 'springs',
    label: 'Springs & dampers',
    reads: ['mass_total', 'mass_frac_front', 'cog_height', 'track_front', 'track_rear', 'tyre_vert_stiffness'],
    outputs: {
      f_springRate: { label: 'Front spring rate', unit: 'N/mm' },
      r_springRate: { label: 'Rear spring rate', unit: 'N/mm' },
      rollGradient: { label: 'Roll gradient', unit: 'deg/g' },
    },
    run: (m, inp) => springsCompute(springSide(inp, 'f'), springSide(inp, 'r'), {
      mass: m.mass_total, ff: m.mass_frac_front, kt: m.tyre_vert_stiffness,
      cogHeight: m.cog_height, trackFront: m.track_front, trackRear: m.track_rear,
      rcFront: inp.f_rcHeight, rcRear: inp.r_rcHeight,
    }),
  },
  {
    tool: 'vd_loadtransfer',
    label: 'Lateral load transfer',
    reads: ['mass_total', 'mass_frac_front', 'cog_height', 'track_front', 'track_rear', 'unsprung_corner', 'rear_rc_height'],
    outputs: {
      tlltdFront: { label: 'Front TLLTD', unit: '-' },
      dWFront: { label: 'Front axle load transfer', unit: 'N' },
      dWRear: { label: 'Rear axle load transfer', unit: 'N' },
    },
    run: (m, inp) => loadTransfer(
      { ay: inp.ay, rcFront: inp.rcFront, rcRear: Number.isFinite(m.rear_rc_height) ? m.rear_rc_height : inp.rcRear,
        kRollFront: inp.kRollFront, kRollRear: inp.kRollRear, unsprungCog: inp.unsprungCog },
      { mass: m.mass_total, ff: m.mass_frac_front, cogHeight: m.cog_height,
        trackFront: m.track_front, trackRear: m.track_rear, unsprungCorner: m.unsprung_corner },
    ) as unknown as Record<string, number>,
  },
];

export interface SensitivityRow {
  tool: string;
  toolLabel: string;
  outputKey: string;
  label: string;
  unit: string;
  base: number;
  /** d(output)/d(param), in output-unit per param-unit. */
  slope: number;
  /** Change for the step actually applied (slope × step). */
  delta: number;
  /** delta / base, as a fraction. NaN when base is 0. */
  relative: number;
}

export interface SensitivityOptions {
  /** Absolute step in the parameter's own unit. Defaults to 1% of the value. */
  step?: number;
  /** Tool inputs by tool id — the team's real saved inputs. */
  inputsByTool?: Record<string, Flat>;
}

/**
 * How every downstream output responds to one Master key. Rows are returned
 * largest-relative-change first, which is the tornado order.
 */
export function sensitivity(
  key: string,
  master: Flat,
  opts: SensitivityOptions = {},
): SensitivityRow[] {
  const x = master[key];
  if (!Number.isFinite(x)) return [];
  const step = opts.step && opts.step > 0 ? opts.step : Math.max(Math.abs(x) * 0.01, 1e-6);
  const rows: SensitivityRow[] = [];

  for (const d of DOWNSTREAM) {
    if (!d.reads.includes(key)) continue;
    const inputs = opts.inputsByTool?.[d.tool] ?? {};
    let base: Flat, up: Flat, down: Flat;
    try {
      base = nums(d.run(master, inputs));
      up = nums(d.run({ ...master, [key]: x + step }, inputs));
      down = nums(d.run({ ...master, [key]: x - step }, inputs));
    } catch { continue; }   // a tool missing its inputs must not break the panel

    for (const [outKey, meta] of Object.entries(d.outputs)) {
      const b = base[outKey];
      if (!Number.isFinite(b)) continue;
      const hi = up[outKey], lo = down[outKey];
      if (!Number.isFinite(hi) || !Number.isFinite(lo)) continue;
      const slope = (hi - lo) / (2 * step);
      const delta = slope * step;
      rows.push({
        tool: d.tool, toolLabel: d.label, outputKey: outKey,
        label: meta.label, unit: meta.unit,
        base: b, slope, delta,
        relative: b === 0 ? NaN : delta / Math.abs(b),
      });
    }
  }

  const magnitude = (r: SensitivityRow) => (Number.isFinite(r.relative) ? Math.abs(r.relative) : Math.abs(r.delta));
  return rows.sort((a, b) => magnitude(b) - magnitude(a));
}

/** Which Master keys any downstream calculation actually consumes. */
export const SENSITIVE_KEYS: string[] = [...new Set(DOWNSTREAM.flatMap((d) => d.reads))].sort();
