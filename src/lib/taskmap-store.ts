/**
 * Task Map data access (migration 0013).
 *
 * The map is shared state like everything else: one programme, every member
 * sees the same thing. This module only moves rows; all graph reasoning lives in
 * `lib/calc/taskmap.ts` so it stays pure and tested.
 *
 * Seeding reads `public/data/taskmap-seed.json` and upserts in batches — no SQL
 * for the team to run, and re-runnable, so "reset to the seed" is a button.
 */
import { supabase } from './supabase';
import { url } from './config';
import {
  seedToRows,
  type Activity, type Bucket, type Dependency, type Loop, type Phase,
  type SeedFile, type SeedRows, type ActivityStatus,
} from './calc/taskmap';

export interface TaskmapData {
  buckets: Bucket[];
  phases: Phase[];
  loops: Loop[];
  activities: Activity[];
  dependencies: Dependency[];
  /** Set when a table is missing, i.e. migration 0013 has not been run. */
  error: string | null;
}

const EMPTY: TaskmapData = { buckets: [], phases: [], loops: [], activities: [], dependencies: [], error: null };

const ACTIVITY_COLS =
  'code,bucket_key,phase_key,title,owner_role,accountable,contributor_keys,loop_keys,'
  + 'is_critical,why,done_when,tools,rules,tasks,pitfalls,external_inputs,display_order,'
  + 'status,percent,owner_user_id,notes,tool_href,updated_at';

/** Load the whole map. One round trip per table, in parallel. */
export async function loadTaskmap(): Promise<TaskmapData> {
  const [b, p, l, a, d] = await Promise.all([
    supabase.from('taskmap_buckets').select('key,name,scope,color,kind,display_order').order('display_order'),
    supabase.from('taskmap_phases').select('key,idx,name,subtitle,is_gate,gate_key,display_order').order('idx'),
    supabase.from('taskmap_loops').select('key,name,color,description,display_order').order('display_order'),
    supabase.from('taskmap_activities').select(ACTIVITY_COLS).order('display_order'),
    supabase.from('taskmap_dependencies').select('id,from_code,to_code,label,is_feedback'),
  ]);

  const firstError = [b, p, l, a, d].find((r) => r.error)?.error;
  if (firstError) {
    const missing = /relation .* does not exist|schema cache|42P01/i.test(firstError.message);
    return {
      ...EMPTY,
      error: missing
        ? 'Task Map tables not found — run migration 0013_taskmap.sql in the Supabase SQL editor.'
        : firstError.message,
    };
  }

  return {
    buckets: (b.data ?? []) as Bucket[],
    phases: (p.data ?? []) as Phase[],
    loops: (l.data ?? []) as Loop[],
    activities: (a.data ?? []) as unknown as Activity[],
    dependencies: (d.data ?? []) as Dependency[],
    error: null,
  };
}

/** Fetch and normalise the shipped seed file. */
export async function fetchSeed(): Promise<SeedRows> {
  const res = await fetch(url('data/taskmap-seed.json'));
  if (!res.ok) throw new Error(`seed file unavailable (HTTP ${res.status})`);
  return seedToRows((await res.json()) as SeedFile);
}

/** Upsert in chunks: ~500 seed rows would be a single oversized request. */
async function upsertChunked<T>(table: string, rows: T[], conflict: string, size = 100): Promise<string | null> {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + size) as any, { onConflict: conflict });
    if (error) return `${table}: ${error.message}`;
  }
  return null;
}

export interface SeedResult { error: string | null; counts: Record<string, number> }

/**
 * Load the seed into the database.
 *
 * `mode: 'fill'` adds what is missing and refreshes the descriptive columns,
 * **keeping every status, owner and note** — the normal way to pick up an updated
 * map without losing where the team has got to.
 *
 * `mode: 'reset'` deletes the activities first, so progress goes with them. The
 * page asks twice before calling it.
 */
export async function seedTaskmap(mode: 'fill' | 'reset' = 'fill'): Promise<SeedResult> {
  let rows: SeedRows;
  try { rows = await fetchSeed(); } catch (e) { return { error: (e as Error).message, counts: {} }; }

  if (mode === 'reset') {
    // Dependencies cascade from activities, so one delete is enough.
    const { error } = await supabase.from('taskmap_activities').delete().neq('code', '');
    if (error) return { error: `clearing activities: ${error.message}`, counts: {} };
  }

  // Structure first: activities reference buckets and phases.
  //
  // `gate_key` is deliberately not sent: a lead sets it, so it is live state and
  // a "fill" that nulled it would break the promise this mode makes.
  const phaseRows = rows.phases.map(({ gate_key, ...rest }) => rest);
  for (const [table, data, conflict] of [
    ['taskmap_buckets', rows.buckets, 'key'],
    ['taskmap_phases', phaseRows, 'key'],
    ['taskmap_loops', rows.loops, 'key'],
  ] as const) {
    const err = await upsertChunked(table, data as any[], conflict);
    if (err) return { error: err, counts: {} };
  }

  // Activities: never overwrite live state, so only the descriptive columns go.
  const descriptive = rows.activities.map((a) => ({
    code: a.code, bucket_key: a.bucket_key, phase_key: a.phase_key, title: a.title,
    owner_role: a.owner_role, accountable: a.accountable,
    contributor_keys: a.contributor_keys, loop_keys: a.loop_keys,
    is_critical: a.is_critical, why: a.why, done_when: a.done_when,
    tools: a.tools, rules: a.rules, tasks: a.tasks, pitfalls: a.pitfalls,
    external_inputs: a.external_inputs, display_order: a.display_order,
  }));
  const aErr = await upsertChunked('taskmap_activities', descriptive, 'code');
  if (aErr) return { error: aErr, counts: {} };

  const dErr = await upsertChunked('taskmap_dependencies', rows.dependencies, 'from_code,to_code,label');
  if (dErr) return { error: dErr, counts: {} };

  return {
    error: null,
    counts: {
      buckets: rows.buckets.length, phases: rows.phases.length, loops: rows.loops.length,
      activities: rows.activities.length, dependencies: rows.dependencies.length,
    },
  };
}

/** Update one activity's live state. */
export async function setActivityState(
  code: string,
  patch: { status?: ActivityStatus; percent?: number | null; owner_user_id?: string | null; notes?: string | null; tool_href?: string | null },
): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('taskmap_activities')
    .update({ ...patch, updated_by: u.user?.id ?? null })
    .eq('code', code);
  return error ? error.message : null;
}

/** Edit an activity's descriptive fields (any member may). */
export async function updateActivity(code: string, patch: Partial<Activity>): Promise<string | null> {
  const { error } = await supabase.from('taskmap_activities').update(patch as any).eq('code', code);
  return error ? error.message : null;
}

export async function createActivity(a: Activity): Promise<string | null> {
  const { error } = await supabase.from('taskmap_activities').insert(a as any);
  return error ? error.message : null;
}

export async function deleteActivity(code: string): Promise<string | null> {
  const { error } = await supabase.from('taskmap_activities').delete().eq('code', code);
  return error ? error.message : null;
}

export async function addDependency(d: Dependency): Promise<string | null> {
  const { error } = await supabase.from('taskmap_dependencies').insert({
    from_code: d.from_code, to_code: d.to_code, label: (d.label ?? '').trim(), is_feedback: !!d.is_feedback,
  });
  if (!error) return null;
  if (error.code === '23505') return 'That hand-off already exists.';
  if (error.code === '23514') return 'An activity cannot depend on itself.';
  return error.message;
}

export async function deleteDependency(id: string): Promise<string | null> {
  const { error } = await supabase.from('taskmap_dependencies').delete().eq('id', id);
  return error ? error.message : null;
}

/** Point a phase at a real gate (G0–G9), or clear it. */
export async function setPhaseGate(phaseKey: string, gateKey: string | null): Promise<string | null> {
  const { error } = await supabase.from('taskmap_phases').update({ gate_key: gateKey }).eq('key', phaseKey);
  return error ? error.message : null;
}
