/**
 * Aero — balance, centre of pressure and axle loads from per-element
 * downforce. From the Aero team's request,
 * reference/requests/Aero_Calculator_Requirements.docx §2 (TOOL_SPECS §1d):
 *
 *   Fi        = ½ · ρ · V² · ClA_i            each element's downforce
 *   Nf,aero   = Σ Fi · (l − xi) / l           xi from the FRONT axle, +rearward
 *   Nr,aero   = Σ Fi · xi / l                 (a front wing ahead of the axle
 *                                              has xi < 0: it loads the front by
 *                                              more than Fi and lifts the rear)
 *   %front    = Nf,aero / (Nf,aero + Nr,aero) · 100
 *   x_cp      = Σ(Fi · xi) / Σ Fi
 *   Nf        = m·g·(static %front) + Nf,aero − F_drag · h_drag / l
 *   Nr        = m·g·(static %rear)  + Nr,aero + F_drag · h_drag / l
 *
 * Because every Fi scales with V², %front and x_cp don't depend on speed —
 * only the loads do. Supersedes the two-number front/rear Cl·A balance: two
 * elements sitting on the axles (x = 0, x = l) reproduce it exactly.
 */
import type { Out } from './engine';
type Flat = Record<string, number>;

export const G = 9.81;

export const AERO_ELEMENTS = [
  { key: 'fw', label: 'Front wing' },
  { key: 'fl', label: 'Floor / diffuser' },
  { key: 'rw', label: 'Rear wing' },
  { key: 'ot', label: 'Body & other' },
] as const;

/** inp: speed (km/h), rho, cdA, hDrag (mm), cla_<el>, x_<el> (mm).
 *  m: wheelbase (mm), mass_total (kg), mass_frac_front (-). */
export function aeroBalanceCompute(inp: Flat, m: Flat): Out {
  const l = m.wheelbase;
  const v = inp.speed / 3.6;
  const q = 0.5 * inp.rho * v * v;
  const out: Out = {};

  let sumF = 0, sumFx = 0, sumClA = 0;
  for (const e of AERO_ELEMENTS) {
    const cla = inp[`cla_${e.key}`] || 0;
    const x = inp[`x_${e.key}`] || 0;
    const f = q * cla;
    out[`f_${e.key}`] = f;
    sumF += f; sumFx += f * x; sumClA += cla;
  }
  const ok = l > 0 && sumF > 0;
  const nrAero = ok ? sumFx / l : NaN;
  const nfAero = ok ? sumF - nrAero : NaN;            // = Σ Fi·(l − xi)/l
  const balanceFront = ok ? nfAero / (nfAero + nrAero) : NaN;
  const fDrag = q * inp.cdA;
  const pitch = l > 0 ? (fDrag * inp.hDrag) / l : NaN; // drag couple → axle loads

  const ff = m.mass_frac_front;
  const weight = m.mass_total * G;
  const haveMass = m.mass_total > 0 && ff > 0 && ff < 1;

  Object.assign(out, {
    sumClA, sumF, fDrag,
    nfAero, nrAero,
    pctFront: balanceFront * 100,
    balanceFront,
    xcp: ok ? sumFx / sumF : NaN,
    xcg: haveMass && l > 0 ? (1 - ff) * l : NaN,
    cpMinusCg: haveMass ? balanceFront - ff : NaN,  // >0 = downforce front-biased vs weight
    nf: haveMass ? weight * ff + nfAero - pitch : NaN,
    nr: haveMass ? weight * (1 - ff) + nrAero + pitch : NaN,
  });
  return out;
}
