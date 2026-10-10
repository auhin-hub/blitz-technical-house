/** Lateral load transfer (handoff P2.5) vs hand-computed values. */
import { it, expect } from 'vitest';
import { loadTransfer } from './vd-loadtransfer';

const M = { mass: 250, ff: 0.5, cogHeight: 300, trackFront: 1200, trackRear: 1200, unsprungCorner: 10 };

it('balanced car → TLLTD ≈ 0.5', () => {
  const r = loadTransfer({ ay: 1.5, rcFront: 40, rcRear: 40, kRollFront: 400, kRollRear: 400, unsprungCog: 228 }, M);
  expect(r.tlltdFront).toBeCloseTo(0.5, 6);
  expect(r.dWFront).toBeCloseTo(442.2, 0);
});

it('stiffer front roll stiffness raises front TLLTD', () => {
  const r = loadTransfer({ ay: 1.5, rcFront: 40, rcRear: 40, kRollFront: 600, kRollRear: 400, unsprungCog: 228 }, M);
  expect(r.tlltdFront).toBeGreaterThan(0.5);
  expect(r.tlltdFront).toBeCloseTo(0.576, 2);
});

it('per-corner loads sum to the axle weight', () => {
  const r = loadTransfer({ ay: 1.2, rcFront: 35, rcRear: 45, kRollFront: 450, kRollRear: 350, unsprungCog: 228 }, M);
  const W = 250 * 9.81;
  expect(r.frontOuter + r.frontInner).toBeCloseTo(W * 0.5, 4); // 2·(Wf/2)
  expect(r.rearOuter + r.rearInner).toBeCloseTo(W * 0.5, 4);
});
