/**
 * Season Gantt helpers (Handoff v2 P3.4). Pure date math for the timeline; the
 * SVG rendering lives in the page. Swimlanes are the 7 technical teams; gate
 * dates (G0–G9) are user-set vertical milestones.
 */
export interface GanttTask {
  task: string; team: string; owner: string; start: string; end: string;
  depends_on: string; gate: string; status: string; percent: number | null; masterKey?: string;
}

export const TECH_TEAMS = ['VD', 'Chassis', 'Aero', 'Ergonomics', 'Powertrain', 'ECS', 'Brake'];

export const parseDate = (s: string): number => { const t = Date.parse((s ?? '').trim()); return Number.isFinite(t) ? t : NaN; };
export const DAY = 86400000;

/** Min/max epoch-ms across task starts/ends, gate dates and today. */
export function bounds(tasks: GanttTask[], gateDates: Record<string, string>, todayMs: number): { min: number; max: number } {
  const xs: number[] = [todayMs];
  for (const t of tasks) { const a = parseDate(t.start), b = parseDate(t.end); if (Number.isFinite(a)) xs.push(a); if (Number.isFinite(b)) xs.push(b); }
  for (const d of Object.values(gateDates)) { const g = parseDate(d); if (Number.isFinite(g)) xs.push(g); }
  let min = Math.min(...xs), max = Math.max(...xs);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) { min = todayMs - 30 * DAY; max = todayMs + 60 * DAY; }
  return { min: min - 3 * DAY, max: max + 3 * DAY };
}

/** A task is overdue if its end is in the past and it isn't complete. */
export function isOverdue(t: GanttTask, todayMs: number): boolean {
  const end = parseDate(t.end);
  return Number.isFinite(end) && end < todayMs && (Number(t.percent) || 0) < 100;
}
