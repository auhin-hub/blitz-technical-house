/**
 * Typical-range guards for Master inputs (feature review Tier 3 #9).
 *
 * Every Master parameter already carries a `ref.typ` — the typical Formula
 * Student range, cited from the handbook or an established reference. This reads
 * those strings so the UI can flag a value that sits outside the range it was
 * sourced against.
 *
 * It is an ADVISORY, never a block: a deliberate outlier is a legitimate design
 * choice (and the whole point of a design tool), but a mistyped 2630 mm
 * wheelbase should not sail through silently. Same philosophy as the amber
 * "not frozen" border: say what you know, don't decide for the engineer.
 *
 * Ranges are quoted in the row's own unit, so no conversion happens here.
 */
export interface TypicalRange {
  lo: number;
  hi: number;
  /** A single quoted figure (e.g. a rulebook diameter) rather than a band. */
  exact: boolean;
  /** The original text, for the message. */
  text: string;
}

const NUM = String.raw`-?\d+(?:\.\d+)?`;
// en dash, em dash, hyphen or " to ", with the trailing parenthetical ignored.
const BAND = new RegExp(`^\\s*(${NUM})\\s*(?:[–—-]|to)\\s*(${NUM})`);
const SINGLE = new RegExp(`^\\s*(${NUM})`);

/**
 * Parse a `ref.typ` string into a range. Returns null when there is no number to
 * work with (e.g. a purely descriptive note).
 */
export function parseTypical(typ: string | null | undefined): TypicalRange | null {
  if (!typ) return null;
  const band = BAND.exec(typ);
  if (band) {
    const lo = Number(band[1]), hi = Number(band[2]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    return { lo: Math.min(lo, hi), hi: Math.max(lo, hi), exact: false, text: typ };
  }
  const one = SINGLE.exec(typ);
  if (one) {
    const v = Number(one[1]);
    if (!Number.isFinite(v)) return null;
    return { lo: v, hi: v, exact: true, text: typ };
  }
  return null;
}

export type RangeVerdict = 'ok' | 'low' | 'high' | 'off';

/**
 * Where a value sits against the typical range. `off` is for a quoted single
 * figure that the value doesn't match (a rules number, usually).
 *
 * `tolerance` widens the band slightly so a value exactly at a rounded bound
 * (and ordinary floating-point noise) is never flagged.
 */
export function checkRange(value: number, r: TypicalRange | null, tolerance = 1e-9): RangeVerdict {
  if (!r || !Number.isFinite(value)) return 'ok';
  if (r.exact) return Math.abs(value - r.lo) <= Math.max(tolerance, Math.abs(r.lo) * 1e-9) ? 'ok' : 'off';
  if (value < r.lo - tolerance) return 'low';
  if (value > r.hi + tolerance) return 'high';
  return 'ok';
}

/** The sentence shown next to an out-of-range input. '' when it is fine. */
export function rangeNote(value: number, typ: string | null | undefined, unit?: string | null): string {
  const r = parseTypical(typ);
  const verdict = checkRange(value, r);
  if (!r || verdict === 'ok') return '';
  const u = unit ? ` ${unit}` : '';
  if (verdict === 'off') return `Quoted value is ${r.text}${u} — check this is deliberate.`;
  const side = verdict === 'low' ? 'below' : 'above';
  return `${side} the typical FS range (${r.text}${u}) — fine if deliberate.`;
}
