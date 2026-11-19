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
