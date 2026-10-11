/**
 * DAQ log interpretation (handoff P2.3). Turns an uploaded log (rows of named
 * channels, matching daq_log_template.csv) into measured channels that validate
 * the design: g–g scatter, understeer & roll gradients (least-squares slopes vs
 * lateral g), live brake bias, drive slip, tyre-temp spread and a damper-velocity
 * histogram. Pure — parsing and comparison to design values happen in the page.
 */
export type LogRow = Record<string, number>;

/** Least-squares slope of y vs x over finite pairs. */
export function slope(xs: number[], ys: number[]): number {
  const px: number[] = [], py: number[] = [];
  for (let i = 0; i < xs.length; i++) if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) { px.push(xs[i]); py.push(ys[i]); }
  const n = px.length;
  if (n < 2) return NaN;
  const xm = px.reduce((a, b) => a + b, 0) / n, ym = py.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (px[i] - xm) * (py[i] - ym); sxx += (px[i] - xm) ** 2; }
  return sxx > 0 ? sxy / sxx : NaN;
}

const colOf = (rows: LogRow[], k: string) => rows.map((r) => r[k]);

export interface DaqInterp {
  nSamples: number;
  gg: { ay: number; ax: number }[];
  understeerGradient: number;   // deg/g (road steer − Ackermann), or raw steer if no wheelbase
  understeerIsRawSteer: boolean; // true ⇒ kinematic term not removed (no wheelbase given)
  rollGradient: number;         // deg/g (front axle)
  brakeBias: number;            // mean front pressure fraction under braking
  driveSlip: number;            // mean rear slip vs GPS (fraction)
  tyreTempSpread: Record<string, number>; // in − out, per tyre, °C
  damperHist: { lowBump: number; highBump: number; lowReb: number; highReb: number };
}

/**
 * Front-axle roll angle (deg) from the L/R damper split over the front track.
 * Dampers move less than the wheels, so damper travel must be divided by the
 * motion ratio first (audit P1.2) — omitting it under-read the roll gradient by
 * roughly that factor. `mr` = damper travel ÷ wheel travel (≈0.6–0.9); 1 = none.
 */
export function rollAngleDeg(damperL: number, damperR: number, trackMm: number, mr = 1): number {
  if (!(trackMm > 0) || !(mr > 0)) return NaN;
  const wheelDelta = (damperL - damperR) / mr;
  return (Math.atan(wheelDelta / trackMm) * 180) / Math.PI;
}

/**
 * Kinematic (Ackermann) steer for one sample, deg: δ_Ack = atan(L/R) with the
 * instantaneous radius R = v²/a_lat. Subtracting it turns a raw steer gradient
 * into the understeer gradient (audit P1.3).
 */
export function ackermannDeg(wheelbaseMm: number, speedKmh: number, ayG: number): number {
  const L = wheelbaseMm / 1000, v = speedKmh / 3.6, aLat = Math.abs(ayG) * 9.81;
  if (!(L > 0) || !(v > 1) || !(aLat > 0.05)) return NaN;   // straight line ⇒ undefined
  const R = (v * v) / aLat;
  return (Math.atan(L / R) * 180) / Math.PI;
}

export function interpretLog(
  rows: LogRow[],
  cfg: { trackFront?: number; steeringRatio?: number; motionRatio?: number; wheelbase?: number } = {},
): DaqInterp {
  const ratio = cfg.steeringRatio && cfg.steeringRatio > 0 ? cfg.steeringRatio : 1;
  const track = cfg.trackFront && cfg.trackFront > 0 ? cfg.trackFront : 1200;
  const mr = cfg.motionRatio && cfg.motionRatio > 0 ? cfg.motionRatio : 1;
  const wheelbase = cfg.wheelbase && cfg.wheelbase > 0 ? cfg.wheelbase : 0;
  const ay = colOf(rows, 'ay_g');

  const gg = rows.map((r) => ({ ay: r.ay_g, ax: r.ax_g })).filter((p) => Number.isFinite(p.ay) && Number.isFinite(p.ax));

  // Understeer gradient: (road steer − Ackermann) vs lateral g. Without a
  // wheelbase we cannot form the kinematic term, so fall back to the raw steer
  // gradient and say so via `understeerIsRawSteer`.
  const roadSteer = rows.map((r) => r.steer_deg / ratio);
  const understeerIsRawSteer = !(wheelbase > 0);
  const steerMinusAck = rows.map((r, i) => {
    if (understeerIsRawSteer) return roadSteer[i];
    const ack = ackermannDeg(wheelbase, r.speed_gps_kmh, r.ay_g);
    return Number.isFinite(ack) ? roadSteer[i] - Math.sign(r.ay_g || 1) * ack : NaN;
  });
  const understeerGradient = slope(ay, steerMinusAck);

  // Roll gradient: front roll angle (wheel travel = damper ÷ MR) vs lateral g.
  const roll = rows.map((r) => rollAngleDeg(r.damper_FL, r.damper_FR, track, mr));
  const rollGradient = slope(ay, roll);

  // Brake bias: mean front fraction where meaningful pressure is applied.
  let bSum = 0, bN = 0;
  for (const r of rows) { const tot = (r.brake_pres_F || 0) + (r.brake_pres_R || 0); if (tot > 5) { bSum += r.brake_pres_F / tot; bN++; } }
  const brakeBias = bN ? bSum / bN : NaN;

  // Drive slip: mean (rear wheel speed − GPS)/GPS where moving.
  let sSum = 0, sN = 0;
  for (const r of rows) { const rear = ((r.wheelspd_RL || NaN) + (r.wheelspd_RR || NaN)) / 2; if (Number.isFinite(rear) && r.speed_gps_kmh > 5) { sSum += (rear - r.speed_gps_kmh) / r.speed_gps_kmh; sN++; } }
  const driveSlip = sN ? sSum / sN : NaN;

  // Tyre temp spread (inner − outer), per tyre.
  const tyreTempSpread: Record<string, number> = {};
  for (const t of ['FL', 'FR', 'RL', 'RR']) {
    const vals = rows.map((r) => r[`tyre_temp_${t}_in_C`] - r[`tyre_temp_${t}_out_C`]).filter(Number.isFinite);
    if (vals.length) tyreTempSpread[t] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  // Damper velocity histogram (FL): d(pos)/dt, binned at ±25 mm/s.
  const hist = { lowBump: 0, highBump: 0, lowReb: 0, highReb: 0 };
  for (let i = 1; i < rows.length; i++) {
    const dt = rows[i].time_s - rows[i - 1].time_s;
    const dx = rows[i].damper_FL - rows[i - 1].damper_FL;
    if (!(dt > 0) || !Number.isFinite(dx)) continue;
    const v = dx / dt; // mm/s
    if (v >= 0) { if (v < 25) hist.lowBump++; else hist.highBump++; }
    else { if (v > -25) hist.lowReb++; else hist.highReb++; }
  }

  return { nSamples: rows.length, gg, understeerGradient, understeerIsRawSteer, rollGradient, brakeBias, driveSlip, tyreTempSpread, damperHist: hist };
}
