/**
 * Cooling Dyno Analyzer port — equivalence with the ORIGINAL JavaScript.
 *
 * The original (`reference/Cooling Cacl.html`) is read as text, its physics /
 * runAnalysis number-crunching / parseCsv are cut out verbatim and evaluated with a
 * stubbed `document`, and every result is compared with src/lib/calc/cooling.ts for
 * several input sets, including the built-in sample dyno data and the KTM pump table.
 * If the port (or the reference file) drifts, these fail. Plus physical-constraint tests.
 */
import { describe, it, expect } from 'vitest';
import {
  lerp, getPumpFlow, calcSpeed, getGearSpeeds, calcRad, solveSSTemp, parseDynoCsv, runCooling, resolveInputs,
  KTM_PUMP, SAMPLE_DYNO, DEFAULT_INPUTS, KTM_GEARS,
  type CoolingInputs, type DynoRow, type PumpRow, type CoolingP,
} from './cooling';

const REF = import.meta.glob('../../../reference/*.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const SRC = Object.entries(REF).find(([k]) => k.includes('Cooling'))?.[1] ?? '';

const between = (from: string, to: string): string => {
  const a = SRC.indexOf(from), b = SRC.indexOf(to, a + from.length);
  if (a < 0 || b < 0) throw new Error(`marker not found in reference html: ${from} … ${to}`);
  return SRC.slice(a, b);
};

// ---- the original, executed ------------------------------------------------------------
const PHYSICS = between('function lerp(', '// ── Run analysis');                 // lerp, calcRad, solveSSTemp
const PUMPFN = between('function getPumpFlow(', '// ── Tabs');                    // getPumpFlow
const GEARFN = between('function getGearRatios()', 'function updateSpeedPreview'); // getGearRatios, calcSpeed, getGearSpeeds
const RUN = between('function runAnalysis(){', '// colour helpers for chart');   // inputs → numbers
const CSVFN = between('function parseCsv(){', 'function loadSample');

/** DOM values keyed by element id, as the original page would read them. */
type Dom = Record<string, string | boolean>;
const stubDocument = (dom: Dom) => ({
  getElementById: (id: string) => {
    if (!(id in dom)) throw new Error('original read an unexpected element: ' + id);
    const v = dom[id];
    return typeof v === 'boolean' ? { checked: v, value: '' } : { value: v, checked: false };
  },
});

function runOriginal(dom: Dom, dynoData: DynoRow[], pumpData: PumpRow[]) {
  // The body of runAnalysis up to (not including) the chart colours — verbatim — then return the numbers.
  const body = RUN.replace('function runAnalysis(){', '');
  const fn = new Function('document', 'alert', 'dynoData', 'pumpData',
    PUMPFN + PHYSICS + GEARFN + body + `
    return { P, eta, fc, gears, rpms, powers, rpmRange, Qeng, Ppeak, peakRPM, Qpeak, Qavg, ssByGear, ToutByGear, TcinByGear,
      ssSolve, ToutSS, TcinSS, QradSS, speedsAtPeak, peakSpeedTopGear, radAtPeak, rad, vRange, ToutV, QradV, margin, midRPM, midSpeed, scens };`);
  return fn(stubDocument(dom), () => { throw new Error('alert'); }, dynoData, pumpData);
}

/** The same input set expressed for the original's DOM and for the port. */
const toDom = (i: CoolingInputs): Dom => ({
  'p-W': String(i.coreW), 'p-H': String(i.coreH), 'p-D': String(i.coreD), 'p-tp': String(i.tubePitch), 'p-th': String(i.tubeHeight),
  'p-nt': String(i.nTubes), 'p-ng': String(i.finGaps), 'p-fp': String(i.finPitch), 'p-wavep': String(i.wavePitch), 'p-litcorr': !!i.litCorr,
  'p-Tcin': String(i.maxSafeT), 'p-Tamb': String(i.tAmb), 'p-beta': String(i.beta),
  'p-sprF': String(i.sprF), 'p-sprR': String(i.sprR), 'p-tyreDia': String(i.tyreDia), 'p-primRed': String(i.primRed),
  'gr-1': String(i.g1), 'gr-2': String(i.g2), 'gr-3': String(i.g3), 'gr-4': String(i.g4), 'gr-5': String(i.g5), 'gr-6': String(i.g6),
  'p-fan': String(i.fanCfm), 'p-ftrig': String(i.fanTrig), 'p-eta': String(i.eta), 'p-fc': String(i.fc),
});

const INPUT_SETS: { name: string; inp: CoolingInputs; dyno: DynoRow[]; pump: PumpRow[] }[] = [
  { name: 'defaults + sample dyno + KTM pump', inp: DEFAULT_INPUTS, dyno: SAMPLE_DYNO, pump: KTM_PUMP },
  { name: 'hot day, literature correction, wave pitch 3.2', inp: { ...DEFAULT_INPUTS, tAmb: 45, litCorr: 1, wavePitch: 3.2 }, dyno: SAMPLE_DYNO, pump: KTM_PUMP },
  { name: 'bigger core, fewer fan CFM, lower trigger', inp: { ...DEFAULT_INPUTS, coreW: 320, coreH: 200, nTubes: 25, fanCfm: 90, fanTrig: 88, maxSafeT: 105 }, dyno: SAMPLE_DYNO, pump: KTM_PUMP },
  { name: 'short custom dyno + custom pump', inp: { ...DEFAULT_INPUTS, eta: 28, fc: 45, sprR: 45, tyreDia: 480 },
    dyno: [{ rpm: 4000, power: 10.5, torque: null }, { rpm: 6500, power: 19, torque: 28 }, { rpm: 9000, power: 30, torque: 31 }],
    pump: [{ rpm: 2000, lpm: 9 }, { rpm: 6000, lpm: 24 }, { rpm: 10000, lpm: 37 }] },
  { name: 'five gears (one blank), empty pump table → 20 L/min fallback', inp: { ...DEFAULT_INPUTS, g6: 0, primRed: 2.9 }, dyno: SAMPLE_DYNO, pump: [] },
];

it('found the original source (guards the glob and the markers)', () => {
  expect(SRC.length).toBeGreaterThan(50_000);
  expect(PHYSICS).toContain('function calcRad');
  expect(PHYSICS).toContain('function solveSSTemp');
  expect(RUN).toContain('const scens = scenDefs.map');
});

describe('port == original JavaScript', () => {
  it('lerp, getPumpFlow', () => {
    const o = new Function('pumpData', PUMPFN + PHYSICS + 'return { lerp, getPumpFlow };')(KTM_PUMP);
    for (const x of [0, 500, 1000, 1500, 4321, 9999.5, 11500, 20000]) {
      expect(lerp(x, KTM_PUMP.map((d) => d.rpm), KTM_PUMP.map((d) => d.lpm))).toBe(o.lerp(x, KTM_PUMP.map((d) => d.rpm), KTM_PUMP.map((d) => d.lpm)));
      expect(getPumpFlow(KTM_PUMP, x)).toBe(o.getPumpFlow(x));
    }
    const empty = new Function('pumpData', PUMPFN + PHYSICS + 'return getPumpFlow(5000);')([]);
    expect(getPumpFlow([], 5000)).toBe(empty);
    expect(empty).toBe(20);
  });

  it('calcSpeed, getGearSpeeds (DOM-read in the original)', () => {
    const dom: Dom = toDom(DEFAULT_INPUTS);
    const o = new Function('document', 'dynoData', GEARFN + 'return { calcSpeed, getGearSpeeds, getGearRatios };')(stubDocument(dom), []);
    for (const [rpm, gr] of [[3000, 2.846], [9500, 1.55], [11500, 0.96], [0, 1]] as const)
      expect(calcSpeed(rpm, gr, 3.071, 14, 42, 520)).toBe(o.calcSpeed(rpm, gr, 3.071, 14, 42, 520));
    const d = resolveInputs(DEFAULT_INPUTS).drive;
    for (const rpm of [2000, 9500, 11500]) expect(getGearSpeeds(rpm, d)).toEqual(o.getGearSpeeds(rpm));
    expect(d.gears).toEqual(o.getGearRatios());
    expect(d.gears).toEqual(KTM_GEARS);
  });

  it('calcRad over a grid of speeds, fan, temperatures and flows', () => {
    const o = new Function('pumpData', PHYSICS + 'return { calcRad };')(KTM_PUMP);
    const base: CoolingP = resolveInputs(DEFAULT_INPUTS).P;
    for (const vspd of [0, 15, 40, 80, 120]) for (const fan of [0, 150]) for (const Tcin of [70, 96, 110, 130]) for (const flow of [undefined, 12, 38]) {
      const P = { ...base, vspd, fan };
      expect(calcRad(P, Tcin, flow)).toEqual(o.calcRad(P, Tcin, flow));
    }
    const lit = { ...base, vspd: 30, litCorr: true, wavePitch: 3.5 };
    expect(calcRad(lit)).toEqual(o.calcRad(lit));
  });

  it('solveSSTemp (bisection + fan logic) at many operating points', () => {
    const o = new Function('pumpData', PUMPFN + PHYSICS + 'return { solveSSTemp };')(KTM_PUMP);
    const base = resolveInputs(DEFAULT_INPUTS).P;
    for (const vspd of [5, 25, 60, 110]) for (const Q of [3000, 12000, 20000, 26000, 60000]) for (const rpm of [3000, 9500, 11500, undefined]) {
      const P = { ...base, vspd };
      expect(solveSSTemp(P, Q, rpm, KTM_PUMP)).toEqual(o.solveSSTemp(P, Q, rpm));
    }
  });

  it('parseCsv acceptance rules', () => {
    const run = (text: string) => new Function('document', 'alert', 'switchTab', 'renderTable',
      'let dynoData=[];' + CSVFN + 'parseCsv(); return dynoData;')(
      { getElementById: () => ({ value: text }) }, () => { throw new Error('alert'); }, () => {}, () => {});
    const cases = [
      '5000, 16.5, 31.5\n7000, 24.9, 33.9\n9000, 31.2, 33.1\n11000, 29.5, 25.6',
      '9000,31\n3000,8\n6000,21.2,33',                    // unsorted, torque optional
      'rpm,power\n4000,10\n\n5000,14, ',                  // header + blank line + blank torque
      '4000,10,abc\n6000,20,0',                           // non-numeric torque; torque "0" is truthy as a string
    ];
    for (const c of cases) expect(parseDynoCsv(c)).toEqual(run(c));
    expect(parseDynoCsv('nothing,useful')).toBeNull();
    expect(() => run('nothing,useful')).toThrow('alert');
  });

  for (const set of INPUT_SETS) {
    it(`runAnalysis numbers — ${set.name}`, () => {
      const o = runOriginal(toDom(set.inp), set.dyno, set.pump);
      const run = runCooling(set.inp, set.dyno, set.pump);
      expect(run.error).toBeUndefined();
      const r = run.result!;
      expect(r.resolved.P).toEqual(o.P);
      expect(r.resolved.eta).toBe(o.eta); expect(r.resolved.fc).toBe(o.fc);
      expect(r.resolved.drive.gears).toEqual(o.gears);
      expect(r.rpmRange).toEqual(o.rpmRange);
      expect(r.Qeng).toEqual(o.Qeng);
      expect(r.Ppeak).toBe(o.Ppeak); expect(r.peakRPM).toBe(o.peakRPM);
      expect(r.Qpeak).toBe(o.Qpeak); expect(r.Qavg).toBe(o.Qavg);
      expect(r.ssByGear).toEqual(o.ssByGear);
      expect(r.ToutByGear).toEqual(o.ToutByGear); expect(r.TcinByGear).toEqual(o.TcinByGear);
      expect(r.ToutSS).toEqual(o.ToutSS); expect(r.TcinSS).toEqual(o.TcinSS); expect(r.QradSS).toEqual(o.QradSS);
      expect(r.speedsAtPeak).toEqual(o.speedsAtPeak); expect(r.peakSpeedTopGear).toBe(o.peakSpeedTopGear);
      expect(r.radAtPeak).toEqual(o.radAtPeak);
      expect(r.vRange).toEqual(o.vRange); expect(r.ToutV).toEqual(o.ToutV); expect(r.QradV).toEqual(o.QradV);
      expect(r.margin.toFixed(1)).toBe(o.margin);
      expect(r.midRPM).toBe(o.midRPM); expect(r.midSpeed).toBe(o.midSpeed);
      expect(r.scens.map(({ n, Q, rpm, vspd, ss, maxSafeT }) => ({ n, Q, rpm, vspd, ss, maxSafeT })))
        .toEqual(o.scens.map(({ n, Q, rpm, vspd, ss, maxSafeT }: any) => ({ n, Q, rpm, vspd, ss, maxSafeT })));
    });
  }

  it('with the site links applied the port equals the original fed the equivalent DOM values', () => {
    // tyre Ø = 2 × rolling radius; final drive ratio fd ≡ rear sprocket fd over front sprocket 1.
    const links = { rollingRadius: 255, finalDrive: 3.4 };
    const r = runCooling(DEFAULT_INPUTS, SAMPLE_DYNO, KTM_PUMP, links).result!;
    const o = runOriginal({ ...toDom(DEFAULT_INPUTS), 'p-tyreDia': '510', 'p-sprF': '1', 'p-sprR': '3.4' }, SAMPLE_DYNO, KTM_PUMP);
    expect(r.ToutByGear).toEqual(o.ToutByGear);
    expect(r.speedsAtPeak).toEqual(o.speedsAtPeak);
    expect(r.resolved.tyreSource).toBe('Vehicle Spec rolling radius');
    expect(r.resolved.finalDriveSource).toBe('Drivetrain & traction');
    expect(r.resolved.finalDriveRatio).toBeCloseTo(3.4, 12);
    // unset links → the tool's own inputs
    const own = runCooling(DEFAULT_INPUTS, SAMPLE_DYNO, KTM_PUMP, { rollingRadius: NaN, finalDrive: undefined }).result!;
    expect(own.resolved.tyreSource).toBe('own input');
    expect(own.resolved.finalDriveSource).toBe('sprockets');
    expect(own.resolved.finalDriveRatio).toBeCloseTo(3, 12);
  });
});

describe('physical constraints', () => {
  const r0 = runCooling(DEFAULT_INPUTS, SAMPLE_DYNO, KTM_PUMP).result!;
  const P = resolveInputs(DEFAULT_INPUTS).P;

  it('heat to coolant is P·(1/η−1)·f at the peak (hand-computed)', () => {
    // 32 kW peak, η = 0.30, f = 0.50 → 32000·(1/0.3 − 1)·0.5 = 37 333.3 W
    expect(r0.Ppeak).toBe(32000);
    expect(r0.Qpeak).toBeCloseTo(32000 * (1 / 0.3 - 1) * 0.5, 6);
    expect(r0.peakRPM).toBe(9500);
  });
  it('road speed at 9500 rpm in 1st gear (hand-computed)', () => {
    // 9500 / (2.846 · 3.071 · 3) · π·0.52 · 60/1000 = 35.5 km/h
    const v = calcSpeed(9500, 2.846, 3.071, 14, 42, 520);
    expect(v).toBeCloseTo(9500 / (2.846 * 3.071 * 3) * Math.PI * 0.52 * 60 / 1000, 9);
    expect(v).toBeGreaterThan(30); expect(v).toBeLessThan(45);
  });
  it('the converged solve balances heat: Q_rad = Q_engine within the 0.5 W tolerance', () => {
    for (const g of r0.ssByGear) g.forEach((s, i) => { if (s.converged) expect(Math.abs(s.Q_rad - r0.Qeng[i])).toBeLessThan(0.5); });
    expect(r0.radAtPeak.converged).toBe(true);
    expect(Math.abs(r0.radAtPeak.Q_rad - r0.Qpeak)).toBeLessThan(0.5);
  });
  it('outlet is below inlet, effectiveness is in (0,1), temperatures sit above ambient', () => {
    for (const g of r0.ssByGear) for (const s of g) {
      expect(s.Tout).toBeLessThan(s.Tcin);
      expect(s.eps).toBeGreaterThan(0); expect(s.eps).toBeLessThan(1);
      expect(s.Tout).toBeGreaterThan(P.Tamb);
    }
  });
  it('more ram air (higher gear → faster) never raises the outlet temperature at a given rpm, fan state held equal', () => {
    // The on/off fan thermostat is discontinuous (low gear → fan on → can be cooler than the next gear with the
    // fan off), so compare only neighbouring gears that share a fan state.
    let compared = 0;
    for (let i = 0; i < r0.rpmRange.length; i++)
      for (let g = 1; g < r0.ssByGear.length; g++) {
        const a = r0.ssByGear[g - 1][i], b = r0.ssByGear[g][i];
        if (a.fanActivated !== b.fanActivated || !Number.isFinite(a.Tout) || !Number.isFinite(b.Tout)) continue;
        expect(b.Tout).toBeLessThanOrEqual(a.Tout + 1e-9); compared++;
      }
    expect(compared).toBeGreaterThan(50);
  });
  it('a hotter day raises the outlet temperature; more airspeed lowers it (fan off)', () => {
    const hot = runCooling({ ...DEFAULT_INPUTS, tAmb: 50 }, SAMPLE_DYNO, KTM_PUMP).result!;
    expect(hot.radAtPeak.Tout).toBeGreaterThan(r0.radAtPeak.Tout);
    // Fan-off, constant heat: faster car → more ram air → lower T_out. (The fan-off state at 0 km/h has zero air flow,
    // so the model is undefined there: NaN, exactly as in the original — skipped.)
    const cool = [10, 20, 40, 80, 120].map((v) => solveSSTemp({ ...P, vspd: v, fanTrig: 999 }, 8000, 7000, KTM_PUMP).Tout);
    for (let i = 1; i < cool.length; i++) expect(cool[i]).toBeLessThan(cool[i - 1]);
    expect(Number.isNaN(r0.ToutV[0])).toBe(true);   // documents the 0 km/h quirk
  });
  it('heat capacity rates: with a bigger heat load the steady-state temperature is higher', () => {
    const a = solveSSTemp({ ...P, vspd: 40 }, 10000, 8000, KTM_PUMP), b = solveSSTemp({ ...P, vspd: 40 }, 25000, 8000, KTM_PUMP);
    expect(b.Tcin).toBeGreaterThan(a.Tcin);
  });
  it('the fan switches on only when the fan-off inlet temperature exceeds the trigger', () => {
    const cool = solveSSTemp({ ...P, vspd: 100 }, 3000, 5000, KTM_PUMP);
    const hot = solveSSTemp({ ...P, vspd: 3 }, 30000, 9500, KTM_PUMP);
    expect(cool.fanActivated).toBe(false); expect(hot.fanActivated).toBe(true);
  });
  it('does not run on fewer than 2 dyno points or without a gear ratio', () => {
    expect(runCooling(DEFAULT_INPUTS, [SAMPLE_DYNO[0]], KTM_PUMP).error).toMatch(/2 dyno/);
    expect(runCooling({ ...DEFAULT_INPUTS, g1: 0, g2: 0, g3: 0, g4: 0, g5: 0, g6: 0 }, SAMPLE_DYNO, KTM_PUMP).error).toMatch(/gear/);
  });
});
