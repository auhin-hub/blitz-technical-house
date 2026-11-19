/**
 * Aero — performance impact on steady cornering. From the Aero team's request,
 * reference/requests/Aero_Calculator_Requirements.docx §4 (TOOL_SPECS §1b):
 *
 *   V0 = √(μt · g · R)                                   corner speed, no aero
 *   V  = √[ μt · m · g / ( m/R − μt · ½ · ρ · ClA ) ]    corner speed, with aero
 *   t  = 2π · R / V                                      skidpad (one lap) time
 *   ΔV% = (V − V0) / V0 · 100
 *   ay = V² / R;  in g: ay / g
 *   P_drag = ½ · ρ · CdA · V³                            (per speed, in aero.ts)
 *
 * The with-aero speed comes from m·V²/R = μt·(m·g + ½ρ·ClA·V²). When
 * m/R ≤ μt·½ρ·ClA the downforce grows faster than the grip the corner asks
 * for, so this steady-state model has no speed limit — we say so in words
 * instead of printing a meaningless or imaginary number.
 */
import type { Out } from './engine';

export const G = 9.81;

export interface PerfIn { mass: number; mu: number; radius: number; rho: number; clA: number; }

export function aeroPerformance(p: PerfIn): Out {
  const ok = p.mass > 0 && p.mu > 0 && p.radius > 0 && p.rho > 0 && p.clA >= 0;
  if (!ok) {
    return { v0Kmh: NaN, vKmh: NaN, dvPct: NaN, t0: NaN, t: NaN, ayG: NaN,
      perfNote: 'Needs total mass and peak lateral μ in Vehicle Spec, and a radius.' };
  }
  const v0 = Math.sqrt(p.mu * G * p.radius);
  const denom = p.mass / p.radius - p.mu * 0.5 * p.rho * p.clA;
  const limited = denom <= 0;
  const v = limited ? NaN : Math.sqrt((p.mu * p.mass * G) / denom);
  return {
    v0Kmh: v0 * 3.6,
    vKmh: v * 3.6,
    dvPct: ((v - v0) / v0) * 100,
    t0: (2 * Math.PI * p.radius) / v0,
    t: (2 * Math.PI * p.radius) / v,
    ayG: (v * v) / p.radius / G,
    perfNote: limited
      ? 'Downforce-limited: at this radius downforce grows faster than the grip the corner needs, so the steady-state model sets no speed limit.'
      : 'Grip-limited steady cornering (tyre μ from Vehicle Spec; belt-rig μ ≠ track μ).',
  };
}
