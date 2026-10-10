/** Team budget rollups + alarms (Handoff v2 P3.3). */
import { it, expect } from 'vitest';
import { alarmFor, teamRollups, totals, topOvershoots, type BudgetRow } from './budget';

it('alarm thresholds: ok <90%, amber ≥90%, red ≥100%', () => {
  expect(alarmFor(100, 50)).toBe('ok');
  expect(alarmFor(100, 90)).toBe('amber');
  expect(alarmFor(100, 100)).toBe('red');
  expect(alarmFor(0, 10)).toBe('red');   // spend with no plan
});

const rows: BudgetRow[] = [
  { item: 'Dampers', subassembly: 'Corner', team: 'VD', category: 'Parts', planned: 1000, actual: 1200, status: '', date: '', notes: '' },
  { item: 'Uprights', subassembly: 'Corner', team: 'VD', category: 'Mfg', planned: 500, actual: 300, status: '', date: '', notes: '' },
  { item: 'Wing', subassembly: 'Front', team: 'Aero', category: 'Parts', planned: 800, actual: 700, status: '', date: '', notes: '' },
];

it('team rollups sum only that team and flag over-plan', () => {
  const r = teamRollups(rows);
  const vd = r.find((x) => x.key === 'VD')!;
  expect(vd.planned).toBe(1500); expect(vd.actual).toBe(1500); expect(vd.alarm).toBe('red'); // 100%
  const aero = r.find((x) => x.key === 'Aero')!;
  expect(aero.actual).toBe(700); expect(aero.alarm).toBe('ok');
});

it('totals + top overshoots', () => {
  expect(totals(rows).variance).toBe(-100);          // 2200 actual − 2300 planned
  expect(topOvershoots(rows)[0]).toEqual({ item: 'Dampers', team: 'VD', over: 200 });
});
