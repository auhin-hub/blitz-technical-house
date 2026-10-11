/**
 * Linked-cell decoration (MASTER_BUILD_PLAN / handoff P1.4). Every green
 * "linked" cell reflects its Master state so a member can see, at a glance,
 * whether the number they're relying on is real and locked:
 *   - not set in Vehicle Spec → "—" with a solid amber border
 *   - set but not frozen      → value with a dashed amber border ("may change")
 *   - frozen                  → normal green, no warning
 * Pure DOM; call it with the raw rows from loadMaster (which carry frozen state).
 */
import type { SpecRow } from './master';
import { fmt, masterLoadError } from './store';

/**
 * If the Master failed to load (or loaded degraded — e.g. migration 0008 not run),
 * say so at the top of the page. Silently showing "—" everywhere used to look like
 * the whole site was broken (audit P0.1).
 */
export function showMasterAlert(): void {
  const existing = document.getElementById('master-alert');
  if (!masterLoadError) { existing?.remove(); return; }
  const host = document.querySelector('main') ?? document.body;
  const el = existing ?? document.createElement('div');
  el.id = 'master-alert';
  el.setAttribute('role', 'status');
  el.style.cssText = 'border:1px solid var(--amber);border-left:3px solid var(--amber);background:var(--surface-2);'
    + 'border-radius:var(--radius);padding:0.6rem 0.8rem;margin-bottom:1rem;font-size:var(--fs-300);color:var(--amber-text);';
  el.textContent = `Vehicle Spec: ${masterLoadError}`;
  if (!existing) host.prepend(el);
}

export function decorateLinkedCells(
  scope: ParentNode,
  rows: Record<string, SpecRow>,
  digits = 3,
): void {
  showMasterAlert();
  scope.querySelectorAll<HTMLElement>('[data-master]').forEach((el) => {
    const k = el.dataset.master!;
    const row = rows[k];
    el.classList.remove('linked-unset', 'linked-unfrozen');
    const val = row?.value;
    if (row == null || val === null || val === undefined) {
      el.textContent = '—';
      el.classList.add('linked-unset');
      el.title = 'Not set in Vehicle Spec yet.';
      return;
    }
    el.textContent = fmt(Number(val), digits);
    if (!row.frozen) {
      el.classList.add('linked-unfrozen');
      el.title = 'Value not frozen in Vehicle Spec — may still change.';
    } else {
      el.title = row.frozen_gate ? `Frozen at ${row.frozen_gate}.` : 'Frozen.';
    }
  });
}
