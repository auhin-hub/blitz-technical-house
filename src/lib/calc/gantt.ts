/**
 * Season Gantt helpers (Handoff v2 P3.4). Pure date math for the timeline; the
 * SVG rendering lives in the page. Swimlanes are the 7 technical teams; gate
 * dates (G0–G9) are user-set vertical milestones.
 */
export interface GanttTask {
  /** Stable row identity. `depends_on` points at one of these, so renaming a task
   *  no longer breaks the arrows and duplicate names no longer collide (audit P2.6).
   *  Optional on the wire: older saved state and imported CSVs carry names only. */
  id?: string;
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

let idSeq = 0;
/** A fresh task id (unique within a session and stable once saved). */
export const newTaskId = (): string => `t${Date.now().toString(36)}${(idSeq++).toString(36)}`;

/**
 * Give every task an id and migrate name-based dependencies to id-based ones.
 * Mutates in place (the page keeps the same array) and returns it. Safe to run
 * repeatedly: a `depends_on` that already matches an id is left alone, and one
 * that matches no task at all is kept verbatim so a later import can resolve it.
 */
export function ensureIds(tasks: GanttTask[]): GanttTask[] {
  for (const t of tasks) if (!t.id) t.id = newTaskId();
  const ids = new Set(tasks.map((t) => t.id!));
  const byName = new Map<string, string>();
  for (const t of tasks) { const n = (t.task ?? '').trim(); if (n && !byName.has(n)) byName.set(n, t.id!); }
  for (const t of tasks) {
    const dep = (t.depends_on ?? '').trim();
    if (!dep || ids.has(dep)) continue;
    const hit = byName.get(dep);
    if (hit && hit !== t.id) t.depends_on = hit;
  }
  return tasks;
}

/** The task a dependency points at, by id or (legacy) by name. */
export function depTarget(tasks: GanttTask[], dep: string): GanttTask | undefined {
  const d = (dep ?? '').trim();
  if (!d) return undefined;
  return tasks.find((t) => t.id === d) ?? tasks.find((t) => (t.task ?? '').trim() === d);
}

/** What to show/export for a dependency: the target's name, else the raw value. */
export function depLabel(tasks: GanttTask[], dep: string): string {
  return depTarget(tasks, dep)?.task ?? (dep ?? '').trim();
}

/** A task is overdue if its end is in the past and it isn't complete. */
export function isOverdue(t: GanttTask, todayMs: number): boolean {
  const end = parseDate(t.end);
  return Number.isFinite(end) && end < todayMs && (Number(t.percent) || 0) < 100;
}
