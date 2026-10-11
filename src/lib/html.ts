/**
 * HTML escaping for the list tools that build rows with innerHTML (audit P2.1).
 * Escaping only `"` let a value containing `<` or `&` (a part named "A&B", a task
 * "<rework>") corrupt the table or inject markup. Use this everywhere.
 */
const MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape a value for interpolation into HTML (text or attribute). */
export const esc = (s: unknown): string =>
  (s === null || s === undefined ? '' : String(s)).replace(/[&<>"']/g, (c) => MAP[c]);
