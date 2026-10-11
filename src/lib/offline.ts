/**
 * Offline Master cache (feature review Tier 2 #5).
 *
 * The calculators are pure functions: given the Master and the tool's inputs
 * they need nothing from the network. So when the network is gone we keep
 * computing — from the last Master this browser successfully loaded, clearly
 * labelled with when that was. The rule is that a stale shared number is only
 * acceptable if the page SAYS it is stale, which is why this is a separate,
 * timestamped cache rather than something the service worker fakes.
 *
 * Writes are never queued: a Master edit carries a reason, a freeze and a change
 * log, and replaying one later from a stale base is how two members silently
 * overwrite each other. Offline, a write is refused and said so.
 */
const KEY = 'blitz-master-cache-v1';

export interface MasterCache<T = unknown> { at: string; rows: T }

/** Store the Master rows we just loaded. Best-effort; private mode may refuse. */
export function cacheMaster(rows: unknown): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: new Date().toISOString(), rows } satisfies MasterCache));
  } catch { /* private mode / quota: offline support is a bonus, not a requirement */ }
}

/** The last cached Master, or null if there is none or it is unreadable. */
export function readCachedMaster<T = unknown>(): MasterCache<T> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MasterCache<T>;
    return parsed && parsed.rows ? parsed : null;
  } catch { return null; }
}

export function clearMasterCache(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Is this a "the network is not there" failure rather than a real server error? */
export function looksOffline(message?: string | null): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return !!message && /failed to fetch|network|load failed|offline|err_internet/i.test(message);
}

/** "2 h ago" / "just now" for the offline banner. */
export function sinceLabel(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return 'unknown';
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}
