/**
 * Chart.js theming from the design tokens (browser only). Resolves the CSS
 * custom properties so plots match blueprint-light / night-shift and re-reads
 * them on theme change. Keeps every chart in the workspace one visual system.
 */
import { Chart } from 'chart.js';

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function palette() {
  return {
    sky: cssVar('--sky') || '#4A6D82',
    amber: cssVar('--amber') || '#E8A33D',
    maroon: cssVar('--heritage') || '#9B1E22',
    ink: cssVar('--ink') || '#17222B',
    ink3: cssVar('--ink-3') || '#6B7C86',
    rule: cssVar('--rule') || '#D2DEE6',
    surface: cssVar('--surface') || '#fff',
  };
}

/** Apply shared Chart.js defaults (fonts + muted grid/ticks). Call once per page. */
export function applyChartDefaults(): void {
  const p = palette();
  Chart.defaults.font.family = "'IBM Plex Mono', ui-monospace, monospace";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = p.ink3;
  Chart.defaults.borderColor = p.rule;
}

/** Re-theme a chart when the user toggles light/night-shift. */
export function watchTheme(apply: () => void): void {
  const obs = new MutationObserver(apply);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
}
