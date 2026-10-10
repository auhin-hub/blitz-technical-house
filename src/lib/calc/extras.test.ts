/** Additional-tools backlog (MASTER_BUILD_PLAN §9) — vs hand-computed values. */
import { it, expect } from 'vitest';
import {
  accelCompute, skidpadCompute, gripBudgetCompute, gearSpeedCompute, restrictorCompute,
  tubeBucklingCompute, boltedJointCompute, aeroBalanceCompute, batteryCompute, wireDropCompute,
  cogTiltCompute, cornerWeightCompute, quarterCarCompute, rpSweep,
} from './extras';

it('acceleration 75 m from 0.8 g', () => {
  const r = accelCompute({ launchG: 0.8 });
  expect(r.time75 as number).toBeCloseTo(4.372, 2);
  expect(r.trapSpeed as number).toBeCloseTo(123.5, 0);
});
it('skidpad at μ=1.5, R=8.5 m', () => {
  const r = skidpadCompute({ mu: 1.5, radius: 8.5 });
  expect(r.speed as number).toBeCloseTo(40.26, 1);
  expect(r.lapTime as number).toBeCloseTo(4.775, 2);
});
it('grip budget', () => {
  const r = gripBudgetCompute({ ax: 0.5, ay: 1.2, mu: 1.5 });
  expect(r.usedPct as number).toBeCloseTo(86.667, 2);
  expect(r.marginG as number).toBeCloseTo(0.2, 3);
});
it('gear speed at rpm', () => {
  const r = gearSpeedCompute({ rpm: 9500, primary: 3, gear: 2.5, final: 3, rollingRadius: 228 });
  expect(r.speed as number).toBeCloseTo(36.29, 1);
});
it('intake restrictor power ceiling (20 mm)', () => {
  const r = restrictorCompute({ dia: 20, cd: 0.95, p0: 101.325, t0: 298, afr: 14.7, lhv: 44, thermalEff: 0.3 });
  expect(r.mdotAir as number).toBeCloseTo(70.8, 0);   // g/s
  expect(r.maxPower as number).toBeCloseTo(63.6, 0);  // kW
});
it('tube buckling (Euler)', () => {
  const r = tubeBucklingCompute({ od: 25, id: 21, eGpa: 200, length: 500, k: 1 });
  expect(r.inertia as number).toBeCloseTo(9628.2, 0);
  expect(r.pcr as number).toBeCloseTo(76021, 0);
});
it('bolted joint', () => {
  const r = boltedJointCompute({ tensileArea: 58, proofStrength: 830, kFactor: 0.2, dia: 10 });
  expect(r.proofLoad as number).toBeCloseTo(48140, 0);
  expect(r.clamp as number).toBeCloseTo(36105, 0);
  expect(r.torque as number).toBeCloseTo(72.21, 1);
});
it('aero balance vs CG', () => {
  const r = aeroBalanceCompute({ clAfront: 0.36, clArear: 0.44 }, { mass_frac_front: 0.456867 });
  expect(r.balanceFront as number).toBeCloseTo(0.45, 4);
  expect(r.delta as number).toBeCloseTo(-0.006867, 4);
});
it('battery sizing', () => {
  const r = batteryCompute({ loadA: 26, timeMin: 25, dodPct: 80, voltage: 12 });
  expect(r.ah as number).toBeCloseTo(13.54, 1);
  expect(r.wh as number).toBeCloseTo(162.5, 0);
});
it('wire voltage drop', () => {
  const r = wireDropCompute({ areaMm2: 2.5, lengthM: 3, currentA: 20, systemV: 12 });
  expect(r.drop as number).toBeCloseTo(0.827, 2);
  expect(r.dropPct as number).toBeCloseTo(6.9, 1);
});
it('CoG tilt test', () => {
  const r = cogTiltCompute({ dWeight: 200, wheelbase: 1550, totalWeight: 2590, tiltDeg: 30, wheelRadius: 228 });
  expect(r.cogAboveAxle as number).toBeCloseTo(207.3, 0);
  expect(r.cogHeight as number).toBeCloseTo(435.3, 0);
});
it('corner-weight balance', () => {
  const r = cornerWeightCompute({ fl: 600, fr: 620, rl: 650, rr: 640 });
  expect(r.frontPct as number).toBeCloseTo(48.61, 1);
  expect(r.crossPct as number).toBeCloseTo(50.6, 1);
});
it('quarter-car frequencies', () => {
  const r = quarterCarCompute({ springRate: 30, tyreRate: 100, mSprung: 50, mUnsprung: 12 });
  expect(r.fnSprung as number).toBeCloseTo(3.42, 1);
  expect(r.fnHop as number).toBeCloseTo(16.57, 1);
});
it('R&P gear sweep (PCD 50)', () => {
  const s = rpSweep(50);
  expect(s[0].n).toBe(15);
  expect(s[0].module).toBeCloseTo(3.333, 3);
  expect(s[0].toothThk).toBeCloseTo(5.236, 3);
});
