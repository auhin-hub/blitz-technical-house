/**
 * Chassis — component-mass tracker (CAD vs measured). Ported from the
 * ComponentMass sheet (TOOL_SPECS §2b):
 *   CAD total D = unit · qty
 *   Δ        F = measured − CAD total
 *   TOTAL row = sums. Feeds the MassBudget (chassis mass as built).
 */
import type { Out } from './engine';
type Flat = Record<string, number>;

export const MASS_COMPONENTS = [
  { key: 'frontUpperArm', label: 'Front upper arm' },
  { key: 'frontLowerArm', label: 'Front lower arm' },
  { key: 'rearUpperArm', label: 'Rear upper arm' },
  { key: 'rearLowerArm', label: 'Rear lower arm' },
  { key: 'pushrod', label: 'Pushrod ×corner' },
  { key: 'bellCrank', label: 'Bell crank' },
  { key: 'damper', label: 'Damper' },
  { key: 'upright', label: 'Upright / knuckle' },
  { key: 'wheelHub', label: 'Wheel hub' },
  { key: 'wheel', label: 'Wheel' },
  { key: 'tyre', label: 'Tyre' },
  { key: 'brakeRotor', label: 'Brake rotor' },
  { key: 'brakeCaliper', label: 'Brake caliper' },
  { key: 'fasteners', label: 'Fasteners / misc' },
];

export function massCompute(inp: Flat): Out {
  const out: Out = {};
  let totalCad = 0, totalMeas = 0, totalDelta = 0;
  for (const c of MASS_COMPONENTS) {
    const unit = inp[`unit_${c.key}`] || 0;
    const qty = inp[`qty_${c.key}`] || 0;
    const meas = inp[`meas_${c.key}`] || 0;
    const cad = unit * qty;
    const delta = meas - cad;
    out[`cad_${c.key}`] = cad;
    out[`delta_${c.key}`] = delta;
    totalCad += cad; totalMeas += meas; totalDelta += delta;
  }
  out.totalCad = totalCad;
  out.totalMeas = totalMeas;
  out.totalDelta = totalDelta;
  return out;
}
