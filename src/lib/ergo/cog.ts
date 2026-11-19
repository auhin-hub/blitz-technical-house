/**
 * Posed-driver centre of gravity (side view) from segment masses and segment
 * centre-of-mass positions. Pure, unit-tested.
 *
 * Source: Dempster's segment parameters as tabulated in Winter, "Biomechanics and
 * Motor Control of Human Movement" (Table 4.1). Mass fractions are of TOTAL body
 * mass for ONE segment; centre-of-mass positions are fractions of segment length
 * measured from the PROXIMAL end. Arms and legs are doubled (side view: both sides
 * project onto the same line), so the fractions sum to 1.
 *
 * THIS IS AN ESTIMATE: population-average parameters applied to one posed body,
 * and the posed body itself is the studio's simplified stick figure. The roster's
 * "mass in race gear" (suit, boots, helmet) is spread with the same fractions.
 */
import type { Pt, DriverPose } from './geometry';
import { add, mul, sub, unit, dist } from './geometry';

export const DEMPSTER_SOURCE = 'Dempster segment parameters, Winter — Biomechanics and Motor Control of Human Movement, Table 4.1 (estimate)';

/** Mass fraction (one segment) and CoM fraction from the proximal end. */
export const SEGMENT_PARAMS = {
  hand:     { mass: 0.006,  com: 0.506 },
  forearm:  { mass: 0.016,  com: 0.430 },
  upperArm: { mass: 0.028,  com: 0.436 },
  foot:     { mass: 0.0145, com: 0.50 },
  leg:      { mass: 0.0465, com: 0.433 },   // shank
  thigh:    { mass: 0.100,  com: 0.433 },
  headNeck: { mass: 0.081,  com: 0 },       // CoM taken at the head-circle centre
  trunk:    { mass: 0.497,  com: 0.50 },    // hip → shoulder
} as const;

/** How many times each segment counts (arms and legs: left + right). */
export const SEGMENT_COUNT = { hand: 2, forearm: 2, upperArm: 2, foot: 2, leg: 2, thigh: 2, headNeck: 1, trunk: 1 } as const;

/** Hand length as a fraction of stature, Drillis & Contini (0.108 — see estimate.ts). */
export const HAND_FRACTION_OF_STATURE = 0.108;

export interface CogSegment { name: string; mass: number; com: Pt; }
export interface DriverCog { mass: number; cog: Pt; segments: CogSegment[]; }

/** Point a fraction f of the way from `a` (proximal) to `b` (distal). */
const along = (a: Pt, b: Pt, f: number): Pt => add(a, mul(sub(b, a), f));

/**
 * @param pose        posed driver (geometry.ts poseDriver)
 * @param totalMass   kg, mass in race gear
 * @param handLength  mm; the grip point is the fist centre, half a hand past the wrist
 */
export function driverCog(pose: DriverPose, totalMass: number, handLength: number): DriverCog {
  const p = SEGMENT_PARAMS, n = SEGMENT_COUNT;
  // Wrist: back from the fist centre by half a hand, along elbow → grip (never past the elbow).
  const forearmGrip = dist(pose.elbow, pose.grip);
  const back = Math.min(Math.max(0, handLength) / 2, forearmGrip);
  const wrist = sub(pose.grip, mul(unit(sub(pose.grip, pose.elbow)), back));
  const handEnd = add(pose.grip, mul(unit(sub(pose.grip, pose.elbow)), back)); // fingertips = grip + half hand

  const seg = (name: string, key: keyof typeof SEGMENT_PARAMS, com: Pt): CogSegment =>
    ({ name, mass: totalMass * p[key].mass * n[key], com });

  const segments: CogSegment[] = [
    seg('trunk', 'trunk', along(pose.hip, pose.shoulder, p.trunk.com)),
    seg('head + neck', 'headNeck', pose.head),
    seg('thighs', 'thigh', along(pose.hip, pose.knee, p.thigh.com)),
    seg('lower legs', 'leg', along(pose.knee, pose.ankle, p.leg.com)),
    seg('feet', 'foot', along(pose.ankle, pose.toe, p.foot.com)),
    seg('upper arms', 'upperArm', along(pose.shoulder, pose.elbow, p.upperArm.com)),
    seg('forearms', 'forearm', along(pose.elbow, wrist, p.forearm.com)),
    seg('hands', 'hand', along(wrist, handEnd, p.hand.com)),
  ];
  const mass = segments.reduce((s, q) => s + q.mass, 0);
  const cog = mass > 0
    ? { x: segments.reduce((s, q) => s + q.mass * q.com.x, 0) / mass, z: segments.reduce((s, q) => s + q.mass * q.com.z, 0) / mass }
    : { x: NaN, z: NaN };
  return { mass, cog, segments };
}
