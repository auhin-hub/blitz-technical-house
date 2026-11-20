/**
 * Cockpit Packaging Studio — side-view geometry (pure, unit-tested).
 *
 * Coordinates (mm): x = rearward from the front axle centre, z = up from the
 * ground — the same frame as the aero balance tool. The car faces −x.
 *
 * Two figures are posed in the cockpit:
 *  - Percy, the rulebook's 95th-percentile template, placed exactly as the
 *    selected rulebook describes (rules.ts), and
 *  - each team driver, as the same three-circle figure scaled to their own
 *    measurements, plus two-link legs and arms solved to the pedals and wheel.
 *
 * Drawing drivers as the rulebook's own circles (200 mm hips/shoulders, 300 mm
 * helmet) keeps the head-clearance check identical for Percy and drivers. The
 * body is simplified to that figure + straight segments: it is a packaging aid,
 * not a substitute for a seat fitting with the real driver.
 */
import type { CockpitRules } from './rules';

export interface Pt { x: number; z: number; }

// ---- vector helpers ----------------------------------------------------------
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, z: a.z + b.z });
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, z: a.z - b.z });
export const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, z: a.z * k });
export const dot = (a: Pt, b: Pt): number => a.x * b.x + a.z * b.z;
export const len = (a: Pt): number => Math.hypot(a.x, a.z);
export const dist = (a: Pt, b: Pt): number => len(sub(a, b));
export const unit = (a: Pt): Pt => { const l = len(a); return l > 0 ? mul(a, 1 / l) : { x: 0, z: 0 }; };
const RAD = Math.PI / 180;

/** Interior angle at `b` between b→a and b→c (deg, 0–180). */
export function angleAt(a: Pt, b: Pt, c: Pt): number {
  const u = unit(sub(a, b)), v = unit(sub(c, b));
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) / RAD;
}

/** Perpendicular distance from p to the infinite line through a, b, and
 *  which side: `below` = p is lower than the line at p's x. */
export function lineDistance(p: Pt, a: Pt, b: Pt): { d: number; below: boolean } {
  const ab = sub(b, a);
  const cross = ab.x * (p.z - a.z) - ab.z * (p.x - a.x);
  const d = Math.abs(cross) / len(ab);
  const zLine = ab.x !== 0 ? a.z + (ab.z / ab.x) * (p.x - a.x) : Infinity;
  return { d, below: p.z < zLine };
}

/** Points t along a + t·u at distance r from c (both roots, ascending t). */
function lineCircle(a: Pt, u: Pt, c: Pt, r: number): number[] {
  const w = sub(a, c);
  const B = 2 * dot(u, w);
  const C = dot(w, w) - r * r;
  const disc = B * B - 4 * C;               // u is a unit vector, so A = 1
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  return [(-B - s) / 2, (-B + s) / 2];
}

/**
 * Two-link chain from `root` to `target` (thigh+shank, upper arm+forearm).
 * `bend` picks which of the two joint positions: 'up' (knee) or 'down' (elbow).
 * If the target is out of reach the chain points straight at it and `short`
 * says by how many mm.
 */
export function twoLink(root: Pt, target: Pt, l1: number, l2: number, bend: 'up' | 'down') {
  const d = dist(root, target);
  const dir = unit(sub(target, root));
  if (d >= l1 + l2) {
    const joint = add(root, mul(dir, l1));
    return { joint, end: add(joint, mul(dir, l2)), short: d - (l1 + l2), reached: false };
  }
  if (d <= Math.abs(l1 - l2)) {
    return { joint: add(root, mul(dir, l1)), end: target, short: 0, reached: false };
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const base = add(root, mul(dir, a));
  const perp = { x: -dir.z, z: dir.x };
  const j1 = add(base, mul(perp, h)), j2 = add(base, mul(perp, -h));
  const joint = (bend === 'up') === (j1.z >= j2.z) ? j1 : j2;
  return { joint, end: target, short: 0, reached: true };
}

// ---- the cockpit -------------------------------------------------------------
export interface Cockpit {
  frontHoopTop: Pt;      // top of the front hoop (rear surface)
  mainHoopTop: Pt;       // top of the main hoop (rear surface)
  mainBraceLow: Pt;      // lower end of the main-hoop bracing
  seatJunction: Pt;      // seat back / seat bottom junction (seat surface), seat rearmost
  seatPanDeg: number;    // seat bottom angle above horizontal, rising toward the front
  seatBackDeg: number;   // seat back angle from vertical, leaning rearward
  headRestraint: Pt;     // centre of the head-restraint front face (treated as vertical)
  pedalFace: Pt;         // rearmost actuation face of the pedals, pedals frontmost
  pedalDeg: number;      // foot / pedal-face angle above horizontal
  heel: Pt;              // heel rest point, pedals frontmost
  wheelCentre: Pt;
  wheelDia: number;
  wheelTiltDeg: number;  // wheel plane from vertical, top toward the driver
  shoulderMount: Pt;     // shoulder-harness mount (side view)
  lapMount: Pt;          // lap-belt mount (side view)
  noseTop: Pt;           // top of the nose / front bodywork (sightline obstruction; not a rule point)
}

/** Seat lines as unit vectors: along the pan (forward), its upward normal,
 *  along the back (upward), its forward normal. */
export function seatFrame(c: Cockpit) {
  const p = c.seatPanDeg * RAD, b = c.seatBackDeg * RAD;
  return {
    uPan: { x: -Math.cos(p), z: Math.sin(p) },
    nPan: { x: Math.sin(p), z: Math.cos(p) },
    uBack: { x: Math.sin(b), z: Math.cos(b) },
    nBack: { x: -Math.cos(b), z: Math.sin(b) },
  };
}

/** Centre of a circle of radius r sitting in the seat corner (tangent to pan and back). */
export function cornerCentre(c: Cockpit, r: number): Pt {
  const f = seatFrame(c);
  // J + r·nPan + t·uPan = J + r·nBack + s·uBack  →  t·uPan − s·uBack = r·(nBack − nPan)
  const rhs = mul(sub(f.nBack, f.nPan), r);
  const det = f.uPan.x * -f.uBack.z - -f.uBack.x * f.uPan.z;
  const t = (rhs.x * -f.uBack.z - -f.uBack.x * rhs.z) / det;
  return add(add(c.seatJunction, mul(f.nPan, r)), mul(f.uPan, t));
}

export interface Percy {
  hip: Pt; shoulder: Pt; head: Pt;
  rHip: number; rShoulder: number; rHead: number;
  hipToPedal: number;
  fits: boolean;             // all three placement steps succeeded
  issues: string[];
}

/** Place the 95th-percentile template exactly as the rulebook describes. */
export function placePercy(c: Cockpit, r: CockpitRules): Percy {
  const P = r.percy, f = seatFrame(c), issues: string[] = [];
  const rHip = P.hipDia / 2, rSh = P.shoulderDia / 2, rHead = P.headDia / 2;

  // 1. Lower circle on the seat bottom, centre ≥ minHipToPedal from the pedal face.
  //    Put it at exactly that distance (the rule's defining position) unless that
  //    point is behind the seat back — then the template does not fit.
  const A = add(c.seatJunction, mul(f.nPan, rHip));
  const corner = cornerCentre(c, rHip);
  const tCorner = dot(sub(corner, A), f.uPan);
  const roots = lineCircle(A, f.uPan, c.pedalFace, P.minHipToPedal);
  let t = tCorner;
  if (roots.length) {
    const tRear = roots[0];                       // rear-most point at that distance
    if (tRear >= tCorner) t = tRear;
    else issues.push(`Hip circle can't reach ${P.minHipToPedal} mm from the pedals: only ${dist(corner, c.pedalFace).toFixed(0)} mm with the seat rearmost and pedals forward.`);
  }
  const hip = add(A, mul(f.uPan, t));

  // 2. Middle circle on the seat back, hipToShoulder from the hip centre (upper root).
  const B0 = add(c.seatJunction, mul(f.nBack, rSh));
  const sRoots = lineCircle(B0, f.uBack, hip, P.hipToShoulder);
  let shoulder: Pt;
  if (sRoots.length) shoulder = add(B0, mul(f.uBack, sRoots[1]));
  else { shoulder = add(hip, mul(f.uBack, P.hipToShoulder)); issues.push('Shoulder circle cannot touch the seat back at 490 mm from the hips.'); }

  // 3. Head circle shoulderToHead from the shoulder centre, its back at the
  //    rulebook gap from the head-restraint face.
  const headX = c.headRestraint.x - P.headToRestraint - rHead;
  const dx = headX - shoulder.x;
  let head: Pt;
  if (Math.abs(dx) <= P.shoulderToHead) head = { x: headX, z: shoulder.z + Math.sqrt(P.shoulderToHead ** 2 - dx * dx) };
  else {
    head = add(shoulder, mul(unit(sub(shoulder, hip)), P.shoulderToHead));
    issues.push(`Head circle can't be ${P.headToRestraint} mm from the head restraint — the restraint is out of reach of the 280 mm neck line.`);
  }
  return { hip, shoulder, head, rHip, rShoulder: rSh, rHead, hipToPedal: dist(hip, c.pedalFace), fits: issues.length === 0, issues };
}

// ---- drivers -----------------------------------------------------------------
/** Measurements (mm, kg). Missing values may be estimated from stature (estimate.ts). */
export interface DriverBody {
  stature: number;
  mass: number;
  sittingHeight: number;        // seat surface → top of head, sitting erect
  sittingHelmetHeight: number;  // seat surface → top of helmet, sitting erect
  sittingShoulderHeight: number;// seat surface → acromion (shoulder tip)
  sittingEyeHeight: number;     // seat surface → eye (ISO 7250 style, sitting erect)
  thigh: number;                // greater trochanter → knee joint line
  shank: number;                // knee joint line → lateral malleolus (ankle bone)
  ankleHeight: number;          // floor → lateral malleolus
  footLength: number;
  upperArm: number;             // acromion → elbow (lateral epicondyle)
  forearmGrip: number;          // elbow → centre of the closed fist
}

/** Per-driver adjustments for this car. */
export interface DriverSetup {
  insert: number;        // seat insert thickness, mm (raises and moves the driver forward)
  pedalShift: number;    // pedal box moved rearward from frontmost, mm
  restraintShift: number;// head-restraint pad moved forward, mm
}

export interface DriverPose {
  hip: Pt; shoulder: Pt; head: Pt; knee: Pt; ankle: Pt; heel: Pt; toe: Pt; elbow: Pt; grip: Pt;
  rHip: number; rHead: number;
  legShort: number; armShort: number;  // mm the limb is short of its target (0 = reaches)
  headRestraintGap: number;            // back of helmet → head-restraint face, mm
  neckFlexDeg: number;                 // head rotated forward to clear the restraint
  angles: { hip: number; knee: number; ankle: number; elbow: number };
}

export function poseDriver(c: Cockpit, b: DriverBody, s: DriverSetup): DriverPose {
  const f = seatFrame(c);
  const rHip = 100, rHead = 150;          // the rulebook figure's circles (see header)
  const hip = cornerCentre(c, rHip + s.insert);
  const torso = Math.max(0, b.sittingShoulderHeight - rHip);
  const shoulder = add(hip, mul(f.uBack, torso));
  const neck = Math.max(0, b.sittingHelmetHeight - rHead - b.sittingShoulderHeight);

  // Head along the torso line unless the helmet would go into the restraint —
  // then it tips forward until it just touches.
  const hrX = c.headRestraint.x - s.restraintShift;
  let head = add(shoulder, mul(f.uBack, neck));
  let neckFlexDeg = 0;
  if (head.x + rHead > hrX && neck > 0) {
    const dx = hrX - rHead - shoulder.x;
    if (Math.abs(dx) <= neck) {
      const tipped = { x: hrX - rHead, z: shoulder.z + Math.sqrt(neck * neck - dx * dx) };
      neckFlexDeg = angleAt(head, shoulder, tipped);
      head = tipped;
    }
  }

  // Legs: heel on the heel rest (moved with the pedal box), foot along the pedal angle.
  const a = c.pedalDeg * RAD;
  const heel = { x: c.heel.x + s.pedalShift, z: c.heel.z };
  const toeDir = { x: -Math.cos(a), z: Math.sin(a) };
  const ankle = add(heel, mul({ x: Math.sin(a), z: Math.cos(a) }, b.ankleHeight));
  const toe = add(heel, mul(toeDir, b.footLength));
  const leg = twoLink(hip, ankle, b.thigh, b.shank, 'up');

  // Arms: hands at 9-and-3, which in side view is the wheel centre.
  const grip = c.wheelCentre;
  const arm = twoLink(shoulder, grip, b.upperArm, b.forearmGrip, 'down');

  return {
    hip, shoulder, head, knee: leg.joint, ankle: leg.end, heel, toe, elbow: arm.joint, grip: arm.end,
    rHip, rHead,
    legShort: leg.short, armShort: arm.short,
    headRestraintGap: hrX - (head.x + rHead),
    neckFlexDeg,
    angles: {
      hip: angleAt(shoulder, hip, leg.joint),
      knee: angleAt(hip, leg.joint, leg.end),
      ankle: angleAt(leg.joint, leg.end, add(leg.end, toeDir)),
      elbow: angleAt(shoulder, arm.joint, arm.end),
    },
  };
}

// ---- rule checks ---------------------------------------------------------------
export type Status = 'pass' | 'fail' | 'advisory' | 'info';
export interface Check {
  id: string; label: string; value: number; unit: string;
  limit: string; status: Status; ref: string; note?: string;
}

/** Helmet clearance to the roll-hoop lines for a head circle (Percy or driver). */
export function helmetChecks(c: Cockpit, r: CockpitRules, head: Pt, rHead: number, who: string): Check[] {
  const min = r.helmetClearance.min, ref = r.helmetClearance.ref;
  const out: Check[] = [];
  const h = lineDistance(head, c.frontHoopTop, c.mainHoopTop);
  const clear = h.below ? h.d - rHead : -(h.d + rHead);
  out.push({ id: `${who}-hoopline`, label: `${who}: helmet below main–front hoop line`, value: clear, unit: 'mm',
    limit: `≥ ${min}`, status: clear >= min ? 'pass' : 'fail', ref });
  if (c.mainBraceLow.x > c.mainHoopTop.x) {
    const b = lineDistance(head, c.mainHoopTop, c.mainBraceLow);
    const fwd = head.x < c.mainHoopTop.x + (c.mainBraceLow.x - c.mainHoopTop.x) * ((head.z - c.mainHoopTop.z) / (c.mainBraceLow.z - c.mainHoopTop.z));
    const bc = fwd ? b.d - rHead : -(b.d + rHead);
    out.push({ id: `${who}-braceline`, label: `${who}: helmet inside main hoop–rear brace line`, value: bc, unit: 'mm',
      limit: `≥ ${min}`, status: bc >= min ? 'pass' : 'fail', ref });
  } else {
    const behind = head.x + rHead - c.mainHoopTop.x;
    out.push({ id: `${who}-forwardbrace`, label: `${who}: helmet not behind main hoop (forward bracing)`, value: -behind, unit: 'mm',
      limit: '≥ 0', status: behind <= 0 ? 'pass' : 'fail', ref });
  }
  return out;
}

const deg = (v: Pt) => Math.atan2(v.z, v.x) / RAD;

/**
 * Belt geometry for one body: lap belt mount → hip centre, and shoulder belt
 * from the top of the shoulders rearward to its mount. `upright` comes from the
 * template (the rulebook defines the driving position by Percy's back line).
 */
export function beltChecks(c: Cockpit, r: CockpitRules, hip: Pt, shoulderTop: Pt, upright: boolean, who: string): Check[] {
  const checks: Check[] = [];
  const lap = sub(hip, c.lapMount);
  const lapAngle = Math.abs(Math.atan2(lap.z, Math.abs(lap.x)) / RAD);
  const [lo, hi] = upright ? r.lapBelt.upright : r.lapBelt.reclined;
  checks.push({ id: `${who}-lapbelt`, label: `${who}: lap belt side-view angle (mount → hip)`, value: lapAngle, unit: '°',
    limit: `${lo}–${hi} (${upright ? 'upright' : 'reclined'})`, status: lapAngle >= lo && lapAngle <= hi ? 'pass' : 'fail', ref: r.lapBelt.ref,
    note: 'Measured to the hip-circle centre — check the real belt path on the seat.' });

  // Upright only: where the belt line crosses the seat bottom, forward of the junction ("should").
  const f = seatFrame(c);
  const u = unit(lap);
  const denom = u.x * f.uPan.z - u.z * f.uPan.x;
  if (Math.abs(denom) > 1e-9 && upright) {
    const w = sub(c.seatJunction, c.lapMount);
    const k = (w.x * f.uPan.z - w.z * f.uPan.x) / denom;
    const cross = add(c.lapMount, mul(u, k));
    const fwd = dot(sub(cross, c.seatJunction), f.uPan);
    const [a0, a1] = r.lapBelt.seatBottomFwd;
    checks.push({ id: `${who}-lapbelt-pos`, label: `${who}: lap belt at seat bottom, forward of the back/bottom junction`, value: fwd, unit: 'mm',
      limit: `${a0}–${a1} (should)`, status: fwd >= a0 && fwd <= a1 ? 'pass' : 'advisory', ref: r.lapBelt.ref });
  }

  const sb = sub(c.shoulderMount, shoulderTop);
  const sbAngle = deg(sb);
  const [below, above] = r.shoulderBelt.angle;
  checks.push({ id: `${who}-shoulderbelt`, label: `${who}: shoulder belt, shoulders → mount (+ = above horizontal)`, value: sb.x > 0 ? sbAngle : NaN, unit: '°',
    limit: `${below} to +${above}`, status: sb.x > 0 && sbAngle >= below && sbAngle <= above ? 'pass' : 'fail', ref: r.shoulderBelt.ref,
    note: sb.x > 0 ? `Mounts ${r.shoulderBelt.spacing[0]}–${r.shoulderBelt.spacing[1]} mm apart centre to centre (front view — not checked here).` : 'Mount is not behind the shoulders.' });
  return checks;
}

export interface PercyReport { percy: Percy; upright: boolean; seatBackFromVertical: number; checks: Check[]; }

export function percyChecks(c: Cockpit, r: CockpitRules): PercyReport {
  const p = placePercy(c, r);
  const backLine = sub(p.shoulder, p.hip);
  const fromVertical = Math.abs(Math.atan2(backLine.x, backLine.z) / RAD);
  const upright = fromVertical <= r.uprightMaxFromVertical.deg;
  const checks: Check[] = [];

  checks.push({ id: 'percy-fit', label: 'Percy fits the seat (hip ≥ pedal distance, shoulders on the seat back, head at the restraint)',
    value: p.hipToPedal, unit: 'mm hip→pedal', limit: `≥ ${r.percy.minHipToPedal}`,
    status: p.fits ? 'pass' : 'fail', ref: r.percy.ref, note: p.issues.join(' ') || undefined });
  checks.push(...helmetChecks(c, r, p.head, p.rHead, 'Percy'));
  checks.push({ id: 'position', label: `Driving position (template back line from vertical)`, value: fromVertical, unit: '°',
    limit: `upright ≤ ${r.uprightMaxFromVertical.deg}`, status: 'info', ref: r.uprightMaxFromVertical.ref,
    note: upright ? 'Upright driving position' : 'Reclined driving position' });

  checks.push(...beltChecks(c, r, p.hip, add(p.shoulder, mul(unit(backLine), p.rShoulder)), upright, 'Percy'));

  // Steering wheel vs front hoop.
  const t = c.wheelTiltDeg * RAD, R = c.wheelDia / 2;
  const top = add(c.wheelCentre, { x: R * Math.sin(t), z: R * Math.cos(t) });
  const bot = sub(c.wheelCentre, { x: R * Math.sin(t), z: R * Math.cos(t) });
  const wheelTop = Math.max(top.z, bot.z);
  const gap = Math.min(top.x, bot.x) - c.frontHoopTop.x;
  checks.push({ id: 'fh-height', label: 'Front hoop top above steering-wheel top', value: c.frontHoopTop.z - wheelTop, unit: 'mm',
    limit: '≥ 0', status: c.frontHoopTop.z >= wheelTop ? 'pass' : 'fail', ref: r.steeringToFrontHoop.ref });
  checks.push({ id: 'fh-wheel', label: 'Steering wheel rearward of front hoop (horizontal)', value: gap, unit: 'mm',
    limit: `≤ ${r.steeringToFrontHoop.max}`, status: gap <= r.steeringToFrontHoop.max ? 'pass' : 'fail', ref: r.steeringToFrontHoop.ref });

  return { percy: p, upright, seatBackFromVertical: fromVertical, checks };
}

/** Per-driver rule checks + fit flags. `upright` is the template's driving position. */
export function driverChecks(c: Cockpit, r: CockpitRules, pose: DriverPose, name: string, upright: boolean): Check[] {
  const out = helmetChecks(c, r, pose.head, pose.rHead, name);
  out.push(...beltChecks(c, r, pose.hip, add(pose.shoulder, mul(unit(sub(pose.shoulder, pose.hip)), pose.rHip)), upright, name));
  out.push({ id: `${name}-hr`, label: `${name}: head restraint to back of helmet`, value: pose.headRestraintGap, unit: 'mm',
    limit: `0–${r.headRestraintGap.max}`, status: pose.headRestraintGap >= 0 && pose.headRestraintGap <= r.headRestraintGap.max ? 'pass' : 'fail',
    ref: r.headRestraintGap.ref,
    note: pose.headRestraintGap > r.headRestraintGap.max ? `Move the restraint pad ${(pose.headRestraintGap - r.headRestraintGap.max).toFixed(0)} mm forward for this driver.` : undefined });
  out.push({ id: `${name}-legs`, label: `${name}: reaches the pedals`, value: pose.legShort, unit: 'mm short',
    limit: '0', status: pose.legShort <= 0 ? 'pass' : 'fail', ref: 'V.2.1 accommodation',
    note: pose.legShort > 0 ? `Move the pedal box ${pose.legShort.toFixed(0)} mm rearward or add seat insert.` : undefined });
  out.push({ id: `${name}-arms`, label: `${name}: reaches the wheel (9 and 3)`, value: pose.armShort, unit: 'mm short',
    limit: '0', status: pose.armShort <= 0 ? 'pass' : 'fail', ref: 'V.2.1 accommodation' });
  return out;
}
