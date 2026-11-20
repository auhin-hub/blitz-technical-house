/**
 * Driver eye point and side-view sightline over the nose / wheel / front hoop.
 * Pure, unit-tested. INFORMATION ONLY: the FSAE / FS rulebooks contain no
 * side-view visibility requirement, so nothing here is a pass/fail rule.
 *
 * Coordinates as geometry.ts: x rearward from the front axle (the car faces −x),
 * z up from the ground, mm.
 */
import type { Cockpit, DriverBody, DriverPose, Pt } from './geometry';
import { add, mul, sub, unit } from './geometry';

/**
 * APPROXIMATION (not from a source): how far in front of the helmet-circle centre
 * the eye sits, mm. A helmet is ~300 mm in the rulebook template; the eyes are
 * roughly a quarter of that ahead of its centre. Replace with a measured value
 * if you have one.
 */
export const EYE_FORWARD_OF_HEAD_CENTRE_MM = 80;

/**
 * Eye point construction. The pose places the head centre along the neck line
 * from the shoulder (tipped forward if the helmet meets the restraint), and
 * sitting heights are measured along that same seat-referenced line. So:
 *   1. axis  = unit(head − shoulder)   (the posed neck/head line; torso line if the neck length is 0)
 *   2. the shoulder sits at sittingShoulderHeight, so the eye, at sittingEyeHeight
 *      (seat to eye), is  (sittingEyeHeight − sittingShoulderHeight)  along that axis;
 *   3. x is then moved EYE_FORWARD_OF_HEAD_CENTRE_MM toward the front (−x).
 */
export function eyePoint(pose: DriverPose, body: Pick<DriverBody, 'sittingEyeHeight' | 'sittingShoulderHeight'>): Pt {
  let axis = unit(sub(pose.head, pose.shoulder));
  if (axis.x === 0 && axis.z === 0) axis = unit(sub(pose.shoulder, pose.hip));
  const onAxis = add(pose.shoulder, mul(axis, body.sittingEyeHeight - body.sittingShoulderHeight));
  return { x: onAxis.x - EYE_FORWARD_OF_HEAD_CENTRE_MM, z: onAxis.z };
}

/** Top end of the (tilted) steering-wheel rim in side view. */
export function wheelTopPoint(c: Cockpit): Pt {
  const t = (c.wheelTiltDeg * Math.PI) / 180, R = c.wheelDia / 2;
  const w = { x: R * Math.sin(t), z: R * Math.cos(t) };
  const a = add(c.wheelCentre, w), b = sub(c.wheelCentre, w);
  return a.z >= b.z ? a : b;
}

export interface Obstruction { name: string; pt: Pt; }

export interface Sightline {
  /** The obstruction that sets the shallowest clear line (null if none is ahead of the eye). */
  blocker: Obstruction | null;
  /** Line direction, degrees below horizontal (negative = rising). */
  dropDeg: number;
  /** Where the line meets the ground, mm forward of the front axle (null if it never does). */
  groundForwardOfAxle: number | null;
  /** The sightline's ground point (x, z = 0), when it exists. */
  groundPoint: Pt | null;
  /** Each obstruction ahead of the eye with the line slope that just clears it (rise per mm forward). */
  slopes: { name: string; slope: number }[];
  /** Obstructions at or behind the eye (ignored). */
  ignored: string[];
}

/**
 * The line from `eye` that just clears every obstruction ahead of it: the one with
 * the greatest rise-per-mm-forward sets it. Meets the ground ahead only if that
 * line points downward.
 */
export function sightline(eye: Pt, obstructions: Obstruction[]): Sightline {
  const slopes: { name: string; slope: number }[] = [];
  const ignored: string[] = [];
  let blocker: Obstruction | null = null, best = -Infinity;
  for (const o of obstructions) {
    const fwd = eye.x - o.pt.x;                 // forward = toward −x
    if (!(fwd > 0)) { ignored.push(o.name); continue; }
    const s = (o.pt.z - eye.z) / fwd;
    slopes.push({ name: o.name, slope: s });
    if (s > best) { best = s; blocker = o; }
  }
  if (!blocker) return { blocker: null, dropDeg: NaN, groundForwardOfAxle: null, groundPoint: null, slopes, ignored };
  const dropDeg = -Math.atan(best) * 180 / Math.PI;
  if (best >= 0 || !(eye.z > 0)) return { blocker, dropDeg, groundForwardOfAxle: null, groundPoint: null, slopes, ignored };
  const d = eye.z / -best;                      // forward distance to z = 0
  const gx = eye.x - d;
  return { blocker, dropDeg, groundForwardOfAxle: -gx, groundPoint: { x: gx, z: 0 }, slopes, ignored };
}
