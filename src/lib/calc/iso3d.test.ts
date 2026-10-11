/** Orthographic hardpoint projection (feature review Tier 4 #11). */
import { it, expect } from 'vitest';
import { project, fitView, toScreen, wheelRing, VIEWS } from './iso3d';

it('front view: x runs right, z runs up the screen, y is depth', () => {
  const p = project({ x: 100, y: 620, z: 135 }, VIEWS.front);
  expect(p.u).toBeCloseTo(100, 9);
  expect(p.v).toBeCloseTo(-135, 9);      // SVG y is down, so up is negative
  expect(p.depth).toBeCloseTo(620, 9);
});

it('side view (yaw 90): the lateral axis takes over the screen horizontal', () => {
  const p = project({ x: 100, y: 620, z: 135 }, VIEWS.side);
  expect(p.u).toBeCloseTo(620, 6);
  expect(p.v).toBeCloseTo(-135, 6);
  expect(p.depth).toBeCloseTo(-100, 6);  // fore/aft becomes depth
});

it('looking straight down: the ground plane fills the screen, height becomes depth', () => {
  const p = project({ x: 100, y: 620, z: 135 }, { yaw: 0, pitch: 90 });
  expect(p.u).toBeCloseTo(100, 9);
  expect(p.v).toBeCloseTo(620, 9);       // +y draws downward when looking down
  expect(p.depth).toBeCloseTo(135, 9);
  // The preset stops just short of 90 deliberately: at exactly 90 the yaw axis
  // and the view axis coincide and rotating the model stops doing anything.
  expect(VIEWS.top.pitch).toBeLessThan(90);
  expect(VIEWS.top.pitch).toBeGreaterThan(89);
  const q = project({ x: 100, y: 620, z: 135 }, VIEWS.top);
  expect(q.v).toBeCloseTo(620, 0);
});

it('zoom scales the screen axes but not the depth order', () => {
  const a = project({ x: 10, y: 20, z: 30 }, { yaw: 35, pitch: 22, zoom: 1 });
  const b = project({ x: 10, y: 20, z: 30 }, { yaw: 35, pitch: 22, zoom: 3 });
  expect(b.u).toBeCloseTo(a.u * 3, 9);
  expect(b.v).toBeCloseTo(a.v * 3, 9);
  expect(b.depth).toBeCloseTo(a.depth, 9);
});

it('rotation is rigid: distances survive any camera', () => {
  const a = { x: 5, y: 620, z: 135 }, b = { x: -5, y: 560, z: 365 };
  const d3 = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  for (const cam of [VIEWS.front, VIEWS.side, VIEWS.iso, { yaw: 123, pitch: -47 }]) {
    const pa = project(a, cam), pb = project(b, cam);
    const d = Math.hypot(pa.u - pb.u, pa.v - pb.v, pa.depth - pb.depth);
    expect(d).toBeCloseTo(d3, 6);
  }
});

it('fitView centres the points inside the box with padding', () => {
  const pts = [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 200 }];
  const view = fitView(pts, VIEWS.front, 400, 300, 20);
  const screens = pts.map((p) => toScreen(p, VIEWS.front, view));
  for (const s of screens) {
    expect(s.x).toBeGreaterThanOrEqual(19.9);
    expect(s.x).toBeLessThanOrEqual(380.1);
    expect(s.y).toBeGreaterThanOrEqual(19.9);
    expect(s.y).toBeLessThanOrEqual(280.1);
  }
  // Aspect preserved: 100 wide × 200 tall fits the height, so scale = 260/200.
  expect(view.scale).toBeCloseTo(260 / 200, 9);
});

it('fitView survives empty and non-finite input', () => {
  expect(fitView([], VIEWS.iso, 400, 300)).toMatchObject({ scale: 1, offsetU: 200, offsetV: 150 });
  const v = fitView([{ x: NaN, y: 0, z: 0 }], VIEWS.iso, 400, 300);
  expect(Number.isFinite(v.scale)).toBe(true);
});

it('the wheel ring is a closed circle in the wheel plane', () => {
  const ring = wheelRing({ x: 0, y: 600, z: 228 }, 228, 8);
  expect(ring).toHaveLength(9);                       // closed: first point repeated
  expect(ring[8].x).toBeCloseTo(ring[0].x, 9);
  expect(ring[8].z).toBeCloseTo(ring[0].z, 9);
  for (const p of ring) {
    expect(p.y).toBeCloseTo(600, 9);                  // stays in plane
    expect(Math.hypot(p.x, p.z - 228)).toBeCloseTo(228, 6);
  }
});
