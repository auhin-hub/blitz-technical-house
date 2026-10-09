/**
 * Generic calculator engine (browser). Wires any tool built with the CalcTool
 * component: loads the Master (green/linked, with SSR seed fallback), loads and
 * applies the tool's shared inputs, computes via a pure function, renders
 * outputs, draws charts, saves inputs for the team, and contributes ToMaster.
 *
 * Every tool's maths lives in a pure `compute(inputs, master) -> outputs` in its
 * own lib/calc module, so the formulas stay auditable against the workbook. The
 * engine only moves numbers between the DOM and that function.
 */
import Chart from 'chart.js/auto';
import { loadMaster, loadToolState, saveToolState, saveToolOutputs, fmt, debounce } from '../store';
import { applyChartDefaults, palette, watchTheme } from '../chart-theme';

export type Flat = Record<string, number>;
/** Outputs may be numbers (formatted) or strings (shown as-is, e.g. verdicts). */
export type Out = Record<string, number | string>;
export type Pal = ReturnType<typeof palette>;

export interface ChartSpec {
  canvasId: string;
  build: (ctx: { out: Out; inp: Flat; master: Flat; pal: Pal }) => any | null;
}

export interface CalcSpec {
  tool: string;
  /** Id of the tool's <section> — all DOM queries are scoped to it, so many
   *  calculators can live on one discipline page without colliding. */
  root: string;
  compute: (inp: Flat, master: Flat) => Out;
  /** Per-output-key decimal places; otherwise defaultDigits. */
  digits?: Record<string, number>;
  defaultDigits?: number;
  charts?: ChartSpec[];
  /** ToMaster contributions: value pulled from the output key named in `from`. */
  toMaster?: { key: string; label: string; unit: string; from: string }[];
}

export async function mountCalculator(spec: CalcSpec): Promise<void> {
  const scope = document.getElementById(spec.root);
  if (!scope) return;
  applyChartDefaults();
  const inputs = Array.from(scope.querySelectorAll<HTMLInputElement>('[data-in]'));
  const saveStatus = scope.querySelector<HTMLElement>('[data-save-status]');

  // Master: start from the SSR seed on each linked cell, then overlay live values.
  const master: Flat = {};
  scope.querySelectorAll<HTMLElement>('[data-master]').forEach((el) => {
    master[el.dataset.master!] = Number(el.dataset.seed);
  });
  const loaded = await loadMaster();
  if (Object.keys(loaded).length) {
    scope.querySelectorAll<HTMLElement>('[data-master]').forEach((el) => {
      const k = el.dataset.master!;
      if (loaded[k]) { master[k] = Number(loaded[k].value); el.textContent = fmt(master[k]); }
    });
  }

  const readInp = (): Flat => {
    const inp: Flat = {};
    for (const i of inputs) inp[i.dataset.in!] = Number(i.value);
    return inp;
  };

  // Load the team's shared inputs and apply them.
  const state = await loadToolState(spec.tool, readInp());
  for (const i of inputs) if (state[i.dataset.in!] !== undefined) i.value = String(state[i.dataset.in!]);

  const charts = new Map<string, Chart>();
  let lastOut: Out = {};

  function recompute(): Out {
    const inp = readInp();
    const out = spec.compute(inp, master);
    lastOut = out;
    for (const [k, v] of Object.entries(out)) {
      const el = scope!.querySelector(`[data-out="${k}"]`);
      if (el) el.textContent = typeof v === 'number' ? fmt(v, spec.digits?.[k] ?? spec.defaultDigits ?? 3) : v;
    }
    if (spec.charts) {
      const pal = palette();
      for (const cs of spec.charts) {
        const cfg = cs.build({ out, inp, master, pal });
        if (!cfg) continue;
        const existing = charts.get(cs.canvasId);
        if (existing) {
          existing.data = cfg.data;
          if (cfg.options) existing.options = cfg.options;
          existing.update();
        } else {
          const cv = document.getElementById(cs.canvasId) as HTMLCanvasElement | null;
          if (cv) charts.set(cs.canvasId, new Chart(cv, cfg));
        }
      }
    }
    return out;
  }

  const persist = debounce(async () => {
    if (saveStatus) saveStatus.textContent = 'Saving…';
    const err = await saveToolState(spec.tool, readInp());
    if (saveStatus) {
      saveStatus.textContent = err ? 'Save failed: ' + err : 'Saved ✓';
      saveStatus.style.color = err ? 'var(--heritage)' : 'var(--state-linked)';
    }
  }, 600);

  inputs.forEach((i) => i.addEventListener('input', () => { recompute(); persist(); }));

  const contributeBtn = scope.querySelector<HTMLButtonElement>('[data-contribute]');
  if (contributeBtn && spec.toMaster) {
    const status = scope.querySelector<HTMLElement>('[data-contribute-status]');
    contributeBtn.addEventListener('click', async () => {
      recompute();
      if (status) { status.textContent = 'Saving…'; status.style.color = 'var(--ink-3)'; }
      const outs = spec.toMaster!.map((m) => {
        const raw = lastOut[m.from];
        const num = typeof raw === 'number' ? raw : Number(raw);
        return { key: m.key, label: m.label, unit: m.unit, value: Number.isFinite(num) ? +num.toFixed(4) : null };
      });
      const err = await saveToolOutputs(spec.tool, outs);
      if (status) {
        status.textContent = err ? 'Failed: ' + err : 'Contributed ✓';
        status.style.color = err ? 'var(--heritage)' : 'var(--state-linked)';
      }
    });
  }

  recompute();
  watchTheme(() => { applyChartDefaults(); recompute(); });
}
