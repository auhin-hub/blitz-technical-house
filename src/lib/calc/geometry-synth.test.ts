/** Geometry synthesis (Handoff v2 P3.1) vs Suspension_Geometry.xlsx values. */
import { it, expect } from 'vitest';
import { synthesize, solvedScrub, solvedKpiDeg } from './geometry-synth';

const WB = synthesize({
  rcHeight: 50, vsal: 3000, scrub: 40, kpi: 2, lowerOuterHeight: 135, upperOuterHeight: 365,
  lowerArmLen: 493, upperArmLen: 360, caster: 4, mechTrail: 25,
  lowerInnerLong: 300, lowerInnerFwd: 50, upperInnerLong: 400, upperInnerFwd: 75,
  pushrodLowerY: 45, pushrodLowerZ: 135, pushrodUpperY: 412, pushrodUpperZ: 343,
  tyreRadius: 260, track: 1600,
});

it('reproduces the workbook derived values', () => {
  expect(WB.icHeight).toBeCloseTo(187.5, 1);          // D79
  expect(WB.rcAxisAngleDeg).toBeCloseTo(3.5763, 3);   // D78
  expect(WB.lowerArmAngleDeg).toBeCloseTo(-1.0178, 2);// D81 in deg
  expect(WB.upperArmAngleDeg).toBeCloseTo(3.4466, 2); // D85 in deg
});

it('reproduces the workbook hardpoints', () => {
  expect(WB.hp.lbj.y).toBeCloseTo(44.714, 2);   // E39
  expect(WB.hp.lbj.x).toBeCloseTo(15.560, 2);   // D39
  expect(WB.hp.ubj.y).toBeCloseTo(52.746, 2);   // E42
  expect(WB.hp.ubj.x).toBeCloseTo(-0.523, 2);   // D42
  expect(WB.hp.lip.y).toBeCloseTo(537.637, 2);  // D90
  expect(WB.hp.lip.z).toBeCloseTo(143.757, 2);  // D91
  expect(WB.hp.uip.y).toBeCloseTo(412.095, 2);  // D94
  expect(WB.hp.uip.z).toBeCloseTo(343.358, 2);  // D95
});

it('solved scrub/KPI recover the synthesis targets at static', () => {
  expect(solvedScrub(WB.hp.lbj, WB.hp.ubj)).toBeCloseTo(40, 0);   // scrub target
  expect(solvedKpiDeg(WB.hp.lbj, WB.hp.ubj)).toBeCloseTo(2, 0);   // KPI target
});
