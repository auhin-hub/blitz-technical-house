/**
 * Team budget rollups + alarms (Handoff v2 P3.3). Pure. Money here is team budget
 * (planned vs actual), distinct from the FSAE Cost report. Alarms: amber at ≥90%
 * of plan, red at ≥100%. Rollups are by team (the graphs are generated per team).
 */
export type Alarm = 'ok' | 'amber' | 'red';
export interface BudgetRow {
  item: string; subassembly: string; team: string; category: string;
  planned: number | null; actual: number | null; status: string; date: string; notes: string;
  committed?: boolean;
}
export interface Rollup { key: string; planned: number; actual: number; variance: number; pct: number; alarm: Alarm; }

export function alarmFor(planned: number, actual: number): Alarm {
  if (!(planned > 0)) return actual > 0 ? 'red' : 'ok';
  const r = actual / planned;
  return r >= 1 ? 'red' : r >= 0.9 ? 'amber' : 'ok';
}

const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function rollupBy(rows: BudgetRow[], keyOf: (r: BudgetRow) => string): Rollup[] {
  const m: Record<string, { planned: number; actual: number }> = {};
  for (const r of rows) { const k = keyOf(r) || '—'; (m[k] ||= { planned: 0, actual: 0 }); m[k].planned += n(r.planned); m[k].actual += n(r.actual); }
  return Object.entries(m).map(([key, v]) => ({
    key, planned: v.planned, actual: v.actual, variance: v.actual - v.planned,
    pct: v.planned > 0 ? (v.actual / v.planned) * 100 : (v.actual > 0 ? Infinity : 0), alarm: alarmFor(v.planned, v.actual),
  })).sort((a, b) => a.key.localeCompare(b.key));
}

export const teamRollups = (rows: BudgetRow[]) => rollupBy(rows, (r) => r.team);

export function totals(rows: BudgetRow[]): Rollup {
  const planned = rows.reduce((s, r) => s + n(r.planned), 0);
  const actual = rows.reduce((s, r) => s + n(r.actual), 0);
  return { key: 'TOTAL', planned, actual, variance: actual - planned, pct: planned > 0 ? (actual / planned) * 100 : 0, alarm: alarmFor(planned, actual) };
}

export function topOvershoots(rows: BudgetRow[], count = 5): { item: string; team: string; over: number }[] {
  return rows.map((r) => ({ item: r.item, team: r.team, over: n(r.actual) - n(r.planned) }))
    .filter((r) => r.over > 0).sort((a, b) => b.over - a.over).slice(0, count);
}
