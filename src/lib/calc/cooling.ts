/**
 * Cooling Dyno Analyzer — pure physics (BRIEF §E2).
 *
 * A line-for-line port of the JavaScript in `reference/Cooling Cacl.html`
 * (lerp, getPumpFlow, getGearRatios, calcSpeed, getGearSpeeds, calcRad,
 * solveSSTemp / bisect, runAnalysis, parseCsv and the pump / dyno sample tables).
 * The only changes are mechanical: the original read its numbers from DOM
 * elements and a global `pumpData`; here they are arguments. Operation order is
 * kept identical so results match the original bit-for-bit — cooling.test.ts
 * evaluates the ORIGINAL source text and asserts equality, so any drift fails.
 *
 * Model: engine heat to coolant  Q = P_brake · (1/η − 1) · f_coolant, a
 * louvred-fin radiator by NTU–effectiveness, a bisection for the steady-state
 * inlet temperature where Q_rad = Q_engine, on/off fan thermostat, pump flow
 * interpolated from a pump curve, and vehicle speed from rpm × gear ratio × final
 * drive × tyre size (which sets the ram air).
 */

export interface DynoRow { rpm: number; power: number; torque: number | null; }   // power: kW, torque: N·m
export interface PumpRow { rpm: number; lpm: number; }

/** Standard KTM 390 pump estimate (original `pumpData` / `loadKTMPump`). */
export const KTM_PUMP: PumpRow[] = [
  { rpm: 1000, lpm: 5.0 }, { rpm: 2000, lpm: 10.0 }, { rpm: 3000, lpm: 14.5 },
  { rpm: 4000, lpm: 18.5 }, { rpm: 5000, lpm: 22.0 }, { rpm: 6000, lpm: 26.0 },
  { rpm: 7000, lpm: 29.5 }, { rpm: 8000, lpm: 33.0 }, { rpm: 9000, lpm: 36.0 },
  { rpm: 10000, lpm: 38.5 }, { rpm: 11000, lpm: 40.5 }, { rpm: 11500, lpm: 41.5 },
];

/** Original `loadSample`: a typical KTM 390 RC dyno curve, 13 points, 2000–11500 rpm. */
export const SAMPLE_DYNO: DynoRow[] = [
  { rpm: 2000, power: 4.2, torque: 20.0 }, { rpm: 3000, power: 7.8, torque: 24.8 },
  { rpm: 4000, power: 12.1, torque: 28.9 }, { rpm: 5000, power: 16.5, torque: 31.5 },
  { rpm: 6000, power: 20.8, torque: 33.1 }, { rpm: 7000, power: 24.9, torque: 33.9 },
  { rpm: 8000, power: 28.2, torque: 33.7 }, { rpm: 9000, power: 31.2, torque: 33.1 },
  { rpm: 9500, power: 32.0, torque: 32.2 }, { rpm: 10000, power: 31.5, torque: 30.1 },
  { rpm: 10500, power: 30.8, torque: 28.0 }, { rpm: 11000, power: 29.5, torque: 25.6 },
  { rpm: 11500, power: 27.2, torque: 22.6 },
];

/** KTM 390 RC stock gear ratios (original defaults). */
export const KTM_GEARS = [2.846, 2.000, 1.550, 1.286, 1.095, 0.960];

// ---- interpolation / pump -------------------------------------------------------
export function lerp(x: number, xs: number[], ys: number[]): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i < xs.length - 1; i++) {
    if (x >= xs[i] && x <= xs[i + 1]) {
      const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + t * (ys[i + 1] - ys[i]);
    }
  }
  return ys[ys.length - 1];
}

/** Pump flow (L/min) at an engine rpm, linear interpolation on the pump curve (20 if the table is empty). */
export function getPumpFlow(pump: PumpRow[], rpm: number): number {
  if (!pump.length) return 20; // fallback
  const rpms = pump.map((d) => d.rpm);
  const lpms = pump.map((d) => d.lpm);
  return lerp(rpm, rpms, lpms);
}

// ---- drivetrain -------------------------------------------------------------------
/** v (km/h) = rpm / (gear · primary · final) · π·D_tyre · 60/1000, final = rear / front sprocket. */
export function calcSpeed(rpm: number, gearRatio: number, primRed: number, sprF: number, sprR: number, tyreDiaMm: number): number {
  const finalDrive = sprR / sprF;
  const totalRatio = gearRatio * primRed * finalDrive;
  const tyreCircM = Math.PI * (tyreDiaMm / 1000);  // metres
  const speedMs = (rpm / totalRatio) * tyreCircM / 60;
  return speedMs * 3.6;  // km/h
}

/** The original keeps only gear ratios above zero (so a blank gear drops out). */
export const getGearRatios = (g: number[]): number[] => g.filter((v) => v > 0);

export interface Drive { gears: number[]; primRed: number; sprF: number; sprR: number; tyreDia: number; }

export function getGearSpeeds(rpm: number, d: Drive): { gear: number; ratio: number; speed: number }[] {
  return d.gears.map((gr, i) => ({ gear: i + 1, ratio: gr, speed: calcSpeed(rpm, gr, d.primRed, d.sprF, d.sprR, d.tyreDia) }));
}

// ---- radiator -----------------------------------------------------------------------
export interface CoolingP {
  W: number; H: number; D: number; tp: number; th: number; nt: number; ng: number; fp: number;
  wavePitch: number; litCorr: boolean;
  Tcin: number; maxSafeT: number; Tamb: number;
  flow: number; fan: number; vspd: number; beta: number; fanTrig: number;
}

export interface RadResult {
  UA: number; NTU: number; eps: number; Qa: number; Tout: number; Re: number; ha: number; reg: string;
  ef: number; Atot: number; Ca: number; Cc: number; Tcin: number; litFactor: number;
}

/** Core radiator calc at a given coolant inlet temperature (NTU–ε, cross-flow, both fluids unmixed). */
export function calcRad(P: CoolingP, Tcin_override?: number, flow_override?: number): RadResult {
  const Tcin = Tcin_override !== undefined ? Tcin_override : P.Tcin;
  const fg = (P.tp - P.th) / 1000, Af = P.W * P.H / 1e6, Afr = P.ng * fg * (P.W / 1000);
  const Nf = P.ng * Math.round((P.D / 1000) / (P.fp / 1000));
  const Afin = Nf * 2 * (P.D / 1000) * (P.W / 1000), Atube = P.nt * 2 * (P.D / 1000) * (P.W / 1000);
  const Atot = Afin + Atube, Dh = 2 * fg * (P.D / 1000) / (fg + P.D / 1000);
  const rho_c = 961.5, Cp_c = 4212, hc = 3500;
  const flowLPM = (flow_override !== undefined) ? flow_override : P.flow;
  const mc = rho_c * (flowLPM / 60000), Cc = mc * Cp_c, Rc = 1 / (hc * Atube);
  const rho_a = 1.127, Cp_a = 1005, nu = 1.691e-5, ka = 0.02756, Pr = 0.699;
  const Vf = P.fan * 0.000472, Vr = (P.vspd / 3.6) * Af * P.beta, Vt = Vr + Vf;
  const ma = rho_a * Vt, Ca = ma * Cp_a, vm = Vt / Afr, Re = vm * Dh / nu;
  let ha: number, reg: string;
  if (Re < 2300) { ha = 4.44 * ka / Dh; reg = 'Laminar'; }
  else if (Re < 4000) {
    const hl = 4.44 * ka / Dh, jt = 0.023 * Re ** -0.2, ht = jt * rho_a * vm * Cp_a / Pr ** (2 / 3);
    ha = hl + ((Re - 2300) / 1700) * (ht - hl); reg = 'Transitional';
  } else {
    const j = 0.023 * Re ** -0.2; ha = j * rho_a * vm * Cp_a / Pr ** (2 / 3); reg = 'Turbulent';
  }

  // Literature correction — Ismael, Yun & Ulugbek (2016), fitted from their Tables 1–5:
  // Qn ∝ P_wave^(−0.63), R² = 0.89, reference case P_wave = 2.5 mm. Multiplies h_air.
  let litFactor = 1;
  if (P.litCorr) {
    const P_ref = 2.5, k_fit = -0.63;
    litFactor = Math.pow((P.wavePitch || 2.5) / P_ref, k_fit);
    ha *= litFactor;
  }

  const kf = 205, tf = 0.00008, mf = Math.sqrt(2 * ha / (kf * tf)), mL = mf * fg / 2;
  const ef = Math.tanh(mL) / mL, eo = 1 - (Afin / Atot) * (1 - ef);
  const Ra = 1 / (eo * ha * Atot), Rt = Ra + Rc + 5e-6, UA = 1 / Rt;
  const Cmin = Math.min(Ca, Cc), Cmax = Math.max(Ca, Cc), Cs = Cmin / Cmax, NTU = UA / Cmin;
  const eps = 1 - Math.exp((NTU ** 0.22 / Cs) * (Math.exp(-Cs * NTU ** 0.78) - 1));
  const Qm = Cmin * (Tcin - P.Tamb), Qa = eps * Qm, Tout = Tcin - Qa / Cc;
  return { UA, NTU, eps, Qa, Tout, Re, ha, reg, ef, Atot, Ca, Cc, Tcin, litFactor };
}

export interface SSResult extends RadResult { converged: boolean; Q_rad: number; pumpLPM: number; fanOn: boolean; fanActivated: boolean; }

/**
 * Steady-state solve: the coolant inlet temperature where Q_rad = Q_engine, by bisection
 * (tolerance 0.5 W, ≤ 80 iterations). Fan logic: solve with the fan OFF; if that inlet
 * temperature is above the trigger, re-solve with the fan ON at full CFM. Pump flow is
 * interpolated from the pump curve at `rpm`.
 */
export function solveSSTemp(P: CoolingP, Q_eng: number, rpm: number | undefined, pump: PumpRow[]): SSResult {
  const tol = 0.5;    // W convergence tolerance
  const maxIter = 80;
  const fanCFM = P.fan;
  const fanTrigT = P.fanTrig;
  const upperBound = P.maxSafeT || P.Tcin || 150;  // max safe temp is the solver ceiling

  const pumpLPM = (rpm !== undefined) ? getPumpFlow(pump, rpm) : P.flow;

  function bisect(fanOn: boolean) {
    const Pm = { ...P, fan: fanOn ? fanCFM : 0 };
    let lo = P.Tamb + 1, hi = Math.max(upperBound + 5, 150);  // search up to 5 °C above the limit
    const r_hi = calcRad(Pm, hi, pumpLPM);
    if (r_hi.Qa < Q_eng) return { ...r_hi, Tcin: hi, Tout: r_hi.Tout, converged: false, Q_rad: r_hi.Qa, pumpLPM, fanOn };
    for (let i = 0; i < maxIter; i++) {
      const mid = (lo + hi) / 2;
      const r = calcRad(Pm, mid, pumpLPM);
      const err = r.Qa - Q_eng;
      if (Math.abs(err) < tol) return { ...r, Tcin: mid, Tout: r.Tout, converged: true, Q_rad: r.Qa, pumpLPM, fanOn };
      if (err < 0) lo = mid; else hi = mid;
    }
    const r = calcRad(Pm, (lo + hi) / 2, pumpLPM);
    return { ...r, Tcin: (lo + hi) / 2, Tout: r.Tout, converged: true, Q_rad: r.Qa, pumpLPM, fanOn };
  }

  const noFan = bisect(false);
  if (noFan.Tcin > fanTrigT) {
    const withFan = bisect(true);
    return { ...withFan, fanActivated: true };
  }
  return { ...noFan, fanActivated: false };
}

// ---- dyno CSV (original parseCsv) ------------------------------------------------------
/**
 * One row per line: "RPM, Power_kW, Torque_Nm" (torque optional). Same acceptance rule as the
 * original: ≥ 2 comma-separated fields whose first two pass `!isNaN(string)`. Returns null when no
 * valid row exists, else the rows sorted by rpm.
 */
export function parseDynoCsv(text: string): DynoRow[] | null {
  const lines = text.trim().split('\n');
  const out: DynoRow[] = [];
  lines.forEach((l) => {
    const p = l.split(',').map((s) => s.trim());
    if (p.length >= 2 && !isNaN(p[0] as unknown as number) && !isNaN(p[1] as unknown as number))
      out.push({ rpm: +p[0], power: +p[1], torque: p[2] ? +p[2] : null });
  });
  if (!out.length) return null;
  return out.sort((a, b) => a.rpm - b.rpm);
}

// ---- the analysis (original runAnalysis, numbers only) ----------------------------------------
/** Flat numeric inputs (one per field on the page). Blank/zero fall back as in the original. */
export interface CoolingInputs {
  coreW: number; coreH: number; coreD: number; tubePitch: number; tubeHeight: number; nTubes: number;
  finGaps: number; finPitch: number; wavePitch: number; litCorr: number;
  maxSafeT: number; tAmb: number; beta: number;
  sprF: number; sprR: number; tyreDia: number; primRed: number;
  g1: number; g2: number; g3: number; g4: number; g5: number; g6: number;
  fanCfm: number; fanTrig: number;
  eta: number; fc: number;       // percent, as typed
}

export const DEFAULT_INPUTS: CoolingInputs = {
  coreW: 280, coreH: 150, coreD: 30, tubePitch: 8, tubeHeight: 1, nTubes: 19,
  finGaps: 20, finPitch: 1.2, wavePitch: 2.5, litCorr: 0,
  maxSafeT: 110, tAmb: 40, beta: 0.85,
  sprF: 14, sprR: 42, tyreDia: 520, primRed: 3.071,
  g1: 2.846, g2: 2.000, g3: 1.550, g4: 1.286, g5: 1.095, g6: 0.960,
  fanCfm: 150, fanTrig: 96,
  eta: 30, fc: 50,
};

/**
 * Links to the rest of the site (see TOOL_SPECS): the tyre Ø is 2 × the Master's loaded rolling
 * radius when that is set, and the final drive is the Drivetrain & traction tool's contributed
 * `final_drive` when present. Both fall back to this tool's own inputs. `NaN` / undefined = not set.
 */
export interface CoolingLinks { rollingRadius?: number; finalDrive?: number; }

export interface Resolved {
  P: CoolingP; eta: number; fc: number; drive: Drive;
  tyreSource: 'Vehicle Spec rolling radius' | 'own input';
  finalDriveSource: 'Drivetrain & traction' | 'sprockets';
  finalDriveRatio: number;
}

export function resolveInputs(inp: CoolingInputs, links: CoolingLinks = {}): Resolved {
  const maxSafeT = +inp.maxSafeT || 110;
  const P: CoolingP = {
    W: +inp.coreW, H: +inp.coreH, D: +inp.coreD, tp: +inp.tubePitch, th: +inp.tubeHeight,
    nt: +inp.nTubes, ng: +inp.finGaps, fp: +inp.finPitch,
    wavePitch: +inp.wavePitch || 2.5,
    litCorr: !!inp.litCorr,
    Tcin: maxSafeT,           // upper bound for the solver AND the pass/fail threshold
    maxSafeT,
    Tamb: +inp.tAmb,
    flow: 20,
    fan: +inp.fanCfm,
    vspd: 60,                 // fallback; overridden per gear and rpm below
    beta: +inp.beta,
    fanTrig: +inp.fanTrig || 96,
  };
  const rr = links.rollingRadius;
  const useRr = rr !== undefined && Number.isFinite(rr) && rr > 0;
  const fd = links.finalDrive;
  const useFd = fd !== undefined && Number.isFinite(fd) && fd > 0;
  // Final drive = rear / front sprockets; a linked ratio is passed as 1 : ratio (same quotient).
  const sprF = useFd ? 1 : (+inp.sprF || 14);
  const sprR = useFd ? (fd as number) : (+inp.sprR || 42);
  const drive: Drive = {
    gears: getGearRatios([inp.g1, inp.g2, inp.g3, inp.g4, inp.g5, inp.g6].map((v) => +v)),
    primRed: +inp.primRed || 3.071,
    sprF, sprR,
    tyreDia: useRr ? 2 * (rr as number) : (+inp.tyreDia || 520),
  };
  return {
    P, eta: +inp.eta / 100, fc: +inp.fc / 100, drive,
    tyreSource: useRr ? 'Vehicle Spec rolling radius' : 'own input',
    finalDriveSource: useFd ? 'Drivetrain & traction' : 'sprockets',
    finalDriveRatio: sprR / sprF,
  };
}

export interface Scenario { n: string; Q: number; rpm: number; vspd: number; ss: SSResult; maxSafeT: number; }

export interface CoolingResult {
  resolved: Resolved;
  rpms: number[]; powers: number[]; torques: (number | null)[]; hasTorque: boolean;
  rpmRange: number[]; Qeng: number[];
  Ppeak: number; peakRPM: number; Qpeak: number; Qavg: number;
  ssByGear: SSResult[][]; ToutByGear: number[][]; TcinByGear: number[][];
  topGearIdx: number; ssSolve: SSResult[]; ToutSS: number[]; TcinSS: number[]; QradSS: number[];
  speedsAtPeak: number[]; peakSpeedTopGear: number;
  radAtPeak: SSResult;
  vRange: number[]; ToutV: number[]; QradV: number[];
  margin: number; pass: boolean;
  midRPM: number; midSpeed: number;
  scens: Scenario[];
}

/** `error` is set instead of a result when the inputs cannot be analysed (the original alert()ed). */
export type CoolingRun = { error: string; result?: undefined } | { error?: undefined; result: CoolingResult };

export function runCooling(inp: CoolingInputs, dyno: DynoRow[], pump: PumpRow[], links: CoolingLinks = {}): CoolingRun {
  if (dyno.length < 2) return { error: 'Enter at least 2 dyno data points.' };
  const resolved = resolveInputs(inp, links);
  const { P, eta, fc } = resolved;
  const { gears, primRed, sprF, sprR, tyreDia } = resolved.drive;
  if (!gears.length) return { error: 'Enter at least one gear ratio above zero.' };

  const rpms = dyno.map((d) => d.rpm);
  const powers = dyno.map((d) => d.power * 1000); // W
  const torques = dyno.map((d) => d.torque);
  const hasTorque = torques.some((t) => t !== null);

  // Engine heat load across the rpm range.
  const rpmRange: number[] = [];
  for (let r = rpms[0]; r <= rpms[rpms.length - 1]; r += 100) rpmRange.push(r);
  const Qeng = rpmRange.map((r) => lerp(r, rpms, powers) * (1 / eta - 1) * fc);

  const topGearIdx = gears.length - 1;
  const Ppeak = Math.max(...powers);
  const peakRPM = rpms[powers.indexOf(Ppeak)];
  const Qpeak = Ppeak * (1 / eta - 1) * fc;
  const Qavg = Qeng.reduce((a, b) => a + b, 0) / Qeng.length;

  // Steady-state T_out for every gear × rpm: vehicle speed differs per gear → different ram air.
  const ssByGear = gears.map((gr) => rpmRange.map((r, i) => {
    const vSpd = calcSpeed(r, gr, primRed, sprF, sprR, tyreDia);
    return solveSSTemp({ ...P, vspd: vSpd }, Qeng[i], r, pump);
  }));
  const ToutByGear = ssByGear.map((g) => g.map((s) => s.Tout));
  const TcinByGear = ssByGear.map((g) => g.map((s) => s.Tcin));

  // "Normal" case = highest gear (most speed → most ram air).
  const ssSolve = ssByGear[topGearIdx];
  const ToutSS = ToutByGear[topGearIdx];
  const TcinSS = TcinByGear[topGearIdx];
  const QradSS = ssSolve.map((s) => s.Q_rad / 1000);

  const speedsAtPeak = gears.map((gr) => calcSpeed(peakRPM, gr, primRed, sprF, sprR, tyreDia));

  // KPI cards: peak rpm, top gear.
  const peakSpeedTopGear = calcSpeed(peakRPM, gears[topGearIdx], primRed, sprF, sprR, tyreDia);
  const radAtPeak = solveSSTemp({ ...P, vspd: peakSpeedTopGear }, Qpeak, peakRPM, pump);

  // Speed sweep at peak engine load.
  const vRange: number[] = [];
  for (let v = 0; v <= 120; v += 5) vRange.push(v);
  const ToutV = vRange.map((v) => solveSSTemp({ ...P, vspd: v }, Qpeak, peakRPM, pump).Tout);
  const QradV = vRange.map((v) => calcRad({ ...P, vspd: v }, P.Tcin).Qa / 1000);

  const margin = 110 - radAtPeak.Tout;   // the original prints this against a fixed 110 °C

  // Scenarios.
  const midRPM = rpms[Math.floor(rpms.length / 2)];
  const midSpeed = calcSpeed(midRPM, gears[topGearIdx], primRed, sprF, sprR, tyreDia);
  const vWorst = calcSpeed(peakRPM, gears[0], primRed, sprF, sprR, tyreDia);
  const scenDefs = [
    { n: 'Worst case — peak RPM, 1st gear', Q: Qpeak, rpm: peakRPM, vspd: vWorst },
    { n: 'Peak RPM, top gear', Q: Qpeak, rpm: peakRPM, vspd: peakSpeedTopGear },
    { n: 'Sustained endurance (avg load)', Q: 20000, rpm: midRPM, vspd: midSpeed },
  ];
  const scens: Scenario[] = scenDefs.map((s) => ({ ...s, ss: solveSSTemp({ ...P, vspd: s.vspd }, s.Q, s.rpm, pump), maxSafeT: P.maxSafeT }));

  return {
    result: {
      resolved, rpms, powers, torques, hasTorque, rpmRange, Qeng, Ppeak, peakRPM, Qpeak, Qavg,
      ssByGear, ToutByGear, TcinByGear, topGearIdx, ssSolve, ToutSS, TcinSS, QradSS,
      speedsAtPeak, peakSpeedTopGear, radAtPeak, vRange, ToutV, QradV,
      margin, pass: radAtPeak.Tout < 110, midRPM, midSpeed, scens,
    },
  };
}

/** Core frontal area of the radiator as modelled, m² (original `Af = W·H/1e6`). */
export const coreFrontalAreaM2 = (P: Pick<CoolingP, 'W' | 'H'>): number => P.W * P.H / 1e6;
