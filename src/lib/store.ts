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
