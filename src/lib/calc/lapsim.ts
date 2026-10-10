/**
 * Quasi-steady point-mass lap-time simulator (handoff P2.6). A track is a list of
 * segments (straight length, or corner radius + arc length). We discretise the
 * lap, cap each corner at its grip-limited speed (with aero), then run a looped
 * forward (accel-limited) + backward (brake-limited) pass to build the speed
 * profile and integrate time. Aero scales every grip limit by
 *   k(v) = (W + ½ρv²·ClA) / W.
 * Longitudinal accel = min(traction-limited μx·g·k, power-limited P/(m·v)) − drag.
 * This is the design-stage estimate, not a transient sim.
 */
const G = 9.81;

export type SegKind = 'straight' | 'corner';
export interface Segment { kind: SegKind; length: number; radius: number; } // metres
export interface LapParams {
  mass: number; muLat: number; muLong: number; launchG: number; brakeG: number;
  clA: number; cdA: number; rho: number; power: number; // power in W
}
export interface LapResult { lapTime: number; distance: number; topSpeed: number; minSpeed: number; avgSpeed: number; v: number[]; }

const kAero = (p: LapParams, v: number) => { const W = p.mass * G; return W > 0 ? (W + 0.5 * p.rho * v * v * p.clA) / W : 1; };

/** Grip-limited corner speed (with aero), solved by iteration. */
export function cornerSpeed(p: LapParams, R: number): number {
  let v = Math.sqrt(Math.max(0, p.muLat * G * R));
  for (let i = 0; i < 40; i++) { const vn = Math.sqrt(p.muLat * G * R * kAero(p, v)); if (Math.abs(vn - v) < 1e-4) break; v = vn; }
  return v;
}

/** Power-vs-drag top speed estimate (seed for straights). */
export function topSpeedEstimate(p: LapParams): number {
  if (!(p.power > 0 && p.rho > 0 && p.cdA > 0)) return 100;
  return Math.cbrt((2 * p.power) / (p.rho * p.cdA));
}

export function simulateLap(p: LapParams, segments: Segment[], ds = 2): LapResult {
  const corner: boolean[] = [];
  const vCap: number[] = [];
  const vtop = topSpeedEstimate(p);
  for (const s of segments) {
    const n = Math.max(1, Math.round(s.length / ds));
    const cap = s.kind === 'corner' ? cornerSpeed(p, s.radius) : vtop;
    for (let k = 0; k < n; k++) { corner.push(s.kind === 'corner'); vCap.push(cap); }
  }
  const N = corner.length;
  if (!N) return { lapTime: NaN, distance: 0, topSpeed: NaN, minSpeed: NaN, avgSpeed: NaN, v: [] };

  const v = vCap.slice();
  const accelAt = (vv: number) => {
    const k = kAero(p, vv);
    const tract = p.launchG * G * k;
    const pw = vv > 0.5 ? p.power / (p.mass * vv) : tract;
    const drag = (0.5 * p.rho * vv * vv * p.cdA) / p.mass;
    return Math.max(0, Math.min(tract, pw) - drag);
  };
  const brakeAt = (vv: number) => {
    const k = kAero(p, vv);
    const drag = (0.5 * p.rho * vv * vv * p.cdA) / p.mass;
    return p.brakeG * G * k + drag;
  };
  // Looped forward/backward relaxation.
  for (let iter = 0; iter < 4; iter++) {
    for (let i = 0; i < N; i++) { const im = (i - 1 + N) % N; const cand = Math.sqrt(v[im] * v[im] + 2 * accelAt(v[im]) * ds); v[i] = Math.min(v[i], vCap[i], cand); }
    for (let i = N - 1; i >= 0; i--) { const ip = (i + 1) % N; const cand = Math.sqrt(v[ip] * v[ip] + 2 * brakeAt(v[i]) * ds); v[i] = Math.min(v[i], cand); }
  }

  let t = 0;
  for (let i = 0; i < N; i++) { const ip = (i + 1) % N; const vavg = (v[i] + v[ip]) / 2; if (vavg > 0.1) t += ds / vavg; }
  const distance = N * ds;
  return { lapTime: t, distance, topSpeed: Math.max(...v) * 3.6, minSpeed: Math.min(...v) * 3.6, avgSpeed: (distance / t) * 3.6, v };
}

/** A simple seed track (a small autocross-like loop). */
export const SEED_TRACK: Segment[] = [
  { kind: 'straight', length: 60, radius: 0 },
  { kind: 'corner', length: 24, radius: 15 },
  { kind: 'straight', length: 30, radius: 0 },
  { kind: 'corner', length: 16, radius: 10 },
  { kind: 'straight', length: 60, radius: 0 },
  { kind: 'corner', length: 31, radius: 20 },
  { kind: 'straight', length: 30, radius: 0 },
  { kind: 'corner', length: 19, radius: 12 },
];
