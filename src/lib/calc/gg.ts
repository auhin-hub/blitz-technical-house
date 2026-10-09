/**
 * g–g diagram (MASTER_BUILD_PLAN §7) — the acceleration envelope.
 * Grip ellipse (ax/μx)² + (ay/μy)² = 1 in g, truncated at the top by the
 * power/traction-limited launch g and at the bottom by max braking g, and
 * expanded with speed by aero downforce: every g-limit scales by
 *   k(v) = (W + DF(v)) / W,   DF = ½·ρ·v²·ClA
 * because grip force ∝ (W + DF) while weight stays W.
 */
import type { Out } from './engine';

export interface GgInput {
  muX: number; muY: number;        // peak longitudinal / lateral grip (g)
  accelLimit: number;              // power/traction-limited launch g (cap on +ax)
  brakeLimit: number;              // max braking g (cap on −ax)
  mass: number; rho: number; clA: number; speedKmh: number;
}

/** Aero grip multiplier at a speed (1 at rest). */
export function aeroFactor(mass: number, rho: number, clA: number, speedKmh: number): number {
  const v = speedKmh / 3.6;
  const W = mass * 9.81;
  if (!(W > 0)) return 1;
  const DF = 0.5 * rho * v * v * clA;
  return (W + DF) / W;
}

export interface GgLimits { k: number; latMax: number; longMax: number; accelCap: number; brakeCap: number; }

/** The scaled envelope limits at the current speed. */
export function ggLimits(i: GgInput): GgLimits {
  const k = aeroFactor(i.mass, i.rho, i.clA, i.speedKmh);
  const latMax = i.muY * k;
  const longMax = i.muX * k;              // grip-limited longitudinal g
  const accelCap = Math.min(longMax, i.accelLimit > 0 ? i.accelLimit : longMax);
  const brakeCap = Math.min(longMax, i.brakeLimit > 0 ? i.brakeLimit : longMax);
  return { k, latMax, longMax, accelCap, brakeCap };
}

/** Closed boundary of the (truncated, aero-scaled) g–g envelope, ay on x, ax on y. */
export function ggCurve(i: GgInput, n = 160): { ax: number; ay: number }[] {
  const { latMax, longMax, accelCap, brakeCap } = ggLimits(i);
  const pts: { ax: number; ay: number }[] = [];
  for (let s = 0; s <= n; s++) {
    const t = (s / n) * 2 * Math.PI;
    const ay = latMax * Math.cos(t);
    let ax = longMax * Math.sin(t);
    ax = Math.min(accelCap, Math.max(-brakeCap, ax)); // flatten top (accel) / bottom (brake)
    pts.push({ ax, ay });
  }
  return pts;
}

/** Flat summary for display. */
export function ggSummary(i: GgInput): Out {
  const l = ggLimits(i);
  return { k: l.k, latMax: l.latMax, accelCap: l.accelCap, brakeCap: l.brakeCap };
}
