/** g–g envelope (MASTER_BUILD_PLAN §7). */
import { describe, it, expect } from 'vitest';
import { aeroFactor, ggLimits, ggCurve } from './gg';

describe('g–g · aero factor', () => {
  it('is 1 at rest and grows with speed', () => {
    expect(aeroFactor(264, 1.18, 0.8, 0)).toBeCloseTo(1, 6);
    // v=27.78 m/s, W=2589.84, DF=½·1.18·27.78²·0.8 = 364.2 → (W+DF)/W
    expect(aeroFactor(264, 1.18, 0.8, 100)).toBeCloseTo(1.1406, 3);
  });
});

describe('g–g · limits (truncation + aero scaling)', () => {
  const base = { muX: 1.4, muY: 1.5, accelLimit: 0.8, brakeLimit: 1.4, mass: 264, rho: 1.18, clA: 0, speedKmh: 0 };
  it('caps accel by the power limit, braking by grip; lat = μy·k', () => {
    const l = ggLimits(base);
    expect(l.k).toBeCloseTo(1, 6);
    expect(l.latMax).toBeCloseTo(1.5, 6);
    expect(l.accelCap).toBeCloseTo(0.8, 6);   // min(1.4 grip, 0.8 power)
    expect(l.brakeCap).toBeCloseTo(1.4, 6);   // min(1.4 grip, 1.4 brake)
  });
  it('aero scales grip limits at speed (brakeLimit=0 → grip-limited braking)', () => {
    const l = ggLimits({ ...base, brakeLimit: 0, clA: 0.8, speedKmh: 100 });
    expect(l.latMax).toBeCloseTo(1.5 * 1.1406, 3);   // lateral grip scales
    expect(l.brakeCap).toBeCloseTo(1.4 * 1.1406, 3); // uncapped braking → grip-limited, scales
    expect(l.accelCap).toBeCloseTo(0.8, 6);          // power-limited → unchanged
  });
});

describe('g–g · curve', () => {
  const pts = ggCurve({ muX: 1.4, muY: 1.5, accelLimit: 0.8, brakeLimit: 1.4, mass: 264, rho: 1.18, clA: 0, speedKmh: 0 });
  it('is closed and respects the caps', () => {
    expect(pts.length).toBeGreaterThan(50);
    expect(Math.max(...pts.map((p) => p.ax))).toBeCloseTo(0.8, 6);   // accel cap
    expect(Math.min(...pts.map((p) => p.ax))).toBeCloseTo(-1.4, 6);  // brake cap
    expect(Math.max(...pts.map((p) => Math.abs(p.ay)))).toBeCloseTo(1.5, 6); // lateral
  });
});
