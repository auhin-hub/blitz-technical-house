/**
 * Tool-side Master writes (audit P0.2). Every tool that contributes a value into
 * `vehicle_spec` goes through here so the freeze is honoured and a frozen change
 * is reason-logged — the same governance the Vehicle Spec editor applies. The
 * coupling knock-ons (handbook Table H-1) are shown before the reason is asked.
 */
import { COUPLING_BY_KEY } from './config';
import { writeMaster } from './store';

/** Ask for a change reason, surfacing what else the change moves. */
export function couplingReason(key: string): string | null {
  const knock = COUPLING_BY_KEY[key];
  const msg = `"${key}" is frozen.`
    + (knock ? `\n\nThis also affects: ${knock}\n\nVerify those, then` : '\n\n')
    + ' enter a reason for this change (recorded in the Change Log):';
  return window.prompt(msg);
}

/** Freeze-aware, change-logged Master write for a tool's "Contribute" action. */
export const contributeMaster = (key: string, value: number) => writeMaster(key, value, couplingReason);
