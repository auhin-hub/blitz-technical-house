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
