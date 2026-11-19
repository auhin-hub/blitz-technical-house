/**
 * STL → side-view silhouette. Reads binary or ASCII STL in the browser (the
 * file is never uploaded) and projects every triangle onto the car's side
 * plane, in the studio's frame: x rearward from the front axle, z up (mm).
 *
 * Side-view projection shows the envelope of the whole model, not a section —
 * good for seeing hoops, bulkheads and the seat around the driver.
 */

export type Axis = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

export interface StlMapping {
  forward: Axis;       // CAD axis pointing to the FRONT of the car
  up: Axis;            // CAD axis pointing UP
  scale: number;       // CAD units → mm (mm 1, m 1000, inch 25.4)
  frontAxle: number;   // front-axle centre, along the forward axis, in CAD units
  ground: number;      // ground plane, along the up axis, in CAD units
}

/** Flat array of triangle vertices: x,y,z × 3 per triangle. */
export function parseStl(buf: ArrayBuffer): Float32Array {
  const dv = new DataView(buf);
  if (buf.byteLength >= 84) {
    const n = dv.getUint32(80, true);
    if (84 + n * 50 === buf.byteLength) {
      const out = new Float32Array(n * 9);
      for (let i = 0; i < n; i++) {
        const o = 84 + i * 50 + 12;                      // skip the normal
        for (let k = 0; k < 9; k++) out[i * 9 + k] = dv.getFloat32(o + k * 4, true);
      }
      return out;
    }
  }
  const text = new TextDecoder().decode(buf);
  const nums: number[] = [];
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) nums.push(+m[1], +m[2], +m[3]);
  if (!nums.length || nums.length % 9 !== 0) throw new Error('Not a readable STL file (binary or ASCII).');
  return new Float32Array(nums);
}

const IDX: Record<string, number> = { x: 0, y: 1, z: 2 };
const comp = (a: Axis) => ({ i: IDX[a[1]], s: a[0] === '-' ? -1 : 1 });

/** Project to studio 2D: [x0,z0,x1,z1,x2,z2] per triangle (mm). */
export function projectStl(v: Float32Array, m: StlMapping): Float32Array {
  const f = comp(m.forward), u = comp(m.up);
  if (f.i === u.i) throw new Error('Forward and up must be different axes.');
  const n = v.length / 3;
  const out = new Float32Array(n * 2);
  for (let p = 0; p < n; p++) {
    const fwd = f.s * v[p * 3 + f.i], up = u.s * v[p * 3 + u.i];
    // (+ 0 turns −0 into 0 so readouts never show "-0")
    out[p * 2] = -(fwd - f.s * m.frontAxle) * m.scale + 0;   // rearward of the front axle
    out[p * 2 + 1] = (up - u.s * m.ground) * m.scale + 0;    // above the ground
  }
  return out;
}

export function bounds2d(p: Float32Array) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    if (p[i] < minX) minX = p[i]; if (p[i] > maxX) maxX = p[i];
    if (p[i + 1] < minZ) minZ = p[i + 1]; if (p[i + 1] > maxZ) maxZ = p[i + 1];
  }
  return { minX, maxX, minZ, maxZ };
}
