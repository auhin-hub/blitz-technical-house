/**
 * Spec snapshots (feature review Tier 2 #4).
 *
 * A snapshot is the whole shared design state at one moment: every Master row
 * (value, text, frozen flag and gate) plus every contributed tool output. Three
 * jobs:
 *   1. a backup, because the free tier has no automatic ones (BRIEF §J);
 *   2. a gate baseline — "this is the car we signed off at G3";
 *   3. a diff, so you can see what has moved since then.
 *
 * Restoring is deliberately narrow: it walks the differences and writes each one
 * through the normal freeze-aware path, so a restore shows up in the Change Log
 * key by key with a reason, exactly like any other edit. There is no silent
 * bulk overwrite.
 */
import { supabase } from './supabase';
import { loadMaster, editFrozenParam, setMasterValue, editFrozenText, setMasterText } from './store';
import type { SpecRow } from './master';

export interface SnapshotSpecRow {
  key: string; label: string | null; unit: string | null;
  value: number | null; text_value: string | null;
  frozen: boolean; frozen_gate: string | null; source: string | null;
}
export interface SnapshotOutputRow { tool: string; key: string; label: string | null; value: number | null; unit: string | null; }
export interface SnapshotPayload { spec: SnapshotSpecRow[]; outputs: SnapshotOutputRow[]; version: 1; }

export interface SnapshotMeta {
  id: string; label: string; note: string | null; gate: string | null;
  taken_at: string; actor_email: string | null;
}
export interface Snapshot extends SnapshotMeta { payload: SnapshotPayload; }

/** Capture the current shared state (no write). */
export async function captureState(): Promise<SnapshotPayload> {
  const rows = await loadMaster();
  const spec: SnapshotSpecRow[] = Object.values(rows).map((r: SpecRow & any) => ({
    key: r.key, label: r.label ?? null, unit: r.unit ?? null,
    value: r.value === undefined ? null : (r.value as number | null),
    text_value: (r as any).text_value ?? null,
    frozen: !!r.frozen, frozen_gate: r.frozen_gate ?? null, source: (r as any).source ?? null,
  }));
  const { data } = await supabase.from('tool_outputs').select('tool,key,label,value,unit');
  const outputs: SnapshotOutputRow[] = ((data ?? []) as any[]).map((o) => ({
    tool: o.tool, key: o.key, label: o.label ?? null,
    value: o.value === null || o.value === undefined ? null : Number(o.value), unit: o.unit ?? null,
  }));
  return { spec, outputs, version: 1 };
}

/** Take and store a snapshot. Returns its id, or an error message. */
export async function takeSnapshot(label: string, note?: string, gate?: string): Promise<{ id: string | null; error: string | null }> {
  const payload = await captureState();
  if (!payload.spec.length) return { id: null, error: 'Nothing to snapshot — the Master did not load.' };
  const { data, error } = await supabase
    .from('spec_snapshots')
    .insert({ label, note: note ?? null, gate: gate ?? null, payload })
    .select('id')
    .maybeSingle();
  return { id: (data as any)?.id ?? null, error: error ? error.message : null };
}

/** Snapshot list, newest first (metadata only — payloads can be large). */
export async function loadSnapshots(limit = 50): Promise<SnapshotMeta[]> {
  const { data, error } = await supabase
    .from('spec_snapshots').select('id,label,note,gate,taken_at,actor_email')
    .order('taken_at', { ascending: false }).limit(limit);
  return error || !data ? [] : (data as SnapshotMeta[]);
}

export async function loadSnapshot(id: string): Promise<Snapshot | null> {
  const { data, error } = await supabase
    .from('spec_snapshots').select('id,label,note,gate,taken_at,actor_email,payload')
    .eq('id', id).maybeSingle();
  return error || !data ? null : (data as Snapshot);
}

/** Lead-only (RLS enforces it). */
export async function deleteSnapshot(id: string): Promise<string | null> {
  const { error } = await supabase.from('spec_snapshots').delete().eq('id', id);
  return error ? error.message : null;
}

export type DiffKind = 'changed' | 'added' | 'removed' | 'froze' | 'thawed';
export interface DiffRow {
  key: string; label: string; kind: DiffKind;
  then: number | string | null; now: number | string | null;
  frozenNow: boolean;
}

/**
 * What has moved since a snapshot. `added` = a key that exists now but not then;
 * `removed` = the other way round (a key retired from the seed).
 */
export async function diffAgainstNow(snap: SnapshotPayload): Promise<DiffRow[]> {
  const nowRows = await loadMaster();
  const then = new Map(snap.spec.map((r) => [r.key, r]));
  const out: DiffRow[] = [];

  for (const [key, r] of Object.entries(nowRows)) {
    const t = then.get(key);
    const label = (r as any).label ?? key;
    const nowVal = (r as any).text_value ?? (r.value ?? null);
    if (!t) { out.push({ key, label, kind: 'added', then: null, now: nowVal, frozenNow: !!r.frozen }); continue; }
    const thenVal = t.text_value ?? (t.value ?? null);
    const valueMoved = String(thenVal ?? '') !== String(nowVal ?? '');
    if (valueMoved) out.push({ key, label, kind: 'changed', then: thenVal, now: nowVal, frozenNow: !!r.frozen });
    else if (t.frozen !== !!r.frozen) {
      out.push({ key, label, kind: r.frozen ? 'froze' : 'thawed', then: thenVal, now: nowVal, frozenNow: !!r.frozen });
    }
  }
  for (const [key, t] of then) {
    if (!nowRows[key]) out.push({ key, label: t.label ?? key, kind: 'removed', then: t.text_value ?? (t.value ?? null), now: null, frozenNow: false });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Write a snapshot's values back, key by key, through the freeze-aware path so
 * every one lands in the Change Log with a reason. Only `changed` rows are
 * touched — never freeze flags, and never keys the snapshot does not know.
 * Returns per-key errors (empty means all applied).
 */
export async function restoreSnapshot(
  snap: Snapshot,
  keys?: string[],
): Promise<{ applied: number; errors: { key: string; error: string }[] }> {
  const diff = (await diffAgainstNow(snap.payload)).filter((d) => d.kind === 'changed');
  const wanted = keys ? diff.filter((d) => keys.includes(d.key)) : diff;
  const reason = `Restored from snapshot "${snap.label}" (${new Date(snap.taken_at).toLocaleString()})`;
  const errors: { key: string; error: string }[] = [];
  let applied = 0;

  const nowRows = await loadMaster();
  for (const d of wanted) {
    const t = snap.payload.spec.find((r) => r.key === d.key)!;
    const frozen = !!nowRows[d.key]?.frozen;
    let err: string | null = null;
    if (t.text_value != null) {
      err = frozen ? await editFrozenText(d.key, t.text_value, reason) : await setMasterText(d.key, t.text_value);
    } else if (t.value != null && Number.isFinite(Number(t.value))) {
      err = frozen ? await editFrozenParam(d.key, Number(t.value), reason) : await setMasterValue(d.key, Number(t.value));
    } else {
      continue;   // the snapshot had no value for this key; leave the live one alone
    }
    if (err) errors.push({ key: d.key, error: err }); else applied++;
  }
  return { applied, errors };
}

/** A snapshot as CSV, for the Excel archive. */
export function snapshotCsv(snap: Snapshot): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = ['section,key,label,unit,value,text_value,frozen,frozen_gate,source'];
  for (const r of snap.payload.spec) {
    lines.push(['spec', r.key, r.label, r.unit, r.value, r.text_value, r.frozen, r.frozen_gate, r.source].map(esc).join(','));
  }
  for (const o of snap.payload.outputs) {
    lines.push(['output', o.key, o.label, o.unit, o.value, '', '', '', o.tool].map(esc).join(','));
  }
  return lines.join('\r\n');
}
