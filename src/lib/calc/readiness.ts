/**
 * Component Readiness logic (Handoff v2 P4). Each component has prerequisites;
 * each prerequisite resolves to a Master key (master/rules/procurement) or a
 * tool_output key. Status reuses the P1.4 freeze mechanic:
 *   grey  = source not set
 *   amber = set but not frozen (Master) — a tool_output with no freeze concept
 *           is green once contributed
 *   green = frozen (Master key) / contributed (tool_output)
 * A component is "Ready to start" only when every BLOCKING prerequisite is green.
 * Pure — the page supplies the live Master rows + tool_outputs map.
 */
export type Bin = 'blocking' | 'soft';
export type SourceType = 'master' | 'tool_output' | 'rules' | 'procurement';
export type Status = 'grey' | 'amber' | 'green';

export interface Prereq {
  label: string;
  bin: Bin;
  source_type: SourceType;
  source_key: string;
  produced_by_team: string;
}
export interface Component {
  name: string;
  owner_team: string;
  subassembly: string;
  prereqs: Prereq[];
}

/** A minimal view of a vehicle_spec row for status resolution. */
export interface MasterCell { value: number | null; text_value?: string | null; frozen: boolean; }

const isMasterType = (t: SourceType) => t === 'master' || t === 'rules' || t === 'procurement';

export function prereqStatus(p: Prereq, master: Record<string, MasterCell>, outputs: Record<string, { value: number | null }>): Status {
  if (isMasterType(p.source_type)) {
    const row = master[p.source_key];
    if (!row) return 'grey';
    const hasVal = (row.value !== null && row.value !== undefined && Number.isFinite(Number(row.value)))
      || (row.text_value != null && String(row.text_value).trim() !== '');
    if (!hasVal) return 'grey';
    return row.frozen ? 'green' : 'amber';
  }
  const o = outputs[p.source_key];
  return o && o.value !== null && o.value !== undefined && Number.isFinite(Number(o.value)) ? 'green' : 'grey';
}

export interface ComponentReadiness {
  ready: boolean;
  blockingTotal: number;
  blockingGreen: number;
  pending: { label: string; team: string; source_key: string; status: Status }[];
  statuses: { prereq: Prereq; status: Status }[];
}

export function componentReadiness(c: Component, master: Record<string, MasterCell>, outputs: Record<string, { value: number | null }>): ComponentReadiness {
  const statuses = c.prereqs.map((p) => ({ prereq: p, status: prereqStatus(p, master, outputs) }));
  const blocking = statuses.filter((s) => s.prereq.bin === 'blocking');
  const blockingGreen = blocking.filter((s) => s.status === 'green').length;
  const pending = blocking.filter((s) => s.status !== 'green').map((s) => ({ label: s.prereq.label, team: s.prereq.produced_by_team, source_key: s.prereq.source_key, status: s.status }));
  return { ready: blocking.length > 0 ? pending.length === 0 : true, blockingTotal: blocking.length, blockingGreen, pending, statuses };
}

/** Which unfrozen/unset source gates the most components (team-lead's top lever). */
export function blockingSummary(components: Component[], master: Record<string, MasterCell>, outputs: Record<string, { value: number | null }>): { source_key: string; team: string; count: number }[] {
  const tally: Record<string, { team: string; count: number }> = {};
  for (const c of components) {
    for (const p of c.prereqs) {
      if (p.bin !== 'blocking') continue;
      if (prereqStatus(p, master, outputs) === 'green') continue;
      const t = (tally[p.source_key] ||= { team: p.produced_by_team, count: 0 });
      t.count++;
    }
  }
  return Object.entries(tally).map(([source_key, v]) => ({ source_key, team: v.team, count: v.count })).sort((a, b) => b.count - a.count);
}
