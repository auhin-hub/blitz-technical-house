/**
 * Aero — CFD mesh: first-layer height for a target y+ (full-vehicle CFD).
 * From the Aero team's request,
 * reference/requests/Aero_Calculator_Requirements.docx §3 (TOOL_SPECS §1c):
 *
 *   Re  = ρ · U · L / μ                  μ = dynamic viscosity of air (Pa·s)
 *   Cf  = 0.058 · Re^−0.2                flat-plate skin-friction estimate
 *   τw  = Cf · ½ · ρ · U²
 *   u*  = √(τw / ρ)
 *   y   = y+ · μ / (ρ · u*)              first cell CENTRE height
 *   Δ1  = 2 · y                          first layer THICKNESS
 *   δ   = 0.37 · L · Re^−1/5             boundary-layer thickness
 *
 * All SI internally; lengths are reported in mm. These are flat-plate
 * estimates to size the first layer — check the solved y+ field after a run.
 */
import type { Out } from './engine';
type Flat = Record<string, number>;

export function meshCompute(inp: Flat): Out {
  const { rho, u, len, muAir, yPlus } = inp;
  const ok = rho > 0 && u > 0 && len > 0 && muAir > 0 && yPlus > 0;
  if (!ok) return { re: NaN, cf: NaN, tauW: NaN, uStar: NaN, yMm: NaN, firstLayerMm: NaN, deltaMm: NaN };
  const re = (rho * u * len) / muAir;
  const cf = 0.058 * re ** -0.2;
  const tauW = cf * 0.5 * rho * u * u;
  const uStar = Math.sqrt(tauW / rho);
  const y = (yPlus * muAir) / (rho * uStar);          // m
  const delta = 0.37 * len * re ** (-1 / 5);          // m
  return { re, cf, tauW, uStar, yMm: y * 1000, firstLayerMm: 2 * y * 1000, deltaMm: delta * 1000 };
}
