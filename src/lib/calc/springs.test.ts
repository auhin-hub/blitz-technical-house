/** Springs & dampers (MASTER_BUILD_PLAN §6.5) — tyre-in-series, MR, roll. */
import { describe, it, expect } from 'vitest';
import { springsCompute, mrFromGeometry, type SpringSide, type SpringsMaster } from './springs';

// mass 264, ff 0.5, unsprung 16 → sprung corner = 264·0.5/2 − 16 = 50 kg (F=R here).
const s: SpringSide = { targetFreq: 2.5, unsprung: 16, motionRatio: 0.7, chosenSpringRate: 28.72035, bump: 30, droop: 25, dampingRatio: 0.65 };
const m: SpringsMaster = { mass: 264, ff: 0.5, kt: 100, cogHeight: 300, trackFront: 1200, trackRear: 1200 };
const out = springsCompute(s, { ...s }, m);

describe('Springs · rates with tyre in series', () => {
  it('ride rate, wheel rate (tyre in series), spring rate', () => {
    expect(out.f_sprungCorner as number).toBeCloseTo(50, 6);
    expect(out.f_rideRate as number).toBeCloseTo(12.337, 2);   // (2πf)²·m → N/mm
    expect(out.f_wheelRate as number).toBeCloseTo(14.073, 2);  // Kr·Kt/(Kt−Kr), stiffer than Kr
    expect(out.f_springRate as number).toBeCloseTo(28.720, 2);  // Kw/MR²
    expect(out.f_springTravel as number).toBeCloseTo(38.5, 3);
  });
  it('wheel rate exceeds ride rate (the tyre-in-series fix)', () => {
    expect(out.f_wheelRate as number).toBeGreaterThan(out.f_rideRate as number);
  });
  it('damping from the wheel rate', () => {
    expect(out.f_critDamping as number).toBeCloseTo(1677.67, 1); // 2√(Kw·m)
    expect(out.f_damperRate as number).toBeCloseTo(1090.49, 1);  // ζ·Cc
  });
  it('re-check frequency round-trips to the target', () => {
    expect(out.f_recheckFreq as number).toBeCloseTo(2.5, 3);
  });
});

describe('Springs · roll', () => {
  it('roll stiffness + roll gradient (springs only)', () => {
    expect(out.rollStiffFront as number).toBeCloseTo(176.83, 1); // ½·Kw·t² → N·m/deg
    expect(out.rollGradient as number).toBeCloseTo(2.197, 2);    // (m·g·h)/Kφ_total → deg/g
  });
});

describe('Springs · MR from rocker geometry', () => {
  it('MR = L_d·cosθ_d / (L_p·cosθ_p)', () => {
    expect(mrFromGeometry(50, 10, 60, 20)).toBeCloseTo(0.87334, 4);
  });
});
