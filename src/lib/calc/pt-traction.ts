/**
 * Powertrain — Drivetrain & traction. Ported from the Powertrain Calculations
 * sheet (TOOL_SPECS §6):
 *   wheel torque (1st) B15 = τ·primary·1st·final·η
 *   tractive force     B16 = wheelTorque / (rollingRadius/1000)
 *   traction limit     B17 = μ · rearAxleLoad
 * The workbook's single μ is read as the LONGITUDINAL peak (mu_long_peak): this
 * is a drive-force limit, not a cornering one (audit P1.4). While that key is
 * unset it falls back to mu_lat_peak — the isotropic friction-circle assumption,
 * which is what the workbook did implicitly.
 *   grip-limited?      B18 = IF(tractive>limit, "traction limited", "power limited")
 *   launch accel       B19 = MIN(tractive, limit) / (mass·9.81)
 */
import type { Out } from './engine';
type Flat = Record<string, number>;

export function tractionCompute(inp: Flat, m: Flat): Out {
  const wheelTorque = inp.peakTorque * inp.primary * inp.firstGear * inp.finalDrive * inp.drivelineEff;
  const tractiveForce = wheelTorque / (m.rolling_radius / 1000);
  const muLong = Number.isFinite(m.mu_long_peak) ? m.mu_long_peak : m.mu_lat_peak;
  const tractionLimit = muLong * m.axle_load_rear;
  const launchAccel = Math.min(tractiveForce, tractionLimit) / (m.mass_total * 9.81);
  const gripLimited = tractiveForce > tractionLimit ? 'Yes — traction limited' : 'No — power limited';
  return {
    wheelTorque, tractiveForce, tractionLimit, launchAccel, gripLimited,
    enginePeakPower: inp.peakPower, finalDrive: inp.finalDrive,
  };
}
