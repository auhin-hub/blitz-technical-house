/**
 * Chassis — tube stress & factor of safety. Ported from the Chassis
 * Calculations sheet (TOOL_SPECS §2a):
 *   section area  B9  = π/4·(OD² − (OD − 2·wall)²)   (mm²)
 *   axial stress  B10 = force / area                 (N/mm² = MPa)
 *   factor of safety B11 = yield / stress            (target ≥ 1.5)
 */
import type { Out } from './engine';
type Flat = Record<string, number>;

export function tubeCompute(inp: Flat): Out {
  const sectionArea = (Math.PI / 4) * (inp.tubeOd ** 2 - (inp.tubeOd - 2 * inp.tubeWall) ** 2);
  const axialStress = inp.memberForce / sectionArea; // MPa
  const fos = inp.yield / axialStress;
  return { sectionArea, axialStress, fos, torsionMeasured: inp.torsionMeasured };
}
