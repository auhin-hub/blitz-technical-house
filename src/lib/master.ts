/**
 * Vehicle Spec (Master) store — the shared schema, mirrored from TOOL_SPECS §0.
 *
 * This is the one place canonical car parameters live (the golden rule: "no
 * private copy of a shared number — read it from Master", BRIEF §B). The seed
 * values are the current workbook defaults; they double as the read view's
 * fallback before the Supabase table is created / populated.
 *
 * Do not edit values here to "correct" the car — the live number lives in the
 * Supabase `vehicle_spec` table. This array only defines the parameter set and
 * its workbook starting points.
 */

export type Confidence = 'Live' | 'Est';

export interface SpecParam {
  key: string;
  label: string;
  symbol: string;
  unit: string;
  value: number;
  /** Where the number comes from: MassBudget | input | Tyre | target | VD | formula. */
  source: string;
}

/** A live row from the Supabase `vehicle_spec` table. */
export interface SpecRow extends SpecParam {
  confidence: Confidence;
  frozen: boolean;
  frozen_gate: string | null;
  updated_at: string | null;
}

/** The 14 canonical parameters (TOOL_SPECS §0), in display order. */
export const PARAM_SEED: SpecParam[] = [
  { key: 'mass_total',       label: 'Total mass (with driver)',      symbol: 'm',  unit: 'kg',    value: 264,    source: 'MassBudget' },
  { key: 'mass_frac_front',  label: 'Front mass fraction',           symbol: '',   unit: '-',     value: 0.4569, source: 'MassBudget' },
  { key: 'cog_height',       label: 'CoG height',                    symbol: 'h',  unit: 'mm',    value: 263.4,  source: 'MassBudget' },
  { key: 'wheelbase',        label: 'Wheelbase',                     symbol: 'L',  unit: 'mm',    value: 1550,   source: 'input' },
  { key: 'track_front',      label: 'Front track',                   symbol: '',   unit: 'mm',    value: 1200,   source: 'input' },
  { key: 'track_rear',       label: 'Rear track',                    symbol: '',   unit: 'mm',    value: 1180,   source: 'input' },
  { key: 'ride_height',      label: 'Ride height',                   symbol: '',   unit: 'mm',    value: 40,     source: 'input' },
  { key: 'mu_lat_peak',      label: 'Peak lateral μ',           symbol: '',   unit: '-',     value: 1.5,    source: 'Tyre' },
  { key: 'corner_stiffness', label: 'Cornering stiffness',           symbol: 'Cα', unit: 'N/deg', value: 1100, source: 'Tyre' },
  { key: 'rolling_radius',   label: 'Loaded rolling radius',         symbol: '',   unit: 'mm',    value: 228,    source: 'Tyre' },
  { key: 'accel_lat_target', label: 'Target lateral accel',          symbol: '',   unit: 'g',     value: 1.5,    source: 'target' },
  { key: 'motion_ratio',     label: 'Motion ratio (wheel→spring)', symbol: 'MR', unit: '-',  value: 0.7,    source: 'VD' },
  { key: 'axle_load_front',  label: 'Front axle static load',        symbol: '',   unit: 'N',     value: 1183.2, source: '=m·g·ff' },
  { key: 'axle_load_rear',   label: 'Rear axle static load',         symbol: '',   unit: 'N',     value: 1406.6, source: '=m·g·(1−ff)' },
];

/** Which workbook source means "computed/linked" vs "member-typed input". */
export function fieldState(source: string): 'input' | 'linked' | 'computed' {
  if (source.startsWith('=')) return 'computed';
  if (source === 'input') return 'input';
  return 'linked'; // MassBudget / Tyre / VD / target flow in from elsewhere
}
