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
import { fmt } from './store';

export function decorateLinkedCells(
  scope: ParentNode,
  rows: Record<string, SpecRow>,
  digits = 3,
): void {
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
