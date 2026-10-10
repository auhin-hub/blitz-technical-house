/**
 * Balance (MASTER_BUILD_PLAN §6.7) — where the car pushes or gets loose.
 *
 * Steady-state bicycle model (Milliken RCVD / Gillespie):
 *   Understeer gradient  K = Wf/Cαf − Wr/Cαr        (deg/g)
 *   Static margin        SM = Cαr/(Cαf+Cαr) − a/L   (a/L = 1 − ff)
 *   Characteristic speed (K>0) = √(57.3·L·g / K)    (understeer)
 *   Critical speed       (K<0) = √(−57.3·L·g / K)   (oversteer)
 *   Yaw-rate gain(V)     = (V/L) / (1 + (K/57.3)·V²/(g·L))
 * K>0 understeer · K≈0 neutral · K<0 oversteer.
 *
 * Plus roll-stiffness distribution: front roll-rate fraction (springs + ARBs)
 * vs the target TLLTD — the balance knob.
 */
import type { Out } from './engine';
const G = 9.81;

export interface BalanceMaster { mass: number; ff: number; wheelbase: number; } // wheelbase mm
export interface BalanceInput { caF: number; caR: number; }                      // axle cornering stiffness, N/deg

export function understeer(inp: BalanceInput, m: BalanceMaster): Out {
  const W = m.mass * G;
  const Wf = W * m.ff, Wr = W * (1 - m.ff);
  const L = m.wheelbase / 1000; // m
  const K = Wf / inp.caF - Wr / inp.caR;                 // deg/g
  const SM = inp.caR / (inp.caF + inp.caR) - (1 - m.ff); // fraction of wheelbase
  const balance = K > 0.02 ? 'understeer' : K < -0.02 ? 'oversteer' : 'neutral';
  const charSpeed = K > 0 ? Math.sqrt((57.3 * L * G) / K) * 3.6 : NaN;    // km/h
  const critSpeed = K < 0 ? Math.sqrt((-57.3 * L * G) / K) * 3.6 : NaN;   // km/h
  return { K, SM, balance, charSpeed, critSpeed };
}

/** Steady-state yaw-rate gain (1/s per rad steer) vs speed, for the chart. */
export function yawGainCurve(K: number, wheelbaseMm: number, speedsKmh: number[]) {
  const L = wheelbaseMm / 1000;
  return speedsKmh.map((kmh) => {
    const V = kmh / 3.6;
    const gain = (V / L) / (1 + (K / 57.3) * (V * V) / (G * L));
    return { kmh, gain };
  });
}

export interface RollDist { kTotalFront: number; kTotalRear: number; frontFraction: number; }

/** Front roll-stiffness fraction from spring-derived roll rates + ARB rates. */
export function rollDistribution(kSpringF: number, kSpringR: number, arbF: number, arbR: number): RollDist {
  const kTotalFront = kSpringF + arbF;
  const kTotalRear = kSpringR + arbR;
  const total = kTotalFront + kTotalRear;
  return { kTotalFront, kTotalRear, frontFraction: total > 0 ? kTotalFront / total : NaN };
}

/** ARB rate to add to the front to hit a target front roll-stiffness fraction. */
export function arbForTarget(targetFrac: number, kSpringF: number, kSpringR: number, arbR: number): number {
  // (kSpringF + x) / (kSpringF + x + kSpringR + arbR) = targetFrac
  const kR = kSpringR + arbR;
  const x = (targetFrac * kR - (1 - targetFrac) * kSpringF) / (1 - targetFrac);
  return x; // may be negative → front bar not needed / soften
}
