/**
 * Orthographic 3D projection for the hardpoint view (feature review Tier 4 #11).
 *
 * The suspension solver is a front-view (y–z) model, but the hardpoint table has
 * always carried an x (fore/aft) coordinate — the thing that sets the side-view
 * swing-arm lean behind anti-dive and anti-squat. There was no way to SEE it, so
 * a typo in x was invisible. This projects the real hardpoints so the corner can
 * be rotated and read.
 *
 * Hand-rolled rather than a 3D library on purpose: the brief asks for near-zero
 * JS and a site that stays fast on a mid-range Android, and an orthographic
 * wireframe of a dozen points needs nine multiplications, not 600 KB of WebGL.
 *
 * Frame — the hardpoint table's own: origin at the front-axle centre on the
 * ground, x fore/aft (+ rearward), y lateral (+ right), z vertical (+ up).
 * Screen: u right, v down (SVG's own sense), and `depth` grows away from the
 * camera so callers can paint back-to-front.
 */
export interface Pt3 { x: number; y: number; z: number }
export interface Camera {
  /** Rotation about the vertical axis, degrees. 0 is the front view (looking along y). */
  yaw: number;
  /** Elevation, degrees. 0 is level with the ground, + looks down. */
  pitch: number;
  /** Screen units per model unit. */
  zoom?: number;
}
export interface Projected { u: number; v: number; depth: number }

const rad = (d: number) => (d * Math.PI) / 180;

/** Project one point. Pure; no DOM, no state. */
export function project(p: Pt3, cam: Camera): Projected {
  const cy = Math.cos(rad(cam.yaw)), sy = Math.sin(rad(cam.yaw));
  const cp = Math.cos(rad(cam.pitch)), sp = Math.sin(rad(cam.pitch));
  const zoom = cam.zoom ?? 1;
  // Yaw about z: u is the horizontal screen axis, w the (pre-pitch) depth.
  const u = p.x * cy + p.y * sy;
  const w = -p.x * sy + p.y * cy;
  // Pitch tips the vertical axis into the depth axis.
  const vUp = p.z * cp - w * sp;
  const depth = w * cp + p.z * sp;
  return { u: u * zoom, v: -vUp * zoom, depth };
}

export interface ViewBox { scale: number; offsetU: number; offsetV: number; width: number; height: number }

/**
 * A scale/offset that fits the projected points into a width×height box with
 * padding, preserving aspect (so the corner is never stretched). Returns scale 1
 * centred when there is nothing finite to fit.
 */
export function fitView(points: Pt3[], cam: Camera, width: number, height: number, pad = 24): ViewBox {
  const ps = points.map((p) => project(p, { ...cam, zoom: 1 })).filter((p) => Number.isFinite(p.u) && Number.isFinite(p.v));
  if (!ps.length) return { scale: 1, offsetU: width / 2, offsetV: height / 2, width, height };
  const minU = Math.min(...ps.map((p) => p.u)), maxU = Math.max(...ps.map((p) => p.u));
  const minV = Math.min(...ps.map((p) => p.v)), maxV = Math.max(...ps.map((p) => p.v));
  const spanU = maxU - minU || 1, spanV = maxV - minV || 1;
  const scale = Math.min((width - 2 * pad) / spanU, (height - 2 * pad) / spanV);
  return {
    scale,
    offsetU: pad - minU * scale + (width - 2 * pad - spanU * scale) / 2,
    offsetV: pad - minV * scale + (height - 2 * pad - spanV * scale) / 2,
    width, height,
  };
}

/** Project a point straight to SVG coordinates through a fitted view. */
export function toScreen(p: Pt3, cam: Camera, view: ViewBox): { x: number; y: number; depth: number } {
  const q = project(p, { ...cam, zoom: 1 });
  return { x: q.u * view.scale + view.offsetU, y: q.v * view.scale + view.offsetV, depth: q.depth };
}

/**
 * A circle in the wheel plane (constant y), as model-space points — the wheel
 * and tyre, drawn where the hardpoints say they are rather than as decoration.
 */
export function wheelRing(centre: Pt3, radius: number, segments = 48): Pt3[] {
  const pts: Pt3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * 2 * Math.PI;
    pts.push({ x: centre.x + radius * Math.cos(t), y: centre.y, z: centre.z + radius * Math.sin(t) });
  }
  return pts;
}

/** Named camera presets, so "what am I looking at?" is never a guess. */
export const VIEWS: Record<string, Camera> = {
  front: { yaw: 0, pitch: 0 },
  side: { yaw: 90, pitch: 0 },
  top: { yaw: 0, pitch: 89.9 },      // not 90: a degenerate pitch loses the yaw
  iso: { yaw: 35, pitch: 22 },
};
