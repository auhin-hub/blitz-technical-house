/**
 * Suspension geometry — front-view double-wishbone kinematics through travel
 * (MASTER_BUILD_PLAN §6.4, RCVD Ch.17). Planar y–z model (one corner); the
 * external RC-CALCS isn't available, so we reconstruct:
 *
 *   For a heave step we rotate the lower arm about its inner pivot; the upper
 *   ball-joint is the circle–circle intersection of (upper arm about its inner
 *   pivot) and (the rigid upright length about the new lower ball-joint). The
 *   upright is a rigid body, so the same rotation+translation that maps the two
 *   ball-joints maps the wheel centre and contact patch. Then:
 *     IC = intersection of the two extended arm lines
 *     RC = where the line (contact patch → IC) crosses the centreline (y = 0)
 *     camber = upright rotation;  scrub = contact-patch lateral move
 *
 * Full 3D kinematics stays in ADAMS; this is the design-stage estimate.
 * Coordinates: y = lateral (+ outboard), z = vertical (+ up), mm.
 */
import type { Out } from './engine';

export interface Pt { y: number; z: number; }
export interface Hardpoints {
  lip: Pt; uip: Pt;   // lower / upper inner pivots (chassis)
  lbj: Pt; ubj: Pt;   // lower / upper outer ball joints (upright)
  wc: Pt; cp: Pt;     // wheel centre, contact patch
}

const sub = (a: Pt, b: Pt): Pt => ({ y: a.y - b.y, z: a.z - b.z });
const add = (a: Pt, b: Pt): Pt => ({ y: a.y + b.y, z: a.z + b.z });
const len = (a: Pt): number => Math.hypot(a.y, a.z);
const ang = (a: Pt): number => Math.atan2(a.z, a.y);
function rot(v: Pt, t: number): Pt {
  const c = Math.cos(t), s = Math.sin(t);
  return { y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

/** Circle–circle intersections; [] if none. */
function circleIntersect(c1: Pt, r1: number, c2: Pt, r2: number): Pt[] {
  const d = len(sub(c2, c1));
  if (d < 1e-9 || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 < 0) return [];
  const h = Math.sqrt(h2);
  const u = { y: (c2.y - c1.y) / d, z: (c2.z - c1.z) / d };       // unit c1→c2
  const mid = { y: c1.y + a * u.y, z: c1.z + a * u.z };
  const perp = { y: -u.z, z: u.y };
  return [
    { y: mid.y + h * perp.y, z: mid.z + h * perp.z },
    { y: mid.y - h * perp.y, z: mid.z - h * perp.z },
  ];
}

/** Intersection of line p1p2 with line p3p4; null if parallel. */
function lineIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt | null {
  const d = (p1.y - p2.y) * (p3.z - p4.z) - (p1.z - p2.z) * (p3.y - p4.y);
  if (Math.abs(d) < 1e-9) return null;
  const a = p1.y * p2.z - p1.z * p2.y;
  const b = p3.y * p4.z - p3.z * p4.y;
  return {
    y: (a * (p3.y - p4.y) - (p1.y - p2.y) * b) / d,
    z: (a * (p3.z - p4.z) - (p1.z - p2.z) * b) / d,
  };
}

/** RC height (z where the CP→IC line crosses y = 0) for a given corner state. */
function rollCentreHeight(lip: Pt, lbj: Pt, uip: Pt, ubj: Pt, cp: Pt): number {
  const ic = lineIntersect(lip, lbj, uip, ubj);
  if (!ic) {
    // Parallel arms: IC at infinity along the arm direction → RC at CP height level.
    return cp.z;
  }
  // Line CP→IC crossed with the centreline y = 0.
  if (Math.abs(ic.y - cp.y) < 1e-9) return cp.z;
  const t = (0 - cp.y) / (ic.y - cp.y);
  return cp.z + t * (ic.z - cp.z);
}

export interface GeomStep { heave: number; rcHeight: number; camber: number; scrub: number; }

/**
 * Sweep wheel travel from −range to +range (mm). Returns steps sorted by heave,
 * each with RC height, camber change (deg) and scrub (mm) relative to static.
 */
export function geometrySweep(hp: Hardpoints, range = 30, nPerSide = 20): GeomStep[] {
  const upperArmLen = len(sub(hp.ubj, hp.uip));
  const uprightLen = len(sub(hp.ubj, hp.lbj));
  const ubjAng0 = ang(sub(hp.ubj, hp.lbj));
  const lbjRel0 = sub(hp.lbj, hp.lip);         // lower arm vector (for rotation)
  const z0 = hp.wc.z;

  const steps: GeomStep[] = [];
  // Sweep the lower-arm angle; map each to the wheel's vertical travel.
  const dPhi = 0.0025;                          // rad per step
  for (let i = -nPerSide * 4; i <= nPerSide * 4; i++) {
    const phi = i * dPhi;
    const lbj = add(hp.lip, rot(lbjRel0, phi));
    const sols = circleIntersect(hp.uip, upperArmLen, lbj, uprightLen);
    if (!sols.length) continue;
    const ubj = len(sub(sols[0], hp.ubj)) <= len(sub(sols[1] ?? sols[0], hp.ubj)) ? sols[0] : sols[1];
    // Rigid upright transform mapping (lbj0,ubj0) → (lbj,ubj).
    const theta = ang(sub(ubj, lbj)) - ubjAng0;
    const wc = add(lbj, rot(sub(hp.wc, hp.lbj), theta));
    const cp = add(lbj, rot(sub(hp.cp, hp.lbj), theta));
    const heave = wc.z - z0;
    if (heave < -range - 0.5 || heave > range + 0.5) continue;
    steps.push({
      heave,
      rcHeight: rollCentreHeight(hp.lip, lbj, hp.uip, ubj, cp),
      camber: (theta * 180) / Math.PI,         // upright rotation = camber change
      scrub: cp.y - hp.cp.y,
    });
  }
  steps.sort((a, b) => a.heave - b.heave);
  return steps;
}

/** Static RC height directly from the input hardpoints. */
export function staticRcHeight(hp: Hardpoints): number {
  return rollCentreHeight(hp.lip, hp.lbj, hp.uip, hp.ubj, hp.cp);
}

/** Summary metrics for the design-target tracker. */
export function geometrySummary(hp: Hardpoints, range = 30): Out {
  const sweep = geometrySweep(hp, range);
  if (sweep.length < 3) return { staticRc: staticRcHeight(hp), camberGainBump: NaN, rcMigration: NaN };
  const rcs = sweep.map((s) => s.rcHeight);
  const nearest = (h: number) => sweep.reduce((p, c) => Math.abs(c.heave - h) < Math.abs(p.heave - h) ? c : p);
  const at0 = nearest(0), atBump = nearest(10);
  return {
    staticRc: staticRcHeight(hp),
    camberGainBump: Math.abs(atBump.camber - at0.camber), // deg per 10 mm bump
    rcMigration: Math.max(...rcs) - Math.min(...rcs),      // mm over the travel
  };
}

/**
 * Anti-dive / anti-squat (FRS 2.0): % anti = share · tan(θ_svsa) · L / h.
 * θ_svsa = side-view swing-arm angle to ground; share = braking (anti-dive) or
 * drive (anti-squat) force fraction on that axle.
 */
export function antiGeometry(share: number, svsaAngleDeg: number, wheelbase: number, cogHeight: number): number {
  return share * Math.tan((svsaAngleDeg * Math.PI) / 180) * (wheelbase / cogHeight) * 100;
}
