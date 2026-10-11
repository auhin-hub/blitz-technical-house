/**
 * Generic calculator engine (browser). Wires any tool built with the CalcTool
 * component: loads the Master (green/linked, with SSR seed fallback), loads and
 * applies the tool's shared inputs, computes via a pure function, renders
 * outputs, draws charts, saves inputs for the team, and contributes ToMaster.
 *
 * Every tool's maths lives in a pure `compute(inputs, master) -> outputs` in its
 * own lib/calc module, so the formulas stay auditable against the workbook. The
 * engine only moves numbers between the DOM and that function.
 *
 * It is also where shared state stays honest while the page is open (feature
 * review Tier 1 #1/#2): a Master change elsewhere re-reads, re-decorates and
 * recomputes with a visible note, and two members editing the same tool's inputs
 * get an explicit choice instead of a silent last-write-wins.
 */
import Chart from 'chart.js/auto';
import {
  loadMaster, loadToolStateVersioned, saveToolStateVersioned, saveToolOutputs,
  currentUserId, STATE_CONFLICT, fmt, debounce, type StateVersion,
} from '../store';
import { decorateLinkedCells } from '../linked';
import { subscribeLive, liveToast, describeBurst } from '../realtime';
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
  async function refreshMaster(): Promise<void> {
    const loaded = await loadMaster();
    if (Object.keys(loaded).length) {
      scope!.querySelectorAll<HTMLElement>('[data-master]').forEach((el) => {
        const k = el.dataset.master!;
        if (loaded[k]) master[k] = Number(loaded[k].value);
      });
    }
    // Decorate each linked cell by its Master state (not set / unfrozen / frozen).
    decorateLinkedCells(scope!, loaded);
  }
  await refreshMaster();

  const readInp = (): Flat => {
    const inp: Flat = {};
    for (const i of inputs) inp[i.dataset.in!] = Number(i.value);
    return inp;
  };

  // Load the team's shared inputs and apply them.
  const applyState = (state: Record<string, number>) => {
    for (const i of inputs) if (state[i.dataset.in!] !== undefined) i.value = String(state[i.dataset.in!]);
  };
  const defaults = readInp();
  const first = await loadToolStateVersioned(spec.tool, defaults);
  let version: StateVersion = first.version;
  applyState(first.data);
  const myUid = await currentUserId();

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

  /**
   * The conflict bar: shown when a teammate wrote this tool's inputs after we
   * loaded them. Two honest choices — take theirs (drops my unsaved edits) or
   * keep mine (overwrites theirs). We never guess which is wanted.
   */
  function showConflict(): void {
    let bar = scope!.querySelector<HTMLElement>('[data-conflict]');
    if (bar) return;
    bar = document.createElement('div');
    bar.setAttribute('data-conflict', '');
    bar.setAttribute('role', 'alert');
    bar.style.cssText = 'border:1px solid var(--amber);border-left:3px solid var(--amber);'
      + 'background:var(--surface-2);border-radius:var(--radius);padding:0.55rem 0.7rem;'
      + 'margin:0.6rem 0;font-size:var(--fs-200);color:var(--amber-text);display:flex;'
      + 'gap:0.6rem;align-items:center;flex-wrap:wrap;';
    bar.innerHTML = '<span style="flex:1;">Another member changed these inputs while you were editing.</span>'
      + '<button class="btn btn-ghost" data-conflict-take style="font-size:var(--fs-100);">Load theirs</button>'
      + '<button class="btn btn-ghost" data-conflict-keep style="font-size:var(--fs-100);">Keep mine</button>';
    const host = saveStatus?.parentElement ?? scope!;
    host.insertBefore(bar, saveStatus ?? null);
    bar.querySelector('[data-conflict-take]')!.addEventListener('click', async () => {
      const fresh = await loadToolStateVersioned(spec.tool, defaults);
      version = fresh.version;
      applyState(fresh.data);
      recompute();
      bar!.remove();
      if (saveStatus) { saveStatus.textContent = 'Loaded their inputs ✓'; saveStatus.style.color = 'var(--state-linked)'; }
    });
    bar.querySelector('[data-conflict-keep]')!.addEventListener('click', async () => {
      const fresh = await loadToolStateVersioned(spec.tool, defaults);
      version = fresh.version;             // adopt their version, then overwrite it
      bar!.remove();
      persist();
    });
  }

  const persist = debounce(async () => {
    if (saveStatus) saveStatus.textContent = 'Saving…';
    const res = await saveToolStateVersioned(spec.tool, readInp(), version);
    if (res.error === STATE_CONFLICT) {
      if (saveStatus) { saveStatus.textContent = 'Not saved — conflicting edit'; saveStatus.style.color = 'var(--amber-text)'; }
      showConflict();
      return;
    }
    version = res.version;
    if (saveStatus) {
      saveStatus.textContent = res.error ? 'Save failed: ' + res.error : 'Saved ✓';
      saveStatus.style.color = res.error ? 'var(--heritage)' : 'var(--state-linked)';
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

  // Live shared state. A Master move recomputes this tool with a visible note; a
  // teammate's edit to the same tool raises the conflict bar instead of landing
  // silently. Freshness only: if Realtime is unavailable nothing changes except
  // that you need a reload to see their work.
  const watched = new Set(Array.from(scope.querySelectorAll<HTMLElement>('[data-master]')).map((el) => el.dataset.master!));
  subscribeLive({
    name: `tool-${spec.tool}`,
    tables: ['vehicle_spec', 'tool_state'],
    onChange: async (events) => {
      const mine = events.filter((e) => e.table === 'vehicle_spec' && watched.has((e.row?.key ?? e.old?.key) as string));
      if (mine.length) {
        await refreshMaster();
        recompute();
        liveToast(`Vehicle Spec changed (${describeBurst(mine)}) — recalculated.`);
      }
      const stateEvent = events.find((e) => e.table === 'tool_state' && (e.row?.tool ?? e.old?.tool) === spec.tool);
      if (stateEvent && stateEvent.row) {
        const theirs = stateEvent.row.updated_by ?? null;
        const stamp = stateEvent.row.updated_at ?? null;
        if (theirs && theirs === myUid) version = stamp ?? version;      // our own write landing back
        else if (stamp !== version) showConflict();
      }
    },
  });
}
