/**
 * Vehicle Spec (Master) store — the canonical parameter set (MASTER_BUILD_PLAN
 * §4). Ships BLANK by design (§0): names + units + typical reference ranges
 * only, no values — the team fills in the new car in-app. Mass, front fraction,
 * CoG and yaw inertia are computed by MassBudget (§6.2) and written here;
 * weight, avg track and axle loads are computed in Vehicle Spec from the others.
 *
 * The reference ranges are typical Formula Student figures for orientation only
 * (NOT targets, NOT validated). Handbook-sourced where cited; where a reputable
 * figure isn't available the ref is omitted rather than invented.
 */

export type Confidence = 'Live' | 'Est';

export interface Ref { typ: string; src?: string; }

export interface SpecParam {
  key: string;
  label: string;
  symbol: string;
  unit: string;
  /** Blank by design — the team enters values in-app. */
  value: number | null;
  /** MassBudget | input | Tyre | target | VD | =formula */
  source: string;
  /** True = computed inside Vehicle Spec from other params (read-only). */
  computed?: boolean;
  /** Typical FS-car value for orientation (shown as a muted reference). */
  ref?: Ref;
}

const HB = 'Team Blitz VD Handbook';
const FS = 'FSAE typical';

/** The full parameter set (MASTER_BUILD_PLAN §4), in display order, shipped blank. */
export const PARAM_SEED: SpecParam[] = [
  { key: 'mass_total',        label: 'Total mass (with driver)', symbol: 'm',   unit: 'kg',    value: null, source: 'MassBudget', ref: { typ: '230–300', src: FS } },
  { key: 'mass_frac_front',   label: 'Front mass fraction',      symbol: 'ff',  unit: '-',     value: null, source: 'MassBudget', ref: { typ: '0.45–0.50', src: FS } },
  { key: 'cog_height',        label: 'CoG height',               symbol: 'h',   unit: 'mm',    value: null, source: 'MassBudget', ref: { typ: '250–320', src: FS } },
  { key: 'yaw_inertia',       label: 'Yaw inertia',              symbol: 'Izz', unit: 'kg·m²', value: null, source: 'MassBudget' },
  { key: 'unsprung_corner',   label: 'Unsprung mass per corner', symbol: '',    unit: 'kg',    value: null, source: 'VD',         ref: { typ: '8–14', src: FS } },
  { key: 'wheelbase',         label: 'Wheelbase',                symbol: 'L',   unit: 'mm',    value: null, source: 'input',      ref: { typ: '1530–1600 (≥1525 rule)', src: FS } },
  { key: 'track_front',       label: 'Front track',              symbol: 'tf',  unit: 'mm',    value: null, source: 'input',      ref: { typ: '1200–1300', src: FS } },
  { key: 'track_rear',        label: 'Rear track',               symbol: 'tr',  unit: 'mm',    value: null, source: 'input',      ref: { typ: '1180–1280', src: FS } },
  { key: 'avg_track',         label: 'Average track',            symbol: 't',   unit: 'mm',    value: null, source: '=(tf+tr)/2', computed: true },
  { key: 'ride_height',       label: 'Ride height',              symbol: '',    unit: 'mm',    value: null, source: 'input',      ref: { typ: '30–50', src: FS } },
  { key: 'mu_lat_peak',       label: 'Peak lateral μ',           symbol: 'μ',   unit: '-',     value: null, source: 'Tyre',       ref: { typ: '1.4–1.7 (belt ≠ track)', src: HB } },
  { key: 'corner_stiffness',  label: 'Cornering stiffness',      symbol: 'Cα',  unit: 'N/deg', value: null, source: 'Tyre' },
  { key: 'slip_peak',         label: 'Peak slip angle',          symbol: '',    unit: 'deg',   value: null, source: 'Tyre',       ref: { typ: '6–10', src: HB } },
  { key: 'rolling_radius',    label: 'Loaded rolling radius',    symbol: 'Re',  unit: 'mm',    value: null, source: 'Tyre',       ref: { typ: '220–235 (13")', src: FS } },
  { key: 'tyre_vert_stiffness', label: 'Tyre vertical stiffness', symbol: 'Kt', unit: 'N/mm',  value: null, source: 'Tyre',       ref: { typ: '90–130 (verify)', src: FS } },
  { key: 'accel_lat_target',  label: 'Target lateral accel',     symbol: '',    unit: 'g',     value: null, source: 'target',     ref: { typ: '1.4–1.8', src: FS } },
  { key: 'accel_brake_target', label: 'Target braking decel',    symbol: '',    unit: 'g',     value: null, source: 'target',     ref: { typ: '1.3–1.8', src: FS } },
  { key: 'roll_grad_target',  label: 'Roll gradient target',     symbol: '',    unit: 'deg/g', value: null, source: 'target',     ref: { typ: '1.0–1.5', src: HB } },
  { key: 'ride_freq_front',   label: 'Ride frequency front',     symbol: '',    unit: 'Hz',    value: null, source: 'target',     ref: { typ: '2.3–2.9', src: HB } },
  { key: 'ride_freq_rear',    label: 'Ride frequency rear',      symbol: '',    unit: 'Hz',    value: null, source: 'target',     ref: { typ: '2.5–3.1 (> front)', src: HB } },
  { key: 'tlltd_front',       label: 'Front lateral LT distribution', symbol: 'TLLTD', unit: '-', value: null, source: 'VD',      ref: { typ: '0.45–0.55', src: FS } },
  { key: 'motion_ratio',      label: 'Motion ratio (wheel→spring)', symbol: 'MR', unit: '-',   value: null, source: 'VD' },
  { key: 'weight',            label: 'Weight',                   symbol: 'W',   unit: 'N',     value: null, source: '=m·g',       computed: true },
  { key: 'axle_load_front',   label: 'Front axle static load',   symbol: '',    unit: 'N',     value: null, source: '=W·ff',      computed: true },
  { key: 'axle_load_rear',    label: 'Rear axle static load',    symbol: '',    unit: 'N',     value: null, source: '=W·(1−ff)',  computed: true },
];

/** A live row from the Supabase `vehicle_spec` table. */
export interface SpecRow extends SpecParam {
  confidence: Confidence;
  frozen: boolean;
  frozen_gate: string | null;
  updated_at: string | null;
}

/** Field colour state: input (blue) · linked (green) · computed (black). */
export function fieldState(p: SpecParam): 'input' | 'linked' | 'computed' {
  if (p.computed || p.source.startsWith('=')) return 'computed';
  if (p.source === 'input') return 'input';
  return 'linked'; // MassBudget / Tyre / VD / target flow in from elsewhere
}
