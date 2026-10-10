/** MassBudget maths vs hand-computed values (MASTER_BUILD_PLAN §6.2). */
import { describe, it, expect } from 'vitest';
import { massBudget, type MbRow } from './massbudget';

describe('MassBudget · CG / Izz / front fraction', () => {
  // 120 kg at the front axle (x=0), 80 kg at the rear axle (x=1500), L=1500.
  const rows: MbRow[] = [
    { mass: 120, x: 0, y: 0, z: 250, unsprung: false, subsystem: 'Front' },
    { mass: 80, x: 1500, y: 0, z: 350, unsprung: true, subsystem: 'Rear' },
  ];
  const r = massBudget(rows, 1500);

  it('totals + CG', () => {
    expect(r.total).toBeCloseTo(200, 6);
    expect(r.xCg).toBeCloseTo(600, 6);       // (0·120 + 1500·80)/200
    expect(r.yCg).toBeCloseTo(0, 6);
    expect(r.zCg).toBeCloseTo(290, 6);       // (250·120 + 350·80)/200
  });
  it('front fraction = 1 − x_cg/L', () => {
    expect(r.frontFraction).toBeCloseTo(0.6, 6); // 1 − 600/1500; = 120/200 front mass
  });
  it('yaw inertia (mm→m)', () => {
    // 120·(0.6²) + 80·(0.9²) = 43.2 + 64.8
    expect(r.izz).toBeCloseTo(108, 6);
  });
  it('sprung / unsprung split + subsystem sums', () => {
    expect(r.sprung).toBeCloseTo(120, 6);
    expect(r.unsprung).toBeCloseTo(80, 6);
    expect(r.bySubsystem.Front).toBeCloseTo(120, 6);
    expect(r.bySubsystem.Rear).toBeCloseTo(80, 6);
  });
  it('parallel-axis local_Izz adds to the point-mass term', () => {
    // Same two masses + 5 and 3 kg·m² of local inertia → 108 + 8.
    const withLocal = massBudget([
      { ...rows[0], localIzz: 5 },
      { ...rows[1], localIzz: 3 },
    ], 1500);
    expect(withLocal.izz).toBeCloseTo(116, 6);
  });
  it('empty budget is safe', () => {
    const e = massBudget([], 1500);
    expect(e.total).toBe(0);
    expect(Number.isNaN(e.frontFraction)).toBe(true);
  });
});
