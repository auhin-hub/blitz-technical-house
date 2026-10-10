/**
 * Suspension geometry SYNTHESIS (Handoff v2 P3.1), ported verbatim from
 * Suspension_Geometry.xlsx (Bhavik Joshi). Target parameters → a 3D hardpoint
 * set that the solver then reads. Planar (front-view y/z) synthesis; longitudinal
 * x comes from the caster/mech-trail relation (outer) and the inner-distance
 * inputs (inner). Workbook cell trail in comments. Lengths mm, angles deg in,
 * radians internally.
 */
export interface SynthInput {
  rcHeight: number;          // D11
  vsal: number;              // D12 (VSAL, Y component)
  scrub: number;             // D13
  kpi: number;               // D14 (deg)
  lowerOuterHeight: number;  // D15
  upperOuterHeight: number;  // D16
  lowerArmLen: number;       // D17
  upperArmLen: number;       // D18
  caster: number;            // D19 (deg)
  mechTrail: number;         // D20
  lowerInnerLong: number;    // D21 (fore→aft span)
  lowerInnerFwd: number;     // D22 (forward inner x ahead of contact patch)
  upperInnerLong: number;    // D23
  upperInnerFwd: number;     // D24
  pushrodLowerY: number;     // D25
  pushrodLowerZ: number;     // D26
  pushrodUpperY: number;     // D27
  pushrodUpperZ: number;     // D28
  tyreRadius: number;        // D31 loaded radius
  track: number;             // D32 front track
}

export interface Pt3 { x: number; y: number; z: number; }
export interface SynthResult {
  hp: { lip: Pt3; uip: Pt3; lbj: Pt3; ubj: Pt3; wc: Pt3; cp: Pt3 };
  // Derived chart points + diagnostics (verbatim labels).
  icHeight: number;          // D79
  rcAxisAngleDeg: number;    // D78
  icY: number;               // VSAL
  rcY: number;               // track/2
  lowerArmAngleDeg: number;  // D81
  upperArmAngleDeg: number;  // D85
  // inner rearward longitudinal x (for the side view)
  lowerInnerRearX: number;   // D22 − D21
  upperInnerRearX: number;   // D24 − D23
  pushrodLower: Pt3; pushrodUpper: Pt3;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function synthesize(i: SynthInput): SynthResult {
  const kpiR = rad(i.kpi);                                   // D30
  const casterR = rad(90 - i.caster);                        // D29
  const rcAxisAngle = Math.atan(i.rcHeight / (i.track / 2)); // D77
  const icHeight = i.vsal * Math.tan(rcAxisAngle);           // D79

  const lowerOuterY = i.scrub + Math.tan(kpiR) * i.lowerOuterHeight; // E39
  const upperOuterY = i.scrub + Math.tan(kpiR) * i.upperOuterHeight; // E42
  const lowerArmAngle = Math.atan((i.lowerOuterHeight - icHeight) / (i.vsal - lowerOuterY)); // D81
  const upperArmAngle = Math.atan((i.upperOuterHeight - icHeight) / (i.vsal - upperOuterY)); // D85

  const innerLowerY = lowerOuterY + i.lowerArmLen * Math.cos(lowerArmAngle); // D90
  const innerLowerZ = i.lowerOuterHeight - i.lowerArmLen * Math.sin(lowerArmAngle); // D91
  const innerUpperY = upperOuterY + i.upperArmLen * Math.cos(upperArmAngle); // D94
  const innerUpperZ = i.upperOuterHeight - i.upperArmLen * Math.sin(upperArmAngle); // D95

  const lowerOuterX = -(i.lowerOuterHeight / Math.tan(casterR)) + i.mechTrail; // D39
  const upperOuterX = -(i.upperOuterHeight / Math.tan(casterR)) + i.mechTrail; // D42

  return {
    hp: {
      cp: { x: 0, y: 0, z: 0 },
      lbj: { x: lowerOuterX, y: lowerOuterY, z: i.lowerOuterHeight },
      ubj: { x: upperOuterX, y: upperOuterY, z: i.upperOuterHeight },
      lip: { x: i.lowerInnerFwd, y: innerLowerY, z: innerLowerZ },
      uip: { x: i.upperInnerFwd, y: innerUpperY, z: innerUpperZ },
      wc: { x: 0, y: (lowerOuterY + upperOuterY) / 2, z: i.tyreRadius },
    },
    icHeight, rcAxisAngleDeg: deg(rcAxisAngle), icY: i.vsal, rcY: i.track / 2,
    lowerArmAngleDeg: deg(lowerArmAngle), upperArmAngleDeg: deg(upperArmAngle),
    lowerInnerRearX: i.lowerInnerFwd - i.lowerInnerLong,
    upperInnerRearX: i.upperInnerFwd - i.upperInnerLong,
    pushrodLower: { x: 2, y: i.pushrodLowerY, z: i.pushrodLowerZ },
    pushrodUpper: { x: 50, y: i.pushrodUpperY, z: i.pushrodUpperZ },
  };
}

/** Solved metrics from a front-view hardpoint set, for target-vs-achieved. */
export function solvedScrub(lbj: { y: number; z: number }, ubj: { y: number; z: number }): number {
  // Steering axis (lbj→ubj) y-intercept at ground (z=0) = scrub radius.
  if (Math.abs(ubj.z - lbj.z) < 1e-9) return NaN;
  return lbj.y + (ubj.y - lbj.y) * ((0 - lbj.z) / (ubj.z - lbj.z));
}
export function solvedKpiDeg(lbj: { y: number; z: number }, ubj: { y: number; z: number }): number {
  // Matches the workbook's convention (outerY = scrub + tan(KPI)·height), so the
  // generated geometry reports back the KPI target at static.
  return deg(Math.atan((ubj.y - lbj.y) / (ubj.z - lbj.z)));
}
