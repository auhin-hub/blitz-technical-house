/**
 * Pacejka `.tir` (Tyre Property File) reader (handoff P2.2). A .tir is an
 * INI-like KEY = VALUE text file ($ or ! start comments, [SECTION] headers).
 * We parse the numeric keys and map the handful the Master needs. Belt-rig (TTC)
 * grip ≠ track grip — keep that caveat visible wherever these populate.
 */

/** Parse a .tir into a flat upper-cased numeric key map. */
export function parseTir(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[$!].*$/, '').trim();          // strip comments
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!m) continue;
    const num = Number(m[2].trim().replace(/^['"]|['"]$/g, ''));
    if (Number.isFinite(num)) out[m[1].toUpperCase()] = num;
  }
  return out;
}

export interface TirDerived {
  rollingRadiusUnloaded?: number;  // mm
  rollingRadiusEffective?: number; // mm (~0.97 × unloaded)
  tyreVertStiffness?: number;      // N/mm
  muLatPeak?: number;              // -
  cornerStiffness?: number;        // N/deg
  operatingFz?: number;            // N (Fz used for the evaluation)
}

/**
 * Map parsed .tir coefficients to Master values, evaluated at an operating Fz
 * (default FNOMIN). Formulas per the Magic Formula lateral block:
 *   μy      = PDY1 + PDY2·dfz,          dfz = (Fz − FNOMIN)/FNOMIN
 *   Kyα     = PKY1·FNOMIN·sin(2·atan(Fz/(PKY2·FNOMIN)))   [N/rad] → ·π/180 [N/deg]
 */
export function tirToMaster(t: Record<string, number>, fz?: number): TirDerived {
  const d: TirDerived = {};
  const FN = t.FNOMIN;
  const Fz = fz ?? FN;
  d.operatingFz = Fz;
  if (t.UNLOADED_RADIUS != null) {
    d.rollingRadiusUnloaded = t.UNLOADED_RADIUS * 1000;
    d.rollingRadiusEffective = t.UNLOADED_RADIUS * 1000 * 0.97;
  }
  if (t.VERTICAL_STIFFNESS != null) d.tyreVertStiffness = t.VERTICAL_STIFFNESS / 1000;
  if (t.PDY1 != null) {
    const dfz = FN ? (Fz! - FN) / FN : 0;
    d.muLatPeak = Math.abs(t.PDY1 + (t.PDY2 ?? 0) * dfz);
  }
  if (t.PKY1 != null && t.PKY2 != null && FN && Fz) {
    const KyaPerRad = t.PKY1 * FN * Math.sin(2 * Math.atan(Fz / (t.PKY2 * FN)));
    d.cornerStiffness = Math.abs(KyaPerRad) * (Math.PI / 180);
  }
  return d;
}

/** Master keys each derived field writes to (for the UI + the write step). */
export const TIR_MASTER_MAP: { field: keyof TirDerived; key: string; label: string; unit: string }[] = [
  { field: 'tyreVertStiffness', key: 'tyre_vert_stiffness', label: 'Tyre vertical stiffness', unit: 'N/mm' },
  { field: 'muLatPeak', key: 'mu_lat_peak', label: 'Peak lateral μ', unit: '-' },
  { field: 'cornerStiffness', key: 'corner_stiffness', label: 'Cornering stiffness', unit: 'N/deg' },
];
