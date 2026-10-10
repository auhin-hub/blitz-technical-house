/**
 * DAQ channel plan (handoff P2.4) — the editable sensor/logging list that seeds
 * the DAQ tool and round-trips through `public/templates/daq/daq_channel_plan.csv`.
 * Bus load per channel = rate_hz · bytes_per_sample · 8 · qty (bit/s on CAN).
 * Event-rate channels (e.g. lap beacon) carry rate_hz = 0 so they add ~nothing
 * to the continuous bus estimate.
 */
export interface DaqChannel {
  channel_id: string;
  channel_name: string;
  sensor_type: string;
  qty: number;
  location: string;
  rate_hz: number;
  bytes_per_sample: number;
  unit: string;
  range_min: number | null;
  range_max: number | null;
  subsystem: string;
  validates: string;
  notes: string;
}

/** Ordered CSV columns (match daq_channel_plan.csv exactly). */
export const DAQ_COLS: (keyof DaqChannel)[] = [
  'channel_id', 'channel_name', 'sensor_type', 'qty', 'location', 'rate_hz',
  'bytes_per_sample', 'unit', 'range_min', 'range_max', 'subsystem', 'validates', 'notes',
];

/** CAN bus load for one channel (bit/s). */
export function channelBusLoad(c: Pick<DaqChannel, 'rate_hz' | 'bytes_per_sample' | 'qty'>): number {
  return (c.rate_hz || 0) * (c.bytes_per_sample || 0) * 8 * (c.qty || 0);
}

const C = (
  channel_id: string, channel_name: string, sensor_type: string, qty: number, location: string,
  rate_hz: number, bytes_per_sample: number, unit: string, range_min: number | null, range_max: number | null,
  subsystem: string, validates: string, notes = '',
): DaqChannel => ({ channel_id, channel_name, sensor_type, qty, location, rate_hz, bytes_per_sample, unit, range_min, range_max, subsystem, validates, notes });

/** The default 35-channel plan (seed; teams edit freely). */
export const DAQ_PLAN_SEED: DaqChannel[] = [
  C('CH01', 'Damper position FL', 'Linear potentiometer', 1, 'Front-left damper', 500, 2, 'mm', 0, 75, 'Suspension', 'motion_ratio / ride_freq_front / roll_gradient', 'Diff of L-R gives roll angle; slope gives damper velocity'),
  C('CH02', 'Damper position FR', 'Linear potentiometer', 1, 'Front-right damper', 500, 2, 'mm', 0, 75, 'Suspension', 'motion_ratio / ride_freq_front / roll_gradient', 'Pair with FL for front roll'),
  C('CH03', 'Damper position RL', 'Linear potentiometer', 1, 'Rear-left damper', 500, 2, 'mm', 0, 75, 'Suspension', 'motion_ratio / ride_freq_rear / roll_gradient', 'Pair with RR for rear roll'),
  C('CH04', 'Damper position RR', 'Linear potentiometer', 1, 'Rear-right damper', 500, 2, 'mm', 0, 75, 'Suspension', 'motion_ratio / ride_freq_rear / roll_gradient', 'Reference zero at static (no-roll) position'),
  C('CH05', 'IMU acceleration (x y z)', '3-axis accelerometer', 1, 'Sprung mass near CG', 200, 6, 'g', -3, 3, 'Chassis', 'accel_lat_target / accel_brake_target / g-g', '2 bytes per axis; mount rigid and level'),
  C('CH06', 'IMU angular rate (roll pitch yaw)', '3-axis gyro', 1, 'Sprung mass near CG', 200, 6, 'deg/s', -300, 300, 'Chassis', 'yaw response / understeer_gradient', 'Yaw rate drives understeer & stability analysis'),
  C('CH07', 'Wheel speed FL', 'Hall-effect', 1, 'Front-left upright', 200, 2, 'km/h', 0, 150, 'Brakes/Powertrain', 'slip ratio / lock detection', 'Count teeth on an existing ring; needs tooth count in calibration'),
  C('CH08', 'Wheel speed FR', 'Hall-effect', 1, 'Front-right upright', 200, 2, 'km/h', 0, 150, 'Brakes/Powertrain', 'slip ratio / lock detection', 'Front wheels = closest to true road speed (undriven)'),
  C('CH09', 'Wheel speed RL', 'Hall-effect', 1, 'Rear-left upright', 200, 2, 'km/h', 0, 150, 'Powertrain', 'wheelspin / launch', 'Compare to GPS speed for drive slip'),
  C('CH10', 'Wheel speed RR', 'Hall-effect', 1, 'Rear-right upright', 200, 2, 'km/h', 0, 150, 'Powertrain', 'wheelspin / launch', ''),
  C('CH11', 'Steering angle', 'Rotary encoder or pot', 1, 'Steering column', 100, 2, 'deg', -120, 120, 'Steering', 'understeer_gradient / Ackermann', 'Combine with speed+ay for K (deg/g)'),
  C('CH12', 'Throttle position (APPS)', 'Potentiometer', 1, 'Throttle pedal', 100, 1, '%', 0, 100, 'Powertrain', 'driver input / traction', ''),
  C('CH13', 'Brake pressure front', 'Hydraulic pressure transducer', 1, 'Front master-cyl line', 200, 2, 'bar', 0, 100, 'Brakes', 'achieved_front_bias', 'Rear/(F+R) pressure = live brake bias'),
  C('CH14', 'Brake pressure rear', 'Hydraulic pressure transducer', 1, 'Rear master-cyl line', 200, 2, 'bar', 0, 100, 'Brakes', 'achieved_front_bias', ''),
  C('CH15', 'Pushrod load FL', 'Strain gauge / load cell', 1, 'Front-left pushrod', 500, 2, 'N', -5000, 5000, 'Suspension', 'suspension_loads / LLT', 'Validates computed pushrod force & load transfer'),
  C('CH16', 'Pushrod load FR', 'Strain gauge / load cell', 1, 'Front-right pushrod', 500, 2, 'N', -5000, 5000, 'Suspension', 'suspension_loads / LLT', 'L-R diff = lateral load transfer at that axle'),
  C('CH17', 'Pushrod load RL', 'Strain gauge / load cell', 1, 'Rear-left pushrod', 500, 2, 'N', -5000, 5000, 'Suspension', 'suspension_loads / LLT', ''),
  C('CH18', 'Pushrod load RR', 'Strain gauge / load cell', 1, 'Rear-right pushrod', 500, 2, 'N', -5000, 5000, 'Suspension', 'suspension_loads / LLT', ''),
  C('CH19', 'Engine RPM', 'ECU via CAN', 1, 'ECU', 100, 2, 'rpm', 0, 12000, 'Powertrain', 'gear_speed / shift points', 'From CAN; no extra sensor'),
  C('CH20', 'Manifold pressure (MAP)', 'Pressure sensor / ECU', 1, 'Intake plenum', 50, 2, 'kPa', 0, 120, 'Powertrain', 'restrictor / tuning', ''),
  C('CH21', 'Intake air temp (IAT)', 'Thermistor / ECU', 1, 'Intake', 10, 2, 'degC', -10, 80, 'Powertrain', 'restrictor density correction', ''),
  C('CH22', 'Coolant temp', 'Thermistor / ECU', 1, 'Engine out', 10, 2, 'degC', 0, 130, 'Cooling', 'cooling model', 'Validates radiator / fan sizing'),
  C('CH23', 'Oil pressure', 'Pressure sensor', 1, 'Oil gallery', 10, 2, 'bar', 0, 10, 'Powertrain', 'engine health', ''),
  C('CH24', 'Lambda (AFR)', 'Wideband O2', 1, 'Exhaust pre-cat', 20, 2, 'lambda', 0.6, 1.4, 'Powertrain', 'fuel tuning', ''),
  C('CH25', 'Gear position', 'ECU / gear sensor', 1, 'Gearbox', 50, 1, 'gear', 0, 6, 'Powertrain', 'shift analysis', ''),
  C('CH26', 'Tyre surface temp FL (in/mid/out)', 'IR array x3', 3, 'Over front-left tyre', 20, 6, 'degC', 0, 120, 'Tyre', 'camber & pressure tuning', 'In-mid-out spread reveals camber & inflation; IR is noisy - shroud it'),
  C('CH27', 'Tyre surface temp FR (in/mid/out)', 'IR array x3', 3, 'Over front-right tyre', 20, 6, 'degC', 0, 120, 'Tyre', 'camber & pressure tuning', ''),
  C('CH28', 'Tyre surface temp RL (in/mid/out)', 'IR array x3', 3, 'Over rear-left tyre', 20, 6, 'degC', 0, 120, 'Tyre', 'camber & pressure tuning', ''),
  C('CH29', 'Tyre surface temp RR (in/mid/out)', 'IR array x3', 3, 'Over rear-right tyre', 20, 6, 'degC', 0, 120, 'Tyre', 'camber & pressure tuning', ''),
  C('CH30', 'Tyre pressure (TPMS) x4', 'TPMS', 4, 'Each wheel', 1, 8, 'bar', 0, 4, 'Tyre', 'hot pressure target', 'Low rate is fine'),
  C('CH31', 'Brake rotor temp x4', 'IR', 4, 'Each rotor', 10, 8, 'degC', 0, 700, 'Brakes', 'brake thermal / fade', 'Optional; endurance fade check'),
  C('CH32', 'GPS position + speed', 'GPS', 1, 'Roof / rollhoop', 20, 16, 'deg / km/h', 0, 150, 'Platform', 'track map / lap timing', 'Reference speed for slip; 10-25 Hz typical'),
  C('CH33', 'Battery voltage', 'Voltage divider', 1, 'Accumulator / battery', 10, 2, 'V', 0, 16, 'Electronics', 'power_budget', 'Validates electrical margin'),
  C('CH34', 'Battery current', 'Hall current sensor', 1, 'Main feed', 10, 2, 'A', 0, 200, 'Electronics', 'total_current_draw', 'Confirms real draw vs stator output'),
  C('CH35', 'Lap beacon', 'IR beacon / GPS', 1, 'Side pod', 0, 2, 'flag', 0, 1, 'Platform', 'lap timing', 'Event-rate (rate 0 = excluded from bus estimate); or derive laps from GPS'),
];
