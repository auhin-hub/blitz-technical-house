/** Typical-range guards (feature review Tier 3 #9) — parsed from the real ref strings. */
import { it, expect } from 'vitest';
import { parseTypical, checkRange, rangeNote } from './ranges';

it('parses the en-dash bands used in PARAM_SEED', () => {
  expect(parseTypical('1200–1300')).toMatchObject({ lo: 1200, hi: 1300, exact: false });
  expect(parseTypical('0.45–0.50')).toMatchObject({ lo: 0.45, hi: 0.5 });
  expect(parseTypical('1.4–1.7 (belt ≠ track)')).toMatchObject({ lo: 1.4, hi: 1.7 });
  expect(parseTypical('2.5–3.1 (> front)')).toMatchObject({ lo: 2.5, hi: 3.1 });
  expect(parseTypical('1530–1600 (≥1525 rule)')).toMatchObject({ lo: 1530, hi: 1600 });
  expect(parseTypical('220–235 (13")')).toMatchObject({ lo: 220, hi: 235 });
});

it('treats a single quoted figure as exact (rules values)', () => {
  const r = parseTypical('20 petrol / 19 E85 (⚖)');
  expect(r).toMatchObject({ lo: 20, hi: 20, exact: true });
  expect(checkRange(20, r)).toBe('ok');
  expect(checkRange(19, r)).toBe('off');
});

it('no numbers, or no ref at all, never flags anything', () => {
  expect(parseTypical('verify with the team')).toBeNull();
  expect(parseTypical(undefined)).toBeNull();
  expect(checkRange(999, null)).toBe('ok');
  expect(rangeNote(999, undefined)).toBe('');
});

it('flags below/above but accepts the bounds themselves', () => {
  const wb = parseTypical('1530–1600 (≥1525 rule)');
  expect(checkRange(1530, wb)).toBe('ok');
  expect(checkRange(1600, wb)).toBe('ok');
  expect(checkRange(1529, wb)).toBe('low');
  expect(checkRange(2630, wb)).toBe('high');   // the mistyped-wheelbase case
  expect(checkRange(NaN, wb)).toBe('ok');      // empty input is not an error
});

it('the note names the range and stays advisory', () => {
  expect(rangeNote(2630, '1530–1600 (≥1525 rule)', 'mm'))
    .toBe('above the typical FS range (1530–1600 (≥1525 rule) mm) — fine if deliberate.');
  expect(rangeNote(1550, '1530–1600 (≥1525 rule)', 'mm')).toBe('');
});
