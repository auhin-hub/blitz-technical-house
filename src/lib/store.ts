/**
 * Client-side data access for the shared stores (browser islands only).
 * Thin wrappers over Supabase so every calculator reads/writes the Master and
 * its own shared tool state the same way. RLS means an un-authed call returns
 * nothing rather than leaking data.
 */
import { supabase } from './supabase';
import type { SpecRow } from './master';

/** Load the whole Master, keyed by parameter key. Empty object if not signed in. */
export async function loadMaster(): Promise<Record<string, SpecRow>> {
  const { data, error } = await supabase
    .from('vehicle_spec')
    .select('key,label,symbol,unit,value,source,confidence,frozen,frozen_gate,updated_at')
    .order('display_order', { ascending: true });
  const out: Record<string, SpecRow> = {};
  if (error || !data) return out;
  for (const r of data as any[]) out[r.key] = r as SpecRow;
  return out;
}

/** Update one Master value. Returns an error message, or null on success. */
export async function setMasterValue(key: string, value: number): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('vehicle_spec')
    .update({ value, updated_by: u.user?.id ?? null })
    .eq('key', key);
  return error ? error.message : null;
}

/** Load a tool's shared editable inputs. Falls back to the given defaults. */
export async function loadToolState(
  tool: string,
  defaults: Record<string, number>,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('tool_state')
    .select('data')
    .eq('tool', tool)
    .maybeSingle();
  if (error || !data || !data.data) return { ...defaults };
  return { ...defaults, ...(data.data as Record<string, number>) };
}

/** Upsert a tool's shared editable inputs. */
export async function saveToolState(
  tool: string,
  data: Record<string, number>,
): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('tool_state')
    .upsert({ tool, data, updated_by: u.user?.id ?? null }, { onConflict: 'tool' });
  return error ? error.message : null;
}

/** Change a FROZEN parameter through the enforced, change-logged path (BRIEF §E5). */
export async function editFrozenParam(key: string, value: number, reason: string): Promise<string | null> {
  const { error } = await supabase.rpc('edit_param', { p_key: key, p_value: value, p_reason: reason });
  return error ? error.message : null;
}

/** Freeze / unfreeze a parameter at a gate (logged by trigger). */
export async function setFrozen(key: string, frozen: boolean, gate: string | null): Promise<string | null> {
  const { error } = await supabase
    .from('vehicle_spec')
    .update({ frozen, frozen_gate: frozen ? gate : null })
    .eq('key', key);
  return error ? error.message : null;
}

export interface Gate {
  id: string; name: string; status: 'open' | 'in_review' | 'signed_off';
  signed_off_by: string | null; signed_off_email: string | null;
  signed_off_at: string | null; notes: string | null; display_order: number;
}

export async function loadGates(): Promise<Gate[]> {
  const { data, error } = await supabase.from('gates').select('*').order('display_order', { ascending: true });
  return error || !data ? [] : (data as Gate[]);
}

export async function setGateStatus(id: string, status: Gate['status']): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  const patch: Record<string, unknown> = { status };
  if (status === 'signed_off') {
    patch.signed_off_by = u.user?.id ?? null;
    patch.signed_off_email = u.user?.email ?? null;
    patch.signed_off_at = new Date().toISOString();
  } else {
    patch.signed_off_by = null; patch.signed_off_email = null; patch.signed_off_at = null;
  }
  const { error } = await supabase.from('gates').update(patch).eq('id', id);
  return error ? error.message : null;
}

export interface ChangeLogRow {
  id: number; param_key: string | null; field: string;
  old_value: string | null; new_value: string | null; reason: string | null;
  actor_email: string | null; changed_at: string;
}

export async function loadChangeLog(limit = 200): Promise<ChangeLogRow[]> {
  const { data, error } = await supabase
    .from('change_log').select('*').order('changed_at', { ascending: false }).limit(limit);
  return error || !data ? [] : (data as ChangeLogRow[]);
}

/** Latest contributed outputs, keyed by their key (for the Dashboard). */
export async function loadToolOutputsMap(): Promise<Record<string, { value: number | null; unit: string | null; label: string | null }>> {
  const { data, error } = await supabase
    .from('tool_outputs').select('key,value,unit,label,updated_at').order('updated_at', { ascending: true });
  const out: Record<string, { value: number | null; unit: string | null; label: string | null }> = {};
  if (!error && data) for (const r of data as any[]) out[r.key] = { value: r.value, unit: r.unit, label: r.label };
  return out;
}

export interface ToolOutput { key: string; label: string; value: number | null; unit: string; }

/** Upsert the ToMaster outputs a tool contributes. */
export async function saveToolOutputs(tool: string, outputs: ToolOutput[]): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  const rows = outputs.map((o) => ({
    tool, key: o.key, label: o.label, unit: o.unit,
    value: o.value, updated_by: u.user?.id ?? null,
  }));
  const { error } = await supabase.from('tool_outputs').upsert(rows, { onConflict: 'tool,key' });
  return error ? error.message : null;
}

// ---- Tyre results library (BRIEF §E4) --------------------------------------
export interface TyreResult {
  id: string;
  tyre_label: string; run: string | null; scope: string | null;
  r_squared: number | null; rms: number | null; lmux: number | null; lmuy: number | null;
  tir_link: string | null; plot_path: string | null; notes: string | null;
  author: string | null; author_email: string | null; created_at: string;
}

export async function loadTyreResults(): Promise<TyreResult[]> {
  const { data, error } = await supabase
    .from('tyre_results').select('*').order('created_at', { ascending: false });
  return error || !data ? [] : (data as TyreResult[]);
}

export async function addTyreResult(rec: Partial<TyreResult>): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('tyre_results').insert({
    ...rec, author: u.user?.id ?? null, author_email: u.user?.email ?? null,
  });
  return error ? error.message : null;
}

/** Upload a fit plot to the private `tyre` bucket; returns its object path. */
export async function uploadTyrePlot(file: File): Promise<{ path: string | null; error: string | null }> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `plots/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from('tyre').upload(path, file, { upsert: false });
  return { path: error ? null : path, error: error ? error.message : null };
}

/** Short-lived signed URL for a private object. */
export async function signedUrl(bucket: string, path: string, seconds = 300): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

// ---- Resources (BRIEF §E6) -------------------------------------------------
export interface ResourceFolder { id: string; name: string; created_at: string; }
export interface ResourceItem {
  id: string; folder_id: string; title: string; kind: 'file' | 'link';
  path: string | null; url: string | null; notes: string | null;
  uploaded_email: string | null; created_at: string;
}

export async function loadFolders(): Promise<ResourceFolder[]> {
  const { data, error } = await supabase.from('resource_folders').select('*').order('name');
  return error || !data ? [] : (data as ResourceFolder[]);
}
export async function createFolder(name: string): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('resource_folders').insert({ name, created_email: u.user?.email ?? null });
  return error ? error.message : null;
}
export async function deleteFolder(id: string): Promise<string | null> {
  const { error } = await supabase.from('resource_folders').delete().eq('id', id);
  return error ? error.message : null;
}
export async function loadResources(folderId: string): Promise<ResourceItem[]> {
  const { data, error } = await supabase.from('resources').select('*').eq('folder_id', folderId).order('created_at', { ascending: false });
  return error || !data ? [] : (data as ResourceItem[]);
}
export async function addResource(rec: Partial<ResourceItem>): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('resources').insert({ ...rec, uploaded_email: u.user?.email ?? null });
  return error ? error.message : null;
}
export async function deleteResource(id: string): Promise<string | null> {
  const { error } = await supabase.from('resources').delete().eq('id', id);
  return error ? error.message : null;
}
export async function uploadResourceFile(file: File): Promise<{ path: string | null; error: string | null }> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from('resources').upload(path, file, { upsert: false });
  return { path: error ? null : path, error: error ? error.message : null };
}

// ---- Generic JSON tool state (for non-numeric grids, e.g. wiring list) -----
export async function loadToolJson<T>(tool: string, fallback: T): Promise<T> {
  const { data, error } = await supabase.from('tool_state').select('data').eq('tool', tool).maybeSingle();
  if (error || !data || data.data == null) return fallback;
  return data.data as T;
}
export async function saveToolJson(tool: string, data: unknown): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('tool_state').upsert({ tool, data, updated_by: u.user?.id ?? null }, { onConflict: 'tool' });
  return error ? error.message : null;
}

/** Format a number for display: trim noise, keep sensible precision. */
export function fmt(v: number | null | undefined, digits = 3): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (Number.isInteger(v)) return String(v);
  return String(parseFloat(v.toFixed(digits)));
}

/** Debounce a function (for save-on-type). */
export function debounce<T extends (...a: any[]) => void>(fn: T, ms = 500): T {
  let t: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  }) as T;
}
