/**
 * Cockpit Packaging Studio — geometry, rules data, estimates, STL and DXF.
 * Geometry is tested by the constraints it must satisfy (link lengths,
 * tangencies, rule distances), not by restating the formulas.
 */
import { describe, it, expect } from 'vitest';
import {
  twoLink, cornerCentre, seatFrame, placePercy, percyChecks, poseDriver, driverChecks,
  helmetChecks, lineDistance, angleAt, dist, sub, dot, type Cockpit,
} from './geometry';
import { RULES, RULE_IDS } from './rules';
import { EXAMPLE_COCKPIT as C } from './defaults';
import { completeBody, estimateFromStature } from './estimate';
import { parseStl, projectStl, bounds2d } from './stl';
import { toDxf } from './dxf';

/** Signed distance from p to the line through a with direction u (unit). */
const offset = (p: { x: number; z: number }, a: { x: number; z: number }, n: { x: number; z: number }) => dot(sub(p, a), n);

describe('two-link chain', () => {
  const root = { x: 0, z: 0 }, target = { x: -600, z: -200 };
  it('keeps both link lengths and bends the knee up / elbow down', () => {
    const up = twoLink(root, target, 450, 420, 'up');
    const down = twoLink(root, target, 450, 420, 'down');
    expect(dist(root, up.joint)).toBeCloseTo(450, 9);
    expect(dist(up.joint, target)).toBeCloseTo(420, 9);
    expect(up.joint.z).toBeGreaterThan(down.joint.z);
    expect(up.reached).toBe(true);
  });
  it('out of reach → straight at the target, says how short', () => {
    const r = twoLink(root, { x: -1000, z: 0 }, 450, 420, 'up');
    expect(r.short).toBeCloseTo(130, 9);
    expect(r.reached).toBe(false);
  });
});

describe('seat corner and Percy placement (FSAE example cockpit)', () => {
  const f = seatFrame(C);
  it('corner circle is tangent to both the seat bottom and back', () => {
    const c = cornerCentre(C, 100);
    expect(offset(c, C.seatJunction, f.nPan)).toBeCloseTo(100, 9);
    expect(offset(c, C.seatJunction, f.nBack)).toBeCloseTo(100, 9);
  });
  const p = placePercy(C, RULES.fsae);
  it('fits, with every template dimension and rule distance exact', () => {
    expect(p.fits).toBe(true);
    expect(dist(p.hip, C.pedalFace)).toBeCloseTo(915, 6);                  // hip ≥ 915 from the pedals
    expect(offset(p.hip, C.seatJunction, f.nPan)).toBeCloseTo(100, 6);     // sitting on the seat bottom
    expect(dist(p.hip, p.shoulder)).toBeCloseTo(490, 6);
    expect(offset(p.shoulder, C.seatJunction, f.nBack)).toBeCloseTo(100, 6); // on the seat back
    expect(dist(p.shoulder, p.head)).toBeCloseTo(280, 6);
    expect(C.headRestraint.x - (p.head.x + 150)).toBeCloseTo(25, 6);        // 25 mm from the restraint
  });
  it('pedals too close for 915 mm → does not fit, and says why', () => {
    const tight: Cockpit = { ...C, pedalFace: { x: 400, z: 260 } };
    const q = placePercy(tight, RULES.fsae);
    expect(q.fits).toBe(false);
    expect(q.issues[0]).toMatch(/915/);
  });
  it('the example layout passes every Percy check', () => {
    const r = percyChecks(C, RULES.fsae);
    expect(r.checks.filter((c) => c.status === 'fail')).toEqual([]);
    expect(r.upright).toBe(false);                                         // a reclined example
  });
});

describe('helmet clearance', () => {
  const flat: Cockpit = { ...C, frontHoopTop: { x: 500, z: 1000 }, mainHoopTop: { x: 1600, z: 1000 }, mainBraceLow: { x: 2100, z: 300 } };
  it('horizontal hoop line 300 mm above the helmet centre → 150 mm clearance', () => {
    const c = helmetChecks(flat, RULES.fsae, { x: 1200, z: 700 }, 150, 'X')[0];
    expect(c.value).toBeCloseTo(150, 9);
    expect(c.status).toBe('pass');
  });
  it('just under 50 mm fails for every rulebook (FS China 2026 is 50 mm, not the old 2 in)', () => {
    for (const id of RULE_IDS) {
      expect(helmetChecks(flat, RULES[id], { x: 1200, z: 1000 - 150 - 49.5 }, 150, 'X')[0].status).toBe('fail');
    }
  });
  it('line distance + side', () => {
    const l = lineDistance({ x: 0, z: 0 }, { x: -1, z: 1 }, { x: 1, z: 1 });
    expect(l.d).toBeCloseTo(1, 12);
    expect(l.below).toBe(true);
  });
});

describe('drivers', () => {
  const { body } = completeBody({ stature: 1750, mass: 72 });
  const pose = poseDriver(C, body, { insert: 0, pedalShift: 0, restraintShift: 0 });
  it('limbs keep their measured lengths when they reach', () => {
    expect(pose.legShort).toBe(0);
    expect(dist(pose.hip, pose.knee)).toBeCloseTo(body.thigh, 6);
    expect(dist(pose.knee, pose.ankle)).toBeCloseTo(body.shank, 6);
    expect(dist(pose.shoulder, pose.elbow)).toBeCloseTo(body.upperArm, 6);
  });
  it('helmet never pushes into the head restraint', () => {
    expect(pose.headRestraintGap).toBeGreaterThanOrEqual(-1e-9);
  });
  it('seat insert moves the hip off the seat by its thickness', () => {
    const p2 = poseDriver(C, body, { insert: 40, pedalShift: 0, restraintShift: 0 });
    expect(offset(p2.hip, C.seatJunction, seatFrame(C).nPan)).toBeCloseTo(140, 6);
  });
  it('per-driver checks include helmet, belts, restraint, reach', () => {
    const ids = driverChecks(C, RULES.fsae, pose, 'D', false).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['D-hoopline', 'D-lapbelt', 'D-shoulderbelt', 'D-hr', 'D-legs', 'D-arms']));
  });
  it('angleAt is the interior angle', () => {
    expect(angleAt({ x: 1, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 1 })).toBeCloseTo(90, 9);
  });
});

describe('rules data', () => {
  it('all four competitions carry the template and the cited values', () => {
    for (const id of RULE_IDS) {
      const r = RULES[id];
      expect([r.percy.hipDia, r.percy.headDia, r.percy.hipToShoulder, r.percy.shoulderToHead, r.percy.minHipToPedal]).toEqual([200, 300, 490, 280, 915]);
    }
    expect(RULES.fsae.shoulderBelt.spacing).toEqual([175, 235]);
    expect(RULES.fsuk.shoulderBelt.spacing).toEqual([180, 230]);   // FS Rules 2026 T 5.5
    expect(RULES.fsc.helmetClearance.min).toBe(50);               // FSC 2026 T 4.10
    expect(RULES.fsc.percy.headToRestraint).toBe(25.4);           // FSC 2026 T 4.10.6
  });
  it('only the FSAE 2026-vs-2027 base for Japan is still flagged', () => {
    expect(RULES.fsj.unverified.length).toBe(1);
    for (const id of ['fsae', 'fsuk', 'fsc'] as const) expect(RULES[id].unverified).toEqual([]);
  });
});

describe('measurement estimates', () => {
  it('measured values win; missing ones come from stature and are listed', () => {
    const { body, estimated } = completeBody({ stature: 1800, thigh: 470 });
    expect(body.thigh).toBe(470);
    expect(body.shank).toBeCloseTo(0.246 * 1800, 9);
    expect(estimated).toContain('shank');
    expect(estimated).not.toContain('thigh');
  });
  it('no stature → nothing invented', () => {
    expect(estimateFromStature(0)).toEqual({});
    expect(completeBody({}).body.thigh).toBeNaN();
  });
});

describe('STL', () => {
  const tri = [0, 0, 0, 1000, 0, 0, 0, 0, 500];                     // one triangle, CAD units (mm)
  function binary(v: number[]): ArrayBuffer {
    const buf = new ArrayBuffer(84 + 50);
    const dv = new DataView(buf);
    dv.setUint32(80, 1, true);
    v.forEach((x, k) => dv.setFloat32(84 + 12 + k * 4, x, true));
    return buf;
  }
  it('reads binary and ASCII to the same vertices', () => {
    const ascii = `solid t\nfacet normal 0 0 0\nouter loop\nvertex 0 0 0\nvertex 1000 0 0\nvertex 0 0 500\nendloop\nendfacet\nendsolid t\n`;
    expect(Array.from(parseStl(binary(tri)))).toEqual(tri);
    expect(Array.from(parseStl(new TextEncoder().encode(ascii).buffer as ArrayBuffer))).toEqual(tri);
  });
  it('maps CAD axes to rearward-x / up-z with the front-axle and ground offsets', () => {
    // CAD: +X points to the FRONT, +Z up, front axle at X = 1000, ground at Z = 0.
    const p = projectStl(new Float32Array(tri), { forward: '+x', up: '+z', scale: 1, frontAxle: 1000, ground: 0 });
    [1000, 0, 0, 0, 1000, 500].forEach((v, i) => expect(p[i]).toBeCloseTo(v, 9));   // (−0 vs +0 safe)
    const b = bounds2d(p);
    expect([b.minX, b.maxX, b.minZ, b.maxZ]).toEqual([0, 1000, 0, 500]);
  });
  it('metres scale to mm', () => {
    const p = projectStl(new Float32Array([0, 0, 0.5, 0, 0, 0, 0, 0, 0]), { forward: '-x', up: '+z', scale: 1000, frontAxle: 0, ground: 0 });
    expect(p[1]).toBeCloseTo(500, 9);
  });
  it('rejects junk', () => {
    expect(() => parseStl(new TextEncoder().encode('hello').buffer as ArrayBuffer)).toThrow();
  });
});

describe('DXF', () => {
  it('writes LINE and CIRCLE on layers and skips non-finite geometry', () => {
    const s = toDxf([
      { kind: 'line', layer: 'chassis', a: { x: 0, z: 0 }, b: { x: 100, z: 50 } },
      { kind: 'circle', layer: 'Percy head', c: { x: 10, z: 20 }, r: 150 },
      { kind: 'circle', layer: 'bad', c: { x: NaN, z: 0 }, r: 1 },
    ]);
    expect(s).toContain('LINE\r\n8\r\nCHASSIS');
    expect(s).toContain('CIRCLE\r\n8\r\nPERCY_HEAD');
    expect(s).not.toContain('BAD');
    expect(s.trim().endsWith('EOF')).toBe(true);
  });
});

// ---- driver CoG (Dempster / Winter Table 4.1) -------------------------------------------
import { driverCog, SEGMENT_PARAMS, SEGMENT_COUNT } from './cog';
import { eyePoint, wheelTopPoint, sightline, EYE_FORWARD_OF_HEAD_CENTRE_MM } from './sightline';

describe('driver centre of gravity', () => {
  const { body } = completeBody({ stature: 1780, mass: 78 });
  const pose = poseDriver(C, body, { insert: 0, pedalShift: 0, restraintShift: 0 });
  const r = driverCog(pose, 78, 0.108 * 1780);

  it('segment fractions (arms and legs doubled) sum to exactly 1', () => {
    const k = Object.keys(SEGMENT_PARAMS) as (keyof typeof SEGMENT_PARAMS)[];
    expect(k.reduce((s, q) => s + SEGMENT_PARAMS[q].mass * SEGMENT_COUNT[q], 0)).toBeCloseTo(1, 12);
    expect(r.mass).toBeCloseTo(78, 9);
  });
  it('is the mass-weighted mean of the segment centres', () => {
    const x = r.segments.reduce((s, q) => s + q.mass * q.com.x, 0) / 78;
    const z = r.segments.reduce((s, q) => s + q.mass * q.com.z, 0) / 78;
    expect(r.cog.x).toBeCloseTo(x, 9); expect(r.cog.z).toBeCloseTo(z, 9);
  });
  it('lies inside the bounding box of the posed body', () => {
    const pts = [pose.hip, pose.shoulder, pose.head, pose.knee, pose.ankle, pose.toe, pose.heel, pose.elbow, pose.grip];
    const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
    expect(r.cog.x).toBeGreaterThanOrEqual(Math.min(...xs)); expect(r.cog.x).toBeLessThanOrEqual(Math.max(...xs));
    expect(r.cog.z).toBeGreaterThanOrEqual(Math.min(...zs)); expect(r.cog.z).toBeLessThanOrEqual(Math.max(...zs));
  });
  it('hand-computed: trunk-only geometry puts the CoG on the trunk centre line', () => {
    // Collapse every limb onto the hip and the head onto the shoulder: only the trunk (0.497, mid-point)
    // and the lumped rest move the CoG. All points then lie on one vertical line → x constant, z hand-computed.
    const p = { ...pose, hip: { x: 500, z: 100 }, shoulder: { x: 500, z: 600 }, head: { x: 500, z: 600 },
      knee: { x: 500, z: 100 }, ankle: { x: 500, z: 100 }, toe: { x: 500, z: 100 }, heel: { x: 500, z: 100 },
      elbow: { x: 500, z: 600 }, grip: { x: 500, z: 600 } };
    const q = driverCog(p, 100, 0);
    // legs (0.322) at z=100; trunk 0.497 at 350; head+arms (0.081+0.1) at 600
    expect(q.cog.x).toBeCloseTo(500, 9);
    expect(q.cog.z).toBeCloseTo(0.322 * 100 + 0.497 * 350 + 0.181 * 600, 9);
  });
  it('mirroring the posed body mirrors the CoG x and keeps z (symmetric case)', () => {
    const m = (v: { x: number; z: number }) => ({ x: -v.x, z: v.z });
    const mp = { ...pose, hip: m(pose.hip), shoulder: m(pose.shoulder), head: m(pose.head), knee: m(pose.knee), ankle: m(pose.ankle),
      toe: m(pose.toe), heel: m(pose.heel), elbow: m(pose.elbow), grip: m(pose.grip) };
    const q = driverCog(mp, 78, 0.108 * 1780);
    expect(q.cog.x).toBeCloseTo(-r.cog.x, 9); expect(q.cog.z).toBeCloseTo(r.cog.z, 9);
  });
  it('scales with mass but the position does not move', () => {
    const q = driverCog(pose, 55, 0.108 * 1780);
    expect(q.mass).toBeCloseTo(55, 9); expect(q.cog.x).toBeCloseTo(r.cog.x, 9); expect(q.cog.z).toBeCloseTo(r.cog.z, 9);
  });
});

describe('sitting eye height estimate and eye point', () => {
  it('estimate = sitting height − 0.064·stature; tracks a measured sitting height', () => {
    expect(estimateFromStature(1800).sittingEyeHeight).toBeCloseTo(0.52 * 1800 - 0.064 * 1800, 9);
    const c1 = completeBody({ stature: 1800, sittingHeight: 950 });
    expect(c1.body.sittingEyeHeight).toBeCloseTo(950 - 0.064 * 1800, 9);
    expect(c1.estimated).toContain('sittingEyeHeight');
    const c2 = completeBody({ stature: 1800, sittingEyeHeight: 800 });
    expect(c2.body.sittingEyeHeight).toBe(800); expect(c2.estimated).not.toContain('sittingEyeHeight');
  });
  const { body } = completeBody({ stature: 1780, mass: 75 });
  const pose = poseDriver(C, body, { insert: 0, pedalShift: 0, restraintShift: 0 });
  const eye = eyePoint(pose, body);
  it('sits on the neck line at (eye − shoulder height) from the shoulder, shifted forward by the named constant', () => {
    const back = { x: eye.x + EYE_FORWARD_OF_HEAD_CENTRE_MM, z: eye.z };
    expect(dist(back, pose.shoulder)).toBeCloseTo(body.sittingEyeHeight - body.sittingShoulderHeight, 6);
    // …and on the same line as shoulder → head
    const u = sub(pose.head, pose.shoulder), w = sub(back, pose.shoulder);
    expect(u.x * w.z - u.z * w.x).toBeCloseTo(0, 6);
  });
  it('is above the shoulder and below the top of the helmet', () => {
    expect(eye.z).toBeGreaterThan(pose.shoulder.z);
    expect(eye.z).toBeLessThan(pose.head.z + pose.rHead);
  });
  it('a taller seated eye height raises the eye', () => {
    const hi = eyePoint(pose, { ...body, sittingEyeHeight: body.sittingEyeHeight + 30 });
    expect(hi.z).toBeGreaterThan(eye.z);
  });
});

describe('sightline', () => {
  const eye = { x: 1000, z: 800 };
  it('hand-computed: the front hoop (shallowest clearing slope) blocks; ground hit at 3000 mm ahead', () => {
    const s = sightline(eye, [
      { name: 'wheel', pt: { x: 800, z: 700 } },       // slope −100/200 = −0.5
      { name: 'hoop', pt: { x: 650, z: 730 } },        // −70/350  = −0.2
      { name: 'nose', pt: { x: 250, z: 380 } },        // −420/750 = −0.56
    ]);
    expect(s.blocker?.name).toBe('hoop');
    expect(s.groundForwardOfAxle).toBeCloseTo(800 / 0.2 - 1000, 9);  // 3000
    expect(s.dropDeg).toBeCloseTo(Math.atan(0.2) * 180 / Math.PI, 9);
  });
  it('the line clears every obstruction and touches the blocker', () => {
    const obs = [{ name: 'a', pt: { x: 700, z: 650 } }, { name: 'b', pt: { x: 100, z: 300 } }, { name: 'c', pt: { x: 400, z: 720 } }];
    const s = sightline(eye, obs);
    const zAt = (x: number) => eye.z - (eye.x - x) * Math.tan(s.dropDeg * Math.PI / 180);
    for (const o of obs) expect(zAt(o.pt.x)).toBeGreaterThanOrEqual(o.pt.z - 1e-9);
    expect(zAt(s.blocker!.pt.x)).toBeCloseTo(s.blocker!.pt.z, 9);
    expect(s.groundPoint!.z).toBe(0);
    expect(zAt(s.groundPoint!.x)).toBeCloseTo(0, 6);
  });
  it('ignores obstructions at or behind the eye; none ahead → no blocker', () => {
    const s = sightline(eye, [{ name: 'behind', pt: { x: 1200, z: 2000 } }]);
    expect(s.blocker).toBeNull(); expect(s.ignored).toEqual(['behind']); expect(s.groundForwardOfAxle).toBeNull();
  });
  it('a line that rises never meets the ground', () => {
    const s = sightline(eye, [{ name: 'high', pt: { x: 500, z: 1000 } }]);
    expect(s.dropDeg).toBeLessThan(0); expect(s.groundForwardOfAxle).toBeNull();
  });
  it('wheel top is the higher rim end, toward the driver when tilted that way', () => {
    const t = wheelTopPoint(C);
    expect(t.z).toBeCloseTo(C.wheelCentre.z + (C.wheelDia / 2) * Math.cos(C.wheelTiltDeg * Math.PI / 180), 9);
    expect(t.x).toBeGreaterThan(C.wheelCentre.x);
  });
  it('the example cockpit has a nose point ahead of the front hoop and below its top', () => {
    expect(C.noseTop.x).toBeLessThan(C.frontHoopTop.x); expect(C.noseTop.z).toBeLessThan(C.frontHoopTop.z);
  });
});
