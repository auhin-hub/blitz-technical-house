/**
 * Chassis — torsional stiffness from a twist test, then relative chassis
 * stiffness. From the Chassis team's request,
 * reference/requests/FSAE_Chassis_Calculator_Requirements.pdf §6–7
 * (TOOL_SPECS §2d):
 *
 *   §6  T = F · d                       couple (N·m)
 *       θ = arctan((δ1 + δ2) / d)       twist angle — δ in mm, d in m, so the
 *                                       deflections are converted to m first
 *                                       (the request's worked example does this
 *                                       implicitly: 1.6 mm / 600 mm)
 *       K = T / θ                       N·m/rad; N·m/deg = N·m/rad ÷ 57.2958
 *
 *   §7  1/K_sus     = 1/Kf + 1/Kr                    (N·m/deg)
 *       1/K_vehicle = 1/Kf + 1/Kr + 1/K_chassis
 *       K_relative  = K_chassis / K_sus × 100 %
 *       K_chassis comes from §6 — the member never re-types it.
 */
import type { Out } from './engine';
type Flat = Record<string, number>;

const RAD_PER_DEG = Math.PI / 180;

/** §6: twist test → couple, angle, stiffness. NaN ("—") when d or δ give no twist. */
export function twistTest(forceN: number, distM: number, d1Mm: number, d2Mm: number) {
  const valid = distM > 0 && d1Mm + d2Mm > 0;
  const torque = forceN * distM;
  const thetaRad = valid ? Math.atan((d1Mm + d2Mm) / 1000 / distM) : NaN;
  const thetaDeg = thetaRad / RAD_PER_DEG;
  return {
    torque,
    thetaRad,
    thetaDeg,
    kRad: torque / thetaRad,   // N·m/rad
    kDeg: torque / thetaDeg,   // N·m/deg (= kRad ÷ 57.2958)
  };
}

/** §7: series springs Kf — K_chassis — Kr (all N·m/deg). */
export function relativeStiffness(kChassis: number, kf: number, kr: number) {
  const valid = kChassis > 0 && kf > 0 && kr > 0;
  const kSus = valid ? 1 / (1 / kf + 1 / kr) : NaN;
  const kVehicle = valid ? 1 / (1 / kf + 1 / kr + 1 / kChassis) : NaN;
  return { kSus, kVehicle, kRelative: (kChassis / kSus) * 100 };
}

/** The page's single tool: §6 feeds §7 directly. */
export function stiffnessCompute(inp: Flat): Out {
  const t = twistTest(inp.force, inp.dist, inp.defl1, inp.defl2);
  const r = relativeStiffness(t.kDeg, inp.kf, inp.kr);
  return { ...t, ...r };
}
