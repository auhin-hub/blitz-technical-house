/**
 * Chassis — impact forces (front / rear / side). From the Chassis team's
 * request, reference/requests/FSAE_Chassis_Calculator_Requirements.pdf §2–5
 * (TOOL_SPECS §2c):
 *   F = m · n · g        m = mass_total (car + driver, from Master)
 *                        n = design deceleration in g, g = 9.81 m/s²
 * Shown in N and kN. The n values are the team's design assumptions, not
 * rulebook figures — the page labels them that way.
 */
import type { Out } from './engine';
type Flat = Record<string, number>;

export const G = 9.81;

/** Quasi-static impact force F = m·n·g (N). Non-physical inputs give NaN ("—"). */
export function impactForce(massKg: number, nG: number): number {
  return massKg > 0 && nG >= 0 ? massKg * nG * G : NaN;
}

export function impactCompute(inp: Flat, m: Flat): Out {
  const mass = m.mass_total;
  const front = impactForce(mass, inp.nFront);
  const rear = impactForce(mass, inp.nRear);
  const side = impactForce(mass, inp.nSide);
  return {
    front, rear, side,
    frontKn: front / 1000, rearKn: rear / 1000, sideKn: side / 1000,
  };
}
