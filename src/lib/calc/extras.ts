/**
 * Additional-tools backlog (MASTER_BUILD_PLAN §9). Small, standard engineering
 * calculators, each a pure compute(inp, master) → Out for the engine. Rulebook-
 * dependent values (restrictor Ø, etc.) are labelled inputs (⚖), not hard-coded.
 */
import type { Out } from './engine';
type Flat = Record<string, number>;
const G = 9.81;

// ---- Events ----------------------------------------------------------------
/** Acceleration (75 m) from a constant launch g (first-order estimate). */
export function accelCompute(i: Flat): Out {
  const a = i.launchG * G;
  const t = Math.sqrt((2 * 75) / a);
  return { time75: t, trapSpeed: a * t * 3.6 }; // s, km/h
}
/** Skidpad: V = √(μ·g·R); lap time around a radius R. */
export function skidpadCompute(i: Flat): Out {
  const v = Math.sqrt(i.mu * G * i.radius);
  return { speed: v * 3.6, lapTime: (2 * Math.PI * i.radius) / v, latG: i.mu };
}
/** Grip budget: how much of the friction circle a condition uses. */
export function gripBudgetCompute(i: Flat): Out {
  const used = Math.hypot(i.ax, i.ay);
  return { usedPct: (used / i.mu) * 100, marginG: i.mu - used };
}

// ---- Powertrain ------------------------------------------------------------
/** Road speed at an engine rpm in a gear. */
export function gearSpeedCompute(i: Flat): Out {
  const wheelRpm = i.rpm / (i.primary * i.gear * i.final);
  const v = (wheelRpm * 2 * Math.PI * (i.rollingRadius / 1000)) / 60;
  return { wheelRpm, speed: v * 3.6 };
}
/** Choked air mass flow through the intake restrictor → a power ceiling. ⚖ Ø. */
export function restrictorCompute(i: Flat): Out {
  const gamma = 1.4, R = 287;
  const A = (Math.PI * (i.dia / 1000) ** 2) / 4;                         // m²
  const term = Math.sqrt(gamma / (R * i.t0) * (2 / (gamma + 1)) ** ((gamma + 1) / (gamma - 1)));
  const mdot = i.cd * A * (i.p0 * 1000) * term;                          // kg/s (p0 in kPa)
  const maxPowerW = (mdot / i.afr) * (i.lhv * 1e6) * i.thermalEff;
  return { mdotAir: mdot * 1000, maxPower: maxPowerW / 1000 };           // g/s, kW
}

// ---- Chassis ---------------------------------------------------------------
/** Euler tube buckling: Pcr = π²EI/(KL)², I = π/64(OD⁴−ID⁴). */
export function tubeBucklingCompute(i: Flat): Out {
  const I = (Math.PI / 64) * (i.od ** 4 - i.id ** 4);          // mm⁴
  const E = i.eGpa * 1000;                                     // N/mm²
  const pcr = (Math.PI ** 2 * E * I) / (i.k * i.length) ** 2;  // N
  return { inertia: I, pcr };
}
/** Bolted joint: proof load, clamp (75%), tightening torque T = K·d·F. */
export function boltedJointCompute(i: Flat): Out {
  const proofLoad = i.tensileArea * i.proofStrength;           // N (mm²·MPa)
  const clamp = 0.75 * proofLoad;
  return { proofLoad, clamp, torque: i.kFactor * (i.dia / 1000) * clamp };
}

// ---- Aero ------------------------------------------------------------------
/** Aero balance from front/rear ClA; compare CoP vs CG front fraction. */
export function aeroBalanceCompute(i: Flat, m: Flat): Out {
  const total = i.clAfront + i.clArear;
  const balanceFront = total > 0 ? i.clAfront / total : NaN;
  return { total, balanceFront, cgFront: m.mass_frac_front, delta: balanceFront - m.mass_frac_front };
}

// ---- Electrical ------------------------------------------------------------
/** Battery sizing from load, endurance time and depth of discharge. */
export function batteryCompute(i: Flat): Out {
  const ah = (i.loadA * (i.timeMin / 60)) / (i.dodPct / 100);
  return { ah, wh: ah * i.voltage };
}
/** Wire voltage drop for a run (round trip): ΔV = I·(ρ·2L/A). */
export function wireDropCompute(i: Flat): Out {
  const rho = 1.724e-8;                                   // copper Ω·m
  const area = (i.areaMm2) * 1e-6;                        // m²
  const resistance = (rho * 2 * (i.lengthM)) / area;      // Ω (there+back)
  const drop = i.currentA * resistance;
  return { resistance: resistance * 1000, drop, dropPct: (drop / i.systemV) * 100 }; // mΩ, V, %
}

// ---- Measurement -----------------------------------------------------------
/** CoG height from a tilt test: h = ΔW·L/(W·tanθ) + wheel radius. */
export function cogTiltCompute(i: Flat): Out {
  const h = (i.dWeight * i.wheelbase) / (i.totalWeight * Math.tan((i.tiltDeg * Math.PI) / 180));
  return { cogAboveAxle: h, cogHeight: h + i.wheelRadius };
}
/** Corner-weight balance: front %, left %, cross (diagonal) %. */
export function cornerWeightCompute(i: Flat): Out {
  const total = i.fl + i.fr + i.rl + i.rr;
  return {
    total, frontPct: ((i.fl + i.fr) / total) * 100,
    leftPct: ((i.fl + i.rl) / total) * 100,
    crossPct: ((i.fr + i.rl) / total) * 100,
  };
}

// ---- Steering: rack & pinion gear sweep (§6.4) -----------------------------
export const RP_TEETH = [15, 17, 19, 21, 23, 25];
/** Gear geometry across tooth counts for a fixed pinion PCD (mm). */
export function rpSweep(pcd: number): { n: number; module: number; circPitch: number; toothThk: number; addendum: number }[] {
  return RP_TEETH.map((n) => {
    const m = pcd / n;
    return { n, module: m, circPitch: Math.PI * m, toothThk: 1.5708 * m, addendum: 0.8 * m };
  });
}
/** Rack travel per pinion revolution = π·d (independent of tooth count). */
export function rackTravelPerRev(pcd: number): number { return Math.PI * pcd; }

// ---- Suspension ------------------------------------------------------------
/** Quarter-car: sprung ride frequency (tyre in series) + unsprung hop. */
export function quarterCarCompute(i: Flat): Out {
  const ks = i.springRate * 1000, kt = i.tyreRate * 1000;          // N/mm → N/m
  const kRide = (ks * kt) / (ks + kt);
  const fnSprung = Math.sqrt(kRide / i.mSprung) / (2 * Math.PI);
  const fnHop = Math.sqrt((ks + kt) / i.mUnsprung) / (2 * Math.PI);
  return { fnSprung, fnHop };
}
