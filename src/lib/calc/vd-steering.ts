/**
 * Vehicle Dynamics — Steering (Ackermann + rack & pinion).
 * Ported from the Steering sheet (TOOL_SPECS §7f). NOTE: the workbook's
 * Ackermann split uses the TARGET TURNING RADIUS, not the wheelbase as the
 * TOOL_SPECS summary abbreviates it:
 *   B10 = DEGREES(ATAN(L/(R*1000 - t/2)) - ATAN(L/(R*1000 + t/2)))
 *   module m    B18 = d / N
 *   circ. pitch B19 = π·m
 *   base dia    B20 = PCD·cos20°
 *   addendum    B21 = 0.8·m   dedendum B22 = 1.0·m   tooth thk B23 = 1.5708·m
 *   rack/rev    B24 = π·d
 */
type Flat = Record<string, number>;
const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Steering effort (handoff P1.6), worst-case at max lateral grip (per front tyre):
 *   Fy      = μ · (front axle load / 2)
 *   t_mech  = (rolling_radius) · sin(caster)        (mechanical trail)
 *   M_kp    = Fy·(t_mech + pneumatic_trail) + scrub·Fx   (Fx = braking, default 0)
 *   rack    = 2·M_kp / steering_arm_length
 *   SW torque = 2·M_kp / (steering_ratio · efficiency)
 * Lengths in mm → m. Low-speed/parking is the sizing case.
 */
export function steeringEffortCompute(inp: Flat, m: Flat): Flat {
  const Fy = m.mu_lat_peak * (m.axle_load_front / 2);
  const tMech = (m.rolling_radius / 1000) * Math.sin(rad(inp.caster));
  const Mkp = Fy * (tMech + inp.pneumaticTrail / 1000) + (inp.scrubRadius / 1000) * (inp.fx || 0);
  const rackForce = (2 * Mkp) / (inp.steeringArm / 1000);
  const swTorque = (2 * Mkp) / (inp.steeringRatio * inp.efficiency);
  return { fyTyre: Fy, kingpinMoment: Mkp, rackForce, swTorque };
}

export function steeringCompute(inp: Flat, m: Flat): Flat {
  const L = m.wheelbase;           // mm
  const t = m.track_front;         // mm
  const R = inp.turningRadius * 1000; // m → mm
  const ackermannSplit = deg(Math.atan(L / (R - t / 2)) - Math.atan(L / (R + t / 2)));

  const d = inp.pinionPitchDia;
  const N = inp.teeth;
  const module = d / N;
  return {
    ackermannSplit,
    module,
    circularPitch: Math.PI * module,
    baseDia: d * Math.cos(rad(20)),
    addendum: 0.8 * module,
    dedendum: 1.0 * module,
    toothThickness: 1.5708 * module,
    rackTravelPerRev: Math.PI * d,
  };
}
