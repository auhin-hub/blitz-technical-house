/**
 * Component Readiness logic (Handoff v2 P4). Each component has prerequisites;
 * each prerequisite resolves to a Master key (master/rules/procurement) or a
 * tool_output key. Status reuses the P1.4 freeze mechanic:
 *   grey  = source not set
 *   amber = set but not frozen (Master), or a contributed tool_output whose own
 *           upstream Master keys are still unset/unfrozen (audit P2.4) — the number
 *           exists but the ground under it can still move
 *   green = frozen (Master key) / contributed off frozen upstream (tool_output)
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

/** Is a Master cell populated at all (number or text)? */
function masterSet(row: MasterCell | undefined): boolean {
  if (!row) return false;
  return (row.value !== null && row.value !== undefined && Number.isFinite(Number(row.value)))
    || (row.text_value != null && String(row.text_value).trim() !== '');
}

/**
 * The Master keys a tool_output's formula depends on, so a contributed output can
 * be shown amber while they float. Injected by the caller from TOOL_OUTPUT_KEYS
 * (keeps this module pure and free of config imports).
 */
export type UpstreamMap = Record<string, string[] | undefined>;

/** Upstream keys that are not yet frozen (unset counts as not frozen). */
export function unfrozenUpstream(key: string, master: Record<string, MasterCell>, upstream: UpstreamMap = {}): string[] {
  return (upstream[key] ?? []).filter((k) => { const row = master[k]; return !masterSet(row) || !row!.frozen; });
}

export function prereqStatus(p: Prereq, master: Record<string, MasterCell>, outputs: Record<string, { value: number | null }>, upstream: UpstreamMap = {}): Status {
  if (isMasterType(p.source_type)) {
    const row = master[p.source_key];
    if (!row) return 'grey';
    if (!masterSet(row)) return 'grey';
    return row.frozen ? 'green' : 'amber';
  }
  const o = outputs[p.source_key];
  const contributed = !!o && o.value !== null && o.value !== undefined && Number.isFinite(Number(o.value));
  if (!contributed) return 'grey';
  return unfrozenUpstream(p.source_key, master, upstream).length ? 'amber' : 'green';
}

export interface ComponentReadiness {
  ready: boolean;
  blockingTotal: number;
  blockingGreen: number;
  pending: { label: string; team: string; source_key: string; status: Status }[];
  statuses: { prereq: Prereq; status: Status }[];
}

export function componentReadiness(c: Component, master: Record<string, MasterCell>, outputs: Record<string, { value: number | null }>, upstream: UpstreamMap = {}): ComponentReadiness {
  const statuses = c.prereqs.map((p) => ({ prereq: p, status: prereqStatus(p, master, outputs, upstream) }));
  const blocking = statuses.filter((s) => s.prereq.bin === 'blocking');
  const blockingGreen = blocking.filter((s) => s.status === 'green').length;
  const pending = blocking.filter((s) => s.status !== 'green').map((s) => ({ label: s.prereq.label, team: s.prereq.produced_by_team, source_key: s.prereq.source_key, status: s.status }));
  return { ready: blocking.length > 0 ? pending.length === 0 : true, blockingTotal: blocking.length, blockingGreen, pending, statuses };
}

/** Which unfrozen/unset source gates the most components (team-lead's top lever). */
export function blockingSummary(components: Component[], master: Record<string, MasterCell>, outputs: Record<string, { value: number | null }>, upstream: UpstreamMap = {}): { source_key: string; team: string; count: number }[] {
  const tally: Record<string, { team: string; count: number }> = {};
  for (const c of components) {
    for (const p of c.prereqs) {
      if (p.bin !== 'blocking') continue;
      if (prereqStatus(p, master, outputs, upstream) === 'green') continue;
      const t = (tally[p.source_key] ||= { team: p.produced_by_team, count: 0 });
      t.count++;
    }
  }
  return Object.entries(tally).map(([source_key, v]) => ({ source_key, team: v.team, count: v.count })).sort((a, b) => b.count - a.count);
}
