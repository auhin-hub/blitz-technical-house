/**
 * Aero team request (reference/requests/Aero_Calculator_Requirements.docx).
 * The request gives equations but no worked examples, so expectations are
 * hand-computed values plus physical identities the formulas must satisfy.
 */
import { describe, it, expect } from 'vitest';
import { aeroCompute } from './aero';
import { aeroPerformance, G } from './aero-perf';
import { meshCompute } from './aero-mesh';
import { aeroBalanceCompute } from './aero-balance';

describe('§1/§4 drag power', () => {
  it('P = ½ρ·CdA·v³ — 120 km/h, ρ 1.18, CdA 0.6 → 13.11 kW', () => {
    const o = aeroCompute({ clA: 0.8, cdA: 0.6, rho: 1.18, radius: 9.125 }, { mass_total: 300, mu_lat_peak: 1.5 });
    expect(o.pw_120 as number).toBeCloseTo(13.1111, 3);      // 0.354 · 33.333³ = 13,111 W
    expect(o.pw_120 as number).toBeCloseTo((o.drag_120 as number) * (120 / 3.6) / 1000, 9);
  });
});

describe('§4 corner speed with / without aero', () => {
  const p = { mass: 300, mu: 1.5, radius: 9.125, rho: 1.18, clA: 0.8 };
  const o = aeroPerformance(p);
  it('V0 = √(μgR) = 11.588 m/s', () => expect((o.v0Kmh as number) / 3.6).toBeCloseTo(11.5876, 3));
  it('V with aero = 11.714 m/s, ΔV ≈ 1.09 %', () => {
    expect((o.vKmh as number) / 3.6).toBeCloseTo(11.7144, 3);
    expect(o.dvPct as number).toBeCloseTo(1.094, 2);
  });
  it('satisfies m·V²/R = μ·(m·g + ½ρ·ClA·V²)', () => {
    const v = (o.vKmh as number) / 3.6;
    const lhs = (p.mass * v * v) / p.radius;
    const rhs = p.mu * (p.mass * G + 0.5 * p.rho * p.clA * v * v);
    expect(lhs).toBeCloseTo(rhs, 6);
  });
  it('skidpad time t = 2πR/V and lateral g = V²/(R·g)', () => {
    const v = (o.vKmh as number) / 3.6;
    expect(o.t as number).toBeCloseTo((2 * Math.PI * p.radius) / v, 9);
    expect(o.ayG as number).toBeCloseTo((v * v) / p.radius / G, 9);
  });
  it('downforce-limited case says so instead of giving a number', () => {
    const lim = aeroPerformance({ ...p, radius: 200, clA: 4 });   // m/R = 1.5 < μ·½ρ·ClA = 3.54
    expect(lim.vKmh).toBeNaN();
    expect(String(lim.perfNote)).toMatch(/Downforce-limited/);
  });
  it('no mass / μ in Master → "—" with a reason', () => {
    const none = aeroPerformance({ ...p, mass: 0 });
    expect(none.v0Kmh).toBeNaN();
    expect(String(none.perfNote)).toMatch(/Vehicle Spec/);
  });
});

describe('§3 mesh y+ (ρ 1.225, U 20 m/s, L 3 m, μ 1.81e-5, y+ 1)', () => {
  const o = meshCompute({ rho: 1.225, u: 20, len: 3, muAir: 1.81e-5, yPlus: 1 });
  it('Re = ρUL/μ = 4.061e6', () => expect((o.re as number) / 1e6).toBeCloseTo(4.0608, 3));
  it('Cf = 0.058·Re^−0.2 = 0.002765', () => expect(o.cf as number).toBeCloseTo(0.0027648, 6));
  it('τw = 0.6774 Pa, u* = 0.7436 m/s', () => {
    expect(o.tauW as number).toBeCloseTo(0.67744, 4);        // Cf 0.0027651 × ½·1.225·20²
    expect(o.uStar as number).toBeCloseTo(0.74365, 4);
  });
  it('first cell centre 0.01987 mm, first layer = 2·y, δ = 52.9 mm', () => {
    expect(o.yMm as number).toBeCloseTo(0.019870, 5);
    expect(o.firstLayerMm as number).toBeCloseTo(2 * (o.yMm as number), 12);
    expect(o.deltaMm as number).toBeCloseTo(52.92, 1);
  });
  it('first-cell height scales linearly with target y+', () => {
    const o30 = meshCompute({ rho: 1.225, u: 20, len: 3, muAir: 1.81e-5, yPlus: 30 });
    expect(o30.yMm as number).toBeCloseTo(30 * (o.yMm as number), 9);
  });
});

describe('§2 aero balance from elements', () => {
  const master = { wheelbase: 1550, mass_total: 300, mass_frac_front: 0.46 };
  const base = { speed: 80, rho: 1.18, cdA: 0.6, hDrag: 400,
    cla_fw: 0.3, x_fw: -500, cla_fl: 0.25, x_fl: 700, cla_rw: 0.3, x_rw: 1700, cla_ot: 0, x_ot: 0 };
  const o = aeroBalanceCompute(base, master);

  it('reproduces the old two-number balance: elements on the axles → ClA_f / ΣClA', () => {
    const two = aeroBalanceCompute({ speed: 80, rho: 1.18, cdA: 0, hDrag: 0,
      cla_fw: 0.36, x_fw: 0, cla_rw: 0.44, x_rw: 1550 }, { ...master, mass_frac_front: 0.456867 });
    expect(two.balanceFront as number).toBeCloseTo(0.45, 9);
    expect(two.cpMinusCg as number).toBeCloseTo(-0.006867, 6);
  });
  it('front + rear aero load = total downforce; %front = (l − x_cp)/l', () => {
    expect((o.nfAero as number) + (o.nrAero as number)).toBeCloseTo(o.sumF as number, 9);
    expect(o.pctFront as number).toBeCloseTo(((1550 - (o.xcp as number)) / 1550) * 100, 9);
  });
  it('hand value: 80 km/h → q = 291.36 Pa, ΣF = 247.66 N, %front = 59.39', () => {
    expect(o.sumF as number).toBeCloseTo(247.66, 1);       // 291.36 × 0.85
    expect(o.xcp as number).toBeCloseTo(629.41, 1);        // (−150 + 175 + 510) / 0.85
    expect(o.pctFront as number).toBeCloseTo(59.39, 1);    // (1550 − 629.41) / 1550
  });
  it('axle loads: Nf + Nr = weight + downforce (the drag couple only moves load)', () => {
    expect((o.nf as number) + (o.nr as number)).toBeCloseTo(300 * G + (o.sumF as number), 6);
    const noDrag = aeroBalanceCompute({ ...base, hDrag: 0 }, master);
    expect((noDrag.nf as number) - (o.nf as number)).toBeCloseTo(((o.fDrag as number) * 400) / 1550, 9);
  });
  it('no wheelbase in Master → "—", never a fake balance', () => {
    expect(aeroBalanceCompute(base, { ...master, wheelbase: 0 }).pctFront).toBeNaN();
  });
});
