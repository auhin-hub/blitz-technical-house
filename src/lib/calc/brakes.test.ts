/** Brake system Sizing + Bias sweep (MASTER_BUILD_PLAN §6.6). */
import { describe, it, expect } from 'vitest';
import { computeBrakeSystem, biasSweep, type BrakeSystemMaster } from './brakes';
import type { BrakeSide } from './vd-brakes';

const front: BrakeSide = { pedalForce: 400, pedalRatio: 5, mcBore: 15.875, circuits: 2, caliperBore: 25, pistons: 2, padMu: 0.45, rotorOd: 180, padDepth: 27 };
const rear: BrakeSide = { ...front, pistons: 1 };
const m: BrakeSystemMaster = { ff: 0.456867057673509, h: 263.409090909091, L: 1550, mu: 1.5, tyreRadius: 228, mass: 264 };

describe('Brakes · system sizing', () => {
  const out = computeBrakeSystem(front, rear, m, 1.0);

  it('carries the tested hydraulic chain', () => {
    expect(out.f_brakeTorque as number).toBeCloseTo(345.0416, 3);
    expect(out.achievedFrontBias as number).toBeCloseTo(0.6666667, 6);
  });
  it('dynamic loads + optimal bias at 1.0 g', () => {
    expect(out.optimalBiasTarget as number).toBeCloseTo(0.6268083, 6); // ff + a·h/L
    expect(out.dynFront as number).toBeCloseTo(1623.33, 1);            // W·(ff + a·h/L)
    expect(out.dynRear as number).toBeCloseTo(966.51, 1);              // W·(1 − ff − a·h/L)
  });
  it('required front wheel torque at 1.0 g', () => {
    // totalForce·optimal·Re/2 = 2589.84·0.6268·0.228/2
    expect(out.reqWheelTorqueFront as number).toBeCloseTo(185.06, 1);
  });
});

describe('Brakes · bias sweep', () => {
  const sweep = biasSweep(0.6666667, m);
  it('optimal rises with decel; achieved is fixed', () => {
    expect(sweep[0].g).toBe(0.4);
    expect(sweep[0].optimal).toBeCloseTo(0.5248437, 6); // ff + 0.4·h/L
    expect(sweep[sweep.length - 1].optimal).toBeCloseTo(0.6947850, 6); // ff + 1.4·h/L
    expect(sweep[0].achieved).toBeCloseTo(0.6666667, 6);
  });
});
