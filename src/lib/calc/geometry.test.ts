/** Suspension geometry reconstruction (MASTER_BUILD_PLAN §6.4). */
import { describe, it, expect } from 'vitest';
import { geometrySweep, staticRcHeight, antiGeometry, type Hardpoints } from './geometry';

// Both arm lines are constructed to pass through (0, 150), so the instant centre
// is on the centreline at z = 150 → the roll-centre height must be 150 mm.
const hp: Hardpoints = {
  lip: { y: 200, z: 144 }, lbj: { y: 500, z: 135 },   // lower arm line → (0,150)
  uip: { y: 200, z: 222 }, ubj: { y: 500, z: 330 },   // upper arm line → (0,150)
  wc: { y: 500, z: 232.5 }, cp: { y: 520, z: 0 },
};

describe('geometry · RC reconstruction', () => {
  it('static RC height reproduces the input (150 mm)', () => {
    expect(staticRcHeight(hp)).toBeCloseTo(150, 3);
  });
  it('sweep near zero heave gives the same RC + ~0 camber', () => {
    const sweep = geometrySweep(hp, 30);
    expect(sweep.length).toBeGreaterThan(10);
    const at0 = sweep.reduce((p, c) => (Math.abs(c.heave) < Math.abs(p.heave) ? c : p));
    expect(at0.rcHeight).toBeCloseTo(150, 1);
    expect(at0.camber).toBeCloseTo(0, 1);
    expect(at0.scrub).toBeCloseTo(0, 1);
  });
  it('sweep spans bump and droop', () => {
    const sweep = geometrySweep(hp, 30);
    expect(Math.min(...sweep.map((s) => s.heave))).toBeLessThan(-10);
    expect(Math.max(...sweep.map((s) => s.heave))).toBeGreaterThan(10);
  });
});

describe('geometry · anti-dive / anti-squat', () => {
  it('% anti = share·tan(θ)·L/h·100', () => {
    // 0.65 · tan(8°) · 1550/263.409 · 100
    expect(antiGeometry(0.65, 8, 1550, 263.409090909091)).toBeCloseTo(53.75, 1);
  });
});
