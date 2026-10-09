/**
 * Electronics — power budget. Ported from the Electronics Calculations sheet
 * (TOOL_SPECS §4a):
 *   total current B11 = SUM(loads)
 *   margin        B13 = stator − total   (keep positive)
 */
import type { Out } from './engine';
type Flat = Record<string, number>;

export const LOADS = [
  { key: 'ecuSensors', label: 'ECU + sensors' },
  { key: 'fuelPump', label: 'Fuel pump' },
  { key: 'fan', label: 'Fan' },
  { key: 'daqTelemetry', label: 'DAQ + telemetry' },
  { key: 'dashLights', label: 'Dash + lights' },
  { key: 'ignitionCoils', label: 'Ignition / coils' },
];

export function powerCompute(inp: Flat): Out {
  let total = 0;
  for (const l of LOADS) total += inp[l.key] || 0;
  const margin = inp.stator - total;
  return { total, margin, batteryMass: inp.batteryMass };
}
