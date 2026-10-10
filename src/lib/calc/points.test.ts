/** FS points predictor (Handoff v2 P3.5). */
import { it, expect } from 'vitest';
import { relativePoints, COMPETITIONS } from './points';

it('relative formula: P_max at T_min, 0 at/beyond T_max, monotone', () => {
  expect(relativePoints(100, 4.0, 4.0, 6.0)).toBeCloseTo(100, 6);  // at best
  expect(relativePoints(100, 6.0, 4.0, 6.0)).toBe(0);              // at Tmax
  expect(relativePoints(100, 7.0, 4.0, 6.0)).toBe(0);              // beyond Tmax
  const mid = relativePoints(100, 5.0, 4.0, 6.0);
  expect(mid).toBeGreaterThan(0); expect(mid).toBeLessThan(100);
  // faster scores higher
  expect(relativePoints(100, 4.5, 4.0, 6.0)).toBeGreaterThan(relativePoints(100, 5.0, 4.0, 6.0));
});

it('invalid inputs → NaN', () => {
  expect(Number.isNaN(relativePoints(100, 0, 4, 6))).toBe(true);
  expect(Number.isNaN(relativePoints(100, 5, 6, 6))).toBe(true); // tMax <= tMin
});

it('both competitions defined with event sets', () => {
  expect(COMPETITIONS.japan.events.length).toBe(8);
  expect(COMPETITIONS.uk.events.length).toBe(8);
  const total = COMPETITIONS.japan.events.reduce((s, e) => s + e.pMax, 0);
  expect(total).toBe(1000);
});
