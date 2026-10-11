/** Season Gantt date math (Handoff v2 P3.4). */
import { it, expect } from 'vitest';
import { parseDate, bounds, isOverdue, ensureIds, depTarget, depLabel, type GanttTask } from './gantt';

const mk = (start: string, end: string, percent = 0): GanttTask => ({ task: 't', team: 'VD', owner: '', start, end, depends_on: '', gate: '', status: '', percent });

it('parses ISO dates, NaN otherwise', () => {
  expect(parseDate('2026-03-01')).toBe(Date.parse('2026-03-01'));
  expect(Number.isNaN(parseDate('nope'))).toBe(true);
});

it('bounds span tasks, gates and today with padding', () => {
  const today = Date.parse('2026-04-01');
  const b = bounds([mk('2026-03-01', '2026-03-20')], { G3: '2026-05-01' }, today);
  expect(b.min).toBeLessThanOrEqual(Date.parse('2026-03-01'));
  expect(b.max).toBeGreaterThanOrEqual(Date.parse('2026-05-01'));
});

it('migrates name-based dependencies to ids and survives a rename (P2.6)', () => {
  const named = (task: string, depends_on = ''): GanttTask =>
    ({ task, team: 'VD', owner: '', start: '', end: '', depends_on, gate: '', status: '', percent: 0 });
  const tasks = ensureIds([named('CAD freeze'), named('Manufacture', 'CAD freeze')]);
  expect(tasks[0].id).toBeTruthy();
  expect(tasks[1].depends_on).toBe(tasks[0].id);        // name resolved to an id
  expect(depLabel(tasks, tasks[1].depends_on)).toBe('CAD freeze');
  tasks[0].task = 'CAD freeze v2';                      // rename the upstream task
  expect(depTarget(tasks, tasks[1].depends_on)).toBe(tasks[0]);   // link still holds
  expect(depLabel(tasks, tasks[1].depends_on)).toBe('CAD freeze v2');
});

it('duplicate task names get distinct ids and a dangling dep is kept verbatim', () => {
  const named = (task: string, depends_on = ''): GanttTask =>
    ({ task, team: 'VD', owner: '', start: '', end: '', depends_on, gate: '', status: '', percent: 0 });
  const tasks = ensureIds([named('Review'), named('Review'), named('Ship', 'Nothing here')]);
  expect(tasks[0].id).not.toBe(tasks[1].id);
  expect(tasks[2].depends_on).toBe('Nothing here');
  expect(depTarget(tasks, tasks[2].depends_on)).toBeUndefined();
});

it('overdue when end past and <100%', () => {
  const today = Date.parse('2026-04-10');
  expect(isOverdue(mk('2026-03-01', '2026-04-01', 50), today)).toBe(true);
  expect(isOverdue(mk('2026-03-01', '2026-04-01', 100), today)).toBe(false);
  expect(isOverdue(mk('2026-03-01', '2026-04-20', 0), today)).toBe(false);
});
