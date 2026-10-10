/** Quasi-steady lap sim (handoff P2.6) — behavioural checks. */
import { it, expect } from 'vitest';
import { simulateLap, cornerSpeed, SEED_TRACK, type LapParams } from './lapsim';

const base: LapParams = { mass: 250, muLat: 1.5, muLong: 1.4, launchG: 0.8, brakeG: 1.4, clA: 0, cdA: 0.9, rho: 1.18, power: 32000 };

it('returns a plausible lap time on the seed track', () => {
  const r = simulateLap(base, SEED_TRACK);
  expect(r.lapTime).toBeGreaterThan(5);
  expect(r.lapTime).toBeLessThan(60);
  expect(r.topSpeed).toBeGreaterThan(r.minSpeed);
});

it('more lateral grip → faster lap', () => {
  const slow = simulateLap({ ...base, muLat: 1.2 }, SEED_TRACK).lapTime;
  const fast = simulateLap({ ...base, muLat: 1.8 }, SEED_TRACK).lapTime;
  expect(fast).toBeLessThan(slow);
});

it('downforce raises corner speed', () => {
  expect(cornerSpeed({ ...base, clA: 3 }, 20)).toBeGreaterThan(cornerSpeed({ ...base, clA: 0 }, 20));
});

it('corner speed with no aero = sqrt(mu*g*R)', () => {
  expect(cornerSpeed({ ...base, clA: 0 }, 20)).toBeCloseTo(Math.sqrt(1.5 * 9.81 * 20), 3);
});
