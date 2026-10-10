/** CSV read/write (handoff P1.5). */
import { it, expect } from 'vitest';
import { toCsv, parseCsv, missingColumns } from './csv';

it('serialises headers + rows with BOM and CRLF', () => {
  const out = toCsv(['a', 'b'], [[1, 2], ['x', 'y']]);
  expect(out.startsWith('﻿')).toBe(true);
  expect(out).toContain('a,b\r\n');
  expect(out).toContain('1,2\r\n');
});

it('escapes commas, quotes and newlines', () => {
  const out = toCsv(['name', 'note'], [['a,b', 'he said "hi"'], ['line1\nline2', 'ok']]);
  expect(out).toContain('"a,b"');
  expect(out).toContain('"he said ""hi"""');
  expect(out).toContain('"line1\nline2"');
});

it('round-trips through parse', () => {
  const headers = ['component', 'mass_kg', 'note'];
  const rows = [['Upright', '2.4', 'a,b'], ['Hub', '1.1', 'say "hi"']];
  const parsed = parseCsv(toCsv(headers, rows));
  expect(parsed.headers).toEqual(headers);
  expect(parsed.rows).toEqual(rows);
});

it('trims headers, skips blank lines, handles CRLF and a missing trailing newline', () => {
  const p = parseCsv(' a , b \r\n1,2\r\n\r\n3,4');
  expect(p.headers).toEqual(['a', 'b']);
  expect(p.rows).toEqual([['1', '2'], ['3', '4']]);
});

it('reports missing required columns (order-independent)', () => {
  expect(missingColumns(['b', 'a'], ['a', 'b'])).toEqual([]);
  expect(missingColumns(['component'], ['component', 'mass_kg'])).toEqual(['mass_kg']);
});
