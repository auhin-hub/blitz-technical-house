/**
 * Aerodynamics — downforce / drag vs speed. Ported from the Aero Calculations
 * sheet (TOOL_SPECS §1), speeds 40/60/80/100/120 km/h, v = kmh/3.6:
 *   downforce N = 0.5·ρ·v²·ClA
 *   drag N      = 0.5·ρ·v²·CdA
 *   % of weight = downforce / (mass·9.81)
 *   L/D         = ClA / CdA
 */
import type { Out } from './engine';
type Flat = Record<string, number>;

export const SPEEDS = [40, 60, 80, 100, 120];

export function aeroCompute(inp: Flat, m: Flat): Out {
  const out: Out = {};
  for (const s of SPEEDS) {
    const v = s / 3.6;
    const q = 0.5 * inp.rho * v * v;
    out[`df_${s}`] = q * inp.clA;
    out[`drag_${s}`] = q * inp.cdA;
    out[`pct_${s}`] = ((q * inp.clA) / (m.mass_total * 9.81)) * 100; // shown as %
  }
  out.ld = inp.clA / inp.cdA;
  out.clA = inp.clA;
  out.cdA = inp.cdA;
  out.aeroBalance = inp.aeroBalance;
  return out;
}
