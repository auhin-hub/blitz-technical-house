/** Balance — understeer gradient + roll distribution (MASTER_BUILD_PLAN §6.7). */
import { describe, it, expect } from 'vitest';
import { understeer, rollDistribution, arbForTarget, yawGainCurve } from './balance';

describe('Balance · understeer gradient', () => {
  it('front-heavy car understeers (K>0, SM>0, finite char speed)', () => {
    // mass 264, ff 0.55, Cαf=Cαr=2200 N/deg, L=1.55 m
    const r = understeer({ caF: 2200, caR: 2200 }, { mass: 264, ff: 0.55, wheelbase: 1550 });
    expect(r.K as number).toBeCloseTo(0.11772, 4);     // Wf/Cαf − Wr/Cαr
    expect(r.SM as number).toBeCloseTo(0.05, 4);        // Cαr/(Cαf+Cαr) − (1−ff)
    expect(r.balance).toBe('understeer');
    expect(r.charSpeed as number).toBeCloseTo(309.7, 0); // √(57.3·L·g/K)·3.6
    expect(Number.isNaN(r.critSpeed as number)).toBe(true);
  });
  it('50/50 with equal tyres is neutral', () => {
    const r = understeer({ caF: 2200, caR: 2200 }, { mass: 264, ff: 0.5, wheelbase: 1550 });
    expect(r.K as number).toBeCloseTo(0, 6);
    expect(r.balance).toBe('neutral');
  });
  it('yaw-gain curve starts at 0 and is finite for understeer', () => {
    const c = yawGainCurve(0.1177, 1550, [0, 60, 120]);
    expect(c[0].gain).toBeCloseTo(0, 6);
    expect(c[2].gain).toBeGreaterThan(0);
  });
});

describe('Balance · roll-stiffness distribution', () => {
  it('front fraction from springs + ARBs', () => {
    const r = rollDistribution(176.83, 176.83, 50, 50);
    expect(r.frontFraction).toBeCloseTo(0.5, 6);
  });
  it('ARB solved for a target front fraction', () => {
    // target 0.55 front with equal springs 176.83 and no rear bar
    const x = arbForTarget(0.55, 176.83, 176.83, 0);
    const r = rollDistribution(176.83, 176.83, x, 0);
    expect(r.frontFraction).toBeCloseTo(0.55, 6);
  });
});
