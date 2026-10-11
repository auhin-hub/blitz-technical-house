/** DAQ log interpretation (handoff P2.3). */
import { it, expect } from 'vitest';
import { slope, rollAngleDeg, ackermannDeg, interpretLog, type LogRow } from './daq-interp';

it('least-squares slope of a clean line', () => {
  expect(slope([0, 1, 2, 3], [1, 3, 5, 7])).toBeCloseTo(2, 9); // y = 2x + 1
});

it('roll angle from damper split', () => {
  expect(rollAngleDeg(30, 10, 1200)).toBeCloseTo((Math.atan(20 / 1200) * 180) / Math.PI, 6);
});

it('motion ratio scales damper travel up to wheel travel (P1.2)', () => {
  // MR 0.5 ⇒ the wheels moved twice as far as the dampers ⇒ twice the roll angle.
  const mr1 = rollAngleDeg(30, 10, 1200, 1);
  const mr05 = rollAngleDeg(30, 10, 1200, 0.5);
  expect(mr05).toBeGreaterThan(mr1);
  expect(mr05).toBeCloseTo((Math.atan(40 / 1200) * 180) / Math.PI, 6);
});

it('Ackermann steer uses the instantaneous radius, undefined in a straight line (P1.3)', () => {
  // v = 20 m/s (72 km/h), ay = 1 g ⇒ R = 400/9.81 ≈ 40.8 m; L = 1.55 m.
  const ack = ackermannDeg(1550, 72, 1);
  expect(ack).toBeCloseTo((Math.atan(1.55 / (400 / 9.81)) * 180) / Math.PI, 4);
  expect(Number.isNaN(ackermannDeg(1550, 72, 0))).toBe(true);  // no lateral accel
});

it('interprets a small synthetic log', () => {
  // 3 points with steer ∝ 3·ay (road steer after /ratio=1) and roll ∝ 2·ay.
  const rows: LogRow[] = [0, 0.5, 1].map((ay) => ({
    time_s: ay, ay_g: ay, ax_g: 0,
    steer_deg: 3 * ay, damper_FL: 2 * ay * (1200 / (180 / Math.PI)), damper_FR: 0,
    brake_pres_F: 30, brake_pres_R: 10, wheelspd_RL: 52, wheelspd_RR: 52, speed_gps_kmh: 50,
    tyre_temp_FL_in_C: 80, tyre_temp_FL_out_C: 70,
  } as LogRow));
  const r = interpretLog(rows, { trackFront: 1200, steeringRatio: 1 });
  expect(r.nSamples).toBe(3);
  expect(r.understeerIsRawSteer).toBe(true);   // no wheelbase ⇒ raw steer gradient
  expect(r.understeerGradient).toBeCloseTo(3, 1);
  expect(r.rollGradient).toBeCloseTo(2, 1);
  expect(r.brakeBias).toBeCloseTo(0.75, 6);         // 30/40
  expect(r.driveSlip).toBeCloseTo(0.04, 6);         // (52−50)/50
  expect(r.tyreTempSpread.FL).toBeCloseTo(10, 6);
});
