/**
 * Live shared state (feature review Tier 1 #1).
 *
 * The workspace's whole promise is "enter mass once, see it everywhere". Until
 * now that meant *on the next page load*: a member who changed the Master while
 * someone else had a tool open left that tool computing on a stale number with
 * no hint. This wires Supabase Realtime so the green linked cells, and anything
 * computed from them, update while the page stays open.
 *
 * Design notes:
 *  - One channel per page, many table filters, so we hold a single socket.
 *  - Every callback is debounced and coalesced: a Vehicle Spec paste can fire
 *    forty row events, and we only want one reload + one recompute.
 *  - Realtime respects RLS, so a member only ever receives rows they could have
 *    SELECTed anyway. The tables must be in the `supabase_realtime` publication
 *    (migration 0010) — without it this layer simply never fires and the site
 *    behaves exactly as it did before.
 *  - Nothing here is required for correctness; it is a freshness layer. If the
 *    socket cannot connect (offline, project paused) the page still works.
 */
import { supabase } from './supabase';

export type LiveTable =
  | 'vehicle_spec' | 'tool_outputs' | 'tool_state' | 'gates' | 'change_log'
  | 'taskmap_activities' | 'taskmap_dependencies' | 'taskmap_buckets'
  | 'taskmap_phases' | 'taskmap_loops';

export interface LiveEvent {
  table: LiveTable;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  row: Record<string, any> | null;
  old: Record<string, any> | null;
}

export interface LiveOptions {
  tables: LiveTable[];
  /** Called once per burst, with every event in that burst. */
  onChange: (events: LiveEvent[]) => void;
  /** Coalescing window, ms. */
  waitMs?: number;
  /** Channel name — pages on the same tab must not share one. */
  name?: string;
}

/** Subscribe to row changes on the given tables. Returns an unsubscribe. */
export function subscribeLive(opts: LiveOptions): () => void {
  const { tables, onChange, waitMs = 350 } = opts;
  const name = opts.name ?? `live-${Math.random().toString(36).slice(2, 8)}`;
  let queue: LiveEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    const batch = queue;
    queue = [];
    if (batch.length) { try { onChange(batch); } catch (e) { console.error('[realtime] handler', e); } }
  };

  const channel = supabase.channel(name);
  for (const table of tables) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload: any) => {
      queue.push({
        table,
        type: payload.eventType ?? payload.type,
        row: (payload.new && Object.keys(payload.new).length ? payload.new : null) as any,
        old: (payload.old && Object.keys(payload.old).length ? payload.old : null) as any,
      });
      if (timer === null) timer = setTimeout(flush, waitMs);
    });
  }
  channel.subscribe((status: string) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('[realtime]', name, status);
  });

  return () => { if (timer !== null) clearTimeout(timer); supabase.removeChannel(channel); };
}

/** Which Master keys a burst touched (for a precise "x changed" message). */
export function changedKeys(events: LiveEvent[]): string[] {
  const keys = new Set<string>();
  for (const e of events) {
    if (e.table !== 'vehicle_spec' && e.table !== 'tool_outputs') continue;
    const k = e.row?.key ?? e.old?.key;
    if (typeof k === 'string') keys.add(k);
  }
  return [...keys];
}

let toastHost: HTMLElement | null = null;

/**
 * A transient bottom-right note. Used for "the Master moved under you" so the
 * change is never silent — a recomputed number that appears without explanation
 * is worse than a stale one.
 */
export function liveToast(message: string, kind: 'info' | 'warn' = 'info', ms = 6000): void {
  if (typeof document === 'undefined') return;
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.id = 'live-toasts';
    toastHost.setAttribute('aria-live', 'polite');
    toastHost.style.cssText = 'position:fixed;right:1rem;bottom:1rem;z-index:60;display:flex;'
      + 'flex-direction:column;gap:0.5rem;max-width:min(92vw,360px);pointer-events:none;';
    document.body.appendChild(toastHost);
  }
  const el = document.createElement('div');
  const accent = kind === 'warn' ? 'var(--amber)' : 'var(--state-linked)';
  el.style.cssText = `border:1px solid var(--rule);border-left:3px solid ${accent};background:var(--surface);`
    + 'border-radius:var(--radius);box-shadow:var(--shadow);padding:0.55rem 0.7rem;'
    + 'font-size:var(--fs-200);color:var(--ink-2);pointer-events:auto;'
    + 'transition:opacity 180ms ease, transform 180ms ease;opacity:0;transform:translateY(6px);';
  el.textContent = message;
  toastHost.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'none'; });
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => {
    if (reduce) { el.remove(); return; }
    el.style.opacity = '0'; el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 220);
  }, ms);
}

/** Human-readable "what changed" for a burst, e.g. "mass_total, cog_height". */
export function describeBurst(events: LiveEvent[], max = 3): string {
  const keys = changedKeys(events);
  if (!keys.length) return 'the shared store';
  const shown = keys.slice(0, max).join(', ');
  return keys.length > max ? `${shown} +${keys.length - max} more` : shown;
}
