/**
 * Chassis team request (reference/requests/FSAE_Chassis_Calculator_Requirements.pdf)
 * — every expected value below is the request's own worked example.
 */
import { describe, it, expect } from 'vitest';
import { impactForce, impactCompute } from './chassis-impact';
import { twistTest, relativeStiffness, stiffnessCompute } from './chassis-stiffness';

describe('§3–5 impact forces (m = 300 kg)', () => {
  it('front, 20 g → 58,860 N (58.86 kN)', () => {
    expect(impactForce(300, 20)).toBeCloseTo(58860, 6);
  });
  it('rear and side, 10 g → 29,430 N each', () => {
    const o = impactCompute({ nFront: 20, nRear: 10, nSide: 10 }, { mass_total: 300 });
    expect(o.rear as number).toBeCloseTo(29430, 6);
    expect(o.side as number).toBeCloseTo(29430, 6);
    expect(o.frontKn as number).toBeCloseTo(58.86, 6);
  });
  it('no mass → "—", not a zero that reads like an answer', () => {
    expect(impactForce(0, 20)).toBeNaN();
  });
});

describe('§6 torsional stiffness (F 1000 N, d 0.6 m, δ 0.8 + 0.8 mm)', () => {
  const t = twistTest(1000, 0.6, 0.8, 0.8);
  it('T = 600 N·m', () => expect(t.torque).toBeCloseTo(600, 9));
  it('θ = 0.002667 rad = 0.1528°', () => {
    expect(t.thetaRad).toBeCloseTo(0.002667, 6);
    expect(t.thetaDeg).toBeCloseTo(0.1528, 4);
  });
  it('K ≈ 3,927 N·m/deg, and N·m/deg = N·m/rad ÷ 57.2958', () => {
    expect(t.kDeg).toBeCloseTo(3927, 0);
    expect(t.kDeg).toBeCloseTo(t.kRad / 57.2958, 1);
  });
  it('zero deflection → no angle → "—"', () => {
    expect(twistTest(1000, 0.6, 0, 0).kDeg).toBeNaN();
  });
});

describe('§7 relative stiffness (K_ch 1600, Kf 133.07, Kr 221.37 N·m/deg)', () => {
  const r = relativeStiffness(1600, 133.07, 221.37);
  it('K_sus = 83.11', () => expect(r.kSus).toBeCloseTo(83.11, 2));
  it('K_vehicle = 79.01', () => expect(r.kVehicle).toBeCloseTo(79.01, 2));
  it('K_relative = 1,925.15 %', () => expect(r.kRelative).toBeCloseTo(1925.15, 0));
});

it('the page tool feeds §6 K straight into §7', () => {
  const o = stiffnessCompute({ force: 1000, dist: 0.6, defl1: 0.8, defl2: 0.8, kf: 133.07, kr: 221.37 });
  const expected = relativeStiffness(twistTest(1000, 0.6, 0.8, 0.8).kDeg, 133.07, 221.37);
  expect(o.kRelative as number).toBeCloseTo(expected.kRelative, 9);
});
