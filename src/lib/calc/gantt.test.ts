/** Season Gantt date math (Handoff v2 P3.4). */
import { it, expect } from 'vitest';
import { parseDate, bounds, isOverdue, type GanttTask } from './gantt';

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

it('overdue when end past and <100%', () => {
  const today = Date.parse('2026-04-10');
  expect(isOverdue(mk('2026-03-01', '2026-04-01', 50), today)).toBe(true);
  expect(isOverdue(mk('2026-03-01', '2026-04-01', 100), today)).toBe(false);
  expect(isOverdue(mk('2026-03-01', '2026-04-20', 0), today)).toBe(false);
});
