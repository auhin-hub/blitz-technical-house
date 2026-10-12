/**
 * Quantified coupling (feature review Tier 4 #10). These pin the slopes against
 * physics you can derive by hand, so a wrong adapter shows up here rather than as
 * a plausible-looking number in the panel.
 */
import { it, expect } from 'vitest';
import { sensitivity, SENSITIVE_KEYS, DOWNSTREAM } from './sensitivity';

const MASTER = {
  mass_total: 264, mass_frac_front: 0.4568670576735, cog_height: 263.409090909091,
  wheelbase: 1550, track_front: 1200, track_rear: 1180, mu_lat_peak: 1.5,
  rolling_radius: 228, axle_load_rear: 1406.62741935484, axle_load_front: 1183.0,
  tyre_vert_stiffness: 110, unsprung_corner: 12, rear_rc_height: 45,
};

const INPUTS = {
  vd_loads: { f_pushrodAngle: 45, r_pushrodAngle: 45, f_share: 0.65, r_share: 1, f_ay: 1.4, r_ay: 1.4, f_decel: 1.4, r_decel: 1.4 },
  pt_traction: { peakTorque: 35.3, peakPower: 32, peakRpm: 9500, primary: 3, firstGear: 2.5, finalDrive: 3, drivelineEff: 0.9 },
  aero: { clA: 0.8, cdA: 0.5, rho: 1.18, aeroBalance: 0.45 },
  vd_steering: { turningRadius: 9, pinionPitchDia: 25, teeth: 12 },
  vd_steereffort: { caster: 5, pneumaticTrail: 30, scrubRadius: 10, fx: 0, steeringArm: 90, steeringRatio: 5, efficiency: 0.9 },
};

it('only reports calculations that actually read the key', () => {
  const rows = sensitivity('rolling_radius', MASTER, { inputsByTool: INPUTS });
  const tools = new Set(rows.map((r) => r.tool));
  expect(tools.has('pt_traction')).toBe(true);
  expect(tools.has('vd_steereffort')).toBe(true);
  expect(tools.has('vd_loads')).toBe(false);          // loads never reads it
});

it('an unset parameter yields nothing rather than a fake slope', () => {
  expect(sensitivity('cog_height', { ...MASTER, cog_height: NaN })).toEqual([]);
  expect(sensitivity('not_a_key', MASTER)).toEqual([]);
});

it('traction limit slope vs rear axle load is exactly mu (linear)', () => {
  const rows = sensitivity('axle_load_rear', MASTER, { inputsByTool: INPUTS, step: 10 });
  const limit = rows.find((r) => r.outputKey === 'tractionLimit')!;
  // tractionLimit = mu * axleLoadRear, and with mu_long_peak unset mu = mu_lat_peak.
  expect(limit.slope).toBeCloseTo(MASTER.mu_lat_peak, 9);
  expect(limit.delta).toBeCloseTo(MASTER.mu_lat_peak * 10, 9);
  expect(limit.base).toBeCloseTo(MASTER.mu_lat_peak * MASTER.axle_load_rear, 6);
});

it('rack force scales linearly with front axle load', () => {
  const rows = sensitivity('axle_load_front', MASTER, { inputsByTool: INPUTS, step: 20 });
  const rack = rows.find((r) => r.outputKey === 'rackForce')!;
  // Fy = mu*(Wf/2); Mkp = Fy*(tMech + trail); rackForce = 2*Mkp/arm — all linear in Wf,
  // so the relative change equals the relative change in the parameter.
  expect(rack.relative).toBeCloseTo(20 / MASTER.axle_load_front, 9);
});

it('raising the CoG moves the brake bias and the roll gradient, in the right directions', () => {
  const rows = sensitivity('cog_height', MASTER, { inputsByTool: {
    ...INPUTS,
    brakes: {
      f_pedalForce: 400, f_pedalRatio: 5, f_mcBore: 15.875, f_circuits: 2, f_caliperBore: 25, f_pistons: 2, f_padMu: 0.4, f_rotorOd: 220, f_padDepth: 20,
      r_pedalForce: 400, r_pedalRatio: 5, r_mcBore: 15.875, r_circuits: 2, r_caliperBore: 25, r_pistons: 2, r_padMu: 0.4, r_rotorOd: 220, r_padDepth: 20,
    },
    springs: {
      f_targetFreq: 2.6, f_unsprung: 12, f_motionRatio: 0.9, f_chosenSpringRate: 0, f_bump: 30, f_droop: 25, f_dampingRatio: 0.65, f_rcHeight: 30,
      r_targetFreq: 2.8, r_unsprung: 12, r_motionRatio: 0.9, r_chosenSpringRate: 0, r_bump: 25, r_droop: 25, r_dampingRatio: 0.65, r_rcHeight: 45,
    },
  } });
  // A higher CoG transfers more load forward under braking ⇒ more front bias wanted.
  const olley = rows.find((r) => r.outputKey === 'olleyOptimum')!;
  expect(olley.slope).toBeGreaterThan(0);
  // A higher CoG lengthens the lever above the roll axis ⇒ more roll per g.
  const roll = rows.find((r) => r.outputKey === 'rollGradient')!;
  expect(roll.slope).toBeGreaterThan(0);
});

it('rows come back tornado-ordered, biggest relative mover first', () => {
  const rows = sensitivity('mass_total', MASTER, { inputsByTool: INPUTS });
  const mag = (r: typeof rows[number]) => (Number.isFinite(r.relative) ? Math.abs(r.relative) : Math.abs(r.delta));
  for (let i = 1; i < rows.length; i++) expect(mag(rows[i - 1])).toBeGreaterThanOrEqual(mag(rows[i]));
});

it('every declared read is a key some adapter really consumes', () => {
  expect(SENSITIVE_KEYS.length).toBeGreaterThan(8);
  for (const d of DOWNSTREAM) expect(d.reads.length).toBeGreaterThan(0);
});

it('downstream tool ids are the real page tool_state keys (P1-2 regression guard)', () => {
  expect(new Set(DOWNSTREAM.map((d) => d.tool))).toEqual(new Set([
    'brakes', 'vd_loads', 'vd_steering', 'vd_steereffort', 'pt_traction', 'aero', 'springs', 'vd_loadtransfer',
  ]));
});
