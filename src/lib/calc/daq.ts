/**
 * DAQ / Telemetry — CAN bus load. Ported from the DAQ_Telemetry Calculations
 * sheet (TOOL_SPECS §3):
 *   bus load per channel D = rate · bytes · 8
 *   total bus load         = SUM
 *   bus utilisation        = total / CAN capacity   (keep < 60–70%)
 */
import type { Out } from './engine';
type Flat = Record<string, number>;

export const DAQ_CHANNELS = [
  { key: 'damperPos', label: 'Damper pos ×4', rate: 500, bytes: 8 },
  { key: 'imu', label: 'IMU accel + gyro', rate: 200, bytes: 12 },
  { key: 'wheelSpeed', label: 'Wheel speed ×4', rate: 200, bytes: 8 },
  { key: 'steering', label: 'Steering', rate: 100, bytes: 2 },
  { key: 'brakePressure', label: 'Brake pressure', rate: 200, bytes: 4 },
  { key: 'throttle', label: 'Throttle', rate: 100, bytes: 2 },
  { key: 'pushrodLoad', label: 'Pushrod load ×4', rate: 500, bytes: 8 },
  { key: 'tyreTempPress', label: 'Tyre temp / pressure', rate: 10, bytes: 8 },
  { key: 'gps', label: 'GPS', rate: 20, bytes: 16 },
];

export function daqCompute(inp: Flat): Out {
  const out: Out = {};
  let total = 0;
  for (const c of DAQ_CHANNELS) {
    const load = (inp[`rate_${c.key}`] || 0) * (inp[`bytes_${c.key}`] || 0) * 8;
    out[`load_${c.key}`] = load;
    total += load;
  }
  out.totalBusLoad = total;
  out.utilisation = (total / inp.capacity) * 100; // %
  return out;
}
