/**
 * FS points predictor (Handoff v2 P3.5). The time-based dynamic events use the
 * published relative formula:
 *   points = P_max · (T_max/T_team − 1) / (T_max/T_min − 1),  clamped [0, P_max]
 * (0 at or beyond T_max, P_max at T_min). Efficiency and the static events are
 * entered as judged/estimated scores (capped at their P_max) — the exact 2026
 * efficiency formula and the FS-UK ceilings must be verified against the current
 * rulebook, so they are editable inputs, not hard-coded. The formula is exact;
 * the ceilings are user-confirmable defaults.
 */
export type EventKind = 'time' | 'score';
export interface EventDef { key: string; label: string; kind: EventKind; pMax: number; }

/** Relative time-based event score. */
export function relativePoints(pMax: number, tTeam: number, tMin: number, tMax: number): number {
  if (![pMax, tTeam, tMin, tMax].every((x) => Number.isFinite(x)) || tTeam <= 0 || tMin <= 0 || tMax <= tMin) return NaN;
  if (tTeam >= tMax) return 0;
  const s = pMax * (tMax / tTeam - 1) / (tMax / tMin - 1);
  return Math.max(0, Math.min(pMax, s));
}

/** Default 2026 allocations. Japan = the standard FSAE 1000-pt combustion split.
 *  FS-UK defaults mirror it as a working placeholder — ⚖ verify + edit per the
 *  current IMechE rules. */
export const COMPETITIONS: Record<string, { label: string; verify?: string; events: EventDef[] }> = {
  japan: {
    label: 'FS Japan 2026',
    events: [
      { key: 'accel', label: 'Acceleration', kind: 'time', pMax: 75 },
      { key: 'skidpad', label: 'Skidpad', kind: 'time', pMax: 75 },
      { key: 'autocross', label: 'Autocross', kind: 'time', pMax: 125 },
      { key: 'endurance', label: 'Endurance', kind: 'time', pMax: 300 },
      { key: 'efficiency', label: 'Efficiency', kind: 'score', pMax: 100 },
      { key: 'design', label: 'Design', kind: 'score', pMax: 150 },
      { key: 'cost', label: 'Cost', kind: 'score', pMax: 100 },
      { key: 'business', label: 'Business', kind: 'score', pMax: 75 },
    ],
  },
  uk: {
    label: 'FS UK 2026',
    verify: '⚖ FS-UK ceilings vary year to year (IMechE) — verify and edit against the 2026 rules.',
    events: [
      { key: 'accel', label: 'Acceleration', kind: 'time', pMax: 75 },
      { key: 'skidpad', label: 'Skidpad', kind: 'time', pMax: 75 },
      { key: 'autocross', label: 'Sprint (autocross)', kind: 'time', pMax: 125 },
      { key: 'endurance', label: 'Endurance', kind: 'time', pMax: 300 },
      { key: 'efficiency', label: 'Efficiency', kind: 'score', pMax: 100 },
      { key: 'design', label: 'Design', kind: 'score', pMax: 150 },
      { key: 'cost', label: 'Cost', kind: 'score', pMax: 100 },
      { key: 'business', label: 'Business', kind: 'score', pMax: 75 },
    ],
  },
};
