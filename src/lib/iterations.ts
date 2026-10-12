/**
 * Iteration / scenario manager for a calculator.
 *
 * When you're tuning a tool — sweeping spring rates, bias, ARB — you want to try
 * several setups, keep the good ones, compare them, and then pick the one to
 * share. This gives every calculator that, with no per-tool wiring:
 *
 *   - Save the current inputs + computed outputs as a named iteration (up to 15).
 *   - Tick iterations to compare them in a table + chart (and the live setup).
 *   - Download the selected iterations as CSV.
 *   - Delete iterations.
 *   - Mark ONE as **final** — it loads back into the tool as the live setup, and
 *     (if the tool has a Contribute button) that's the setup you then share with
 *     the rest of the workspace.
 *
 * It is purely DOM-scoped: it reads `[data-in]` / `[data-out]` and applies a
 * loaded setup by setting the inputs and dispatching `input`, which is exactly
 * what the engine and every standalone page already listen for. So it needs no
 * knowledge of any tool's formulas.
 *
 * Storage follows the presets pattern: a team-shared `tool_state` row under
 * `${tool}__iters`, so no migration and no new table.
 */
import Chart from 'chart.js/auto';
import { loadToolJson, saveToolJson, fmt } from './store';
import { toCsv, downloadText } from './csv';
import { applyChartDefaults, palette } from './chart-theme';

export interface Iteration {
  id: string;
  name: string;
  at: string;                       // ISO timestamp
  inputs: Record<string, string>;   // raw [data-in] values
  outputs: Record<string, number>;  // numeric [data-out] snapshot
  final?: boolean;
}

export const MAX_ITERATIONS = 15;
const keyFor = (tool: string) => `${tool}__iters`;

export async function loadIterations(tool: string): Promise<Iteration[]> {
  const d = await loadToolJson<{ iters?: Iteration[] }>(keyFor(tool), {});
  return Array.isArray(d.iters) ? d.iters.slice(0, MAX_ITERATIONS) : [];
}
export async function saveIterations(tool: string, iters: Iteration[]): Promise<string | null> {
  return saveToolJson(keyFor(tool), { iters });
}

export interface IterationOpts {
  tool: string;
  /** Element to scan for `[data-in]` / `[data-out]`. Default: document. */
  scope?: ParentNode;
  /** Where to render the bar. If omitted, inserted before the tool's
   *  `[data-save-status]` (or appended to `scope`). */
  host?: HTMLElement;
  /** Button to click when an iteration is finalised, so it's shared. Default
   *  `[data-contribute]` within `scope`. Pass null to disable auto-share. */
  contributeSelector?: string | null;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const uid = () => `it${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Label for an output cell: its stat-tile annotation, or its table-row label. */
function labelFor(el: Element, key: string): string {
  const stat = el.closest('.ct-stat');
  if (stat) return stat.querySelector('.annot')?.textContent?.trim() || key;
  const tr = el.closest('tr');
  if (tr) { const td = tr.querySelector('td'); if (td && !td.contains(el)) return (td.textContent || '').trim() || key; }
  return key;
}

export function mountIterations(opts: IterationOpts): void {
  const scope: ParentNode = opts.scope ?? document;
  const root = (scope as Element).querySelector ? (scope as Element) : document;

  const inputEls = () => Array.from(root.querySelectorAll<HTMLElement>('[data-in]'));
  const outputEls = () => Array.from(root.querySelectorAll<HTMLElement>('[data-out]'));

  const readInputs = (): Record<string, string> => {
    const o: Record<string, string> = {};
    for (const el of inputEls()) o[(el as HTMLInputElement).dataset.in!] = (el as HTMLInputElement).value;
    return o;
  };
  const readOutputs = (): { vals: Record<string, number>; labels: Record<string, string> } => {
    const vals: Record<string, number> = {}, labels: Record<string, string> = {};
    for (const el of outputEls()) {
      const k = (el as HTMLElement).dataset.out!;
      const txt = (el.textContent || '').trim();
      labels[k] = labelFor(el, k);
      if (txt && txt !== '—') { const n = Number(txt.replace(/[, ]/g, '')); if (Number.isFinite(n)) vals[k] = n; }
    }
    return { vals, labels };
  };
  const applyInputs = (inputs: Record<string, string>) => {
    for (const el of inputEls()) {
      const k = (el as HTMLInputElement).dataset.in!;
      if (inputs[k] != null) { (el as HTMLInputElement).value = String(inputs[k]); el.dispatchEvent(new Event('input', { bubbles: true })); }
    }
  };

  // Host placement.
  let host = opts.host;
  if (!host) {
    host = document.createElement('div');
    const anchor = root.querySelector('[data-save-status]');
    const foot = anchor?.closest('.ct-foot') ?? anchor;
    if (foot && foot.parentElement) foot.parentElement.insertBefore(host, foot);
    else (root as HTMLElement).appendChild(host);
  }
  host.className = 'iters';

  let iters: Iteration[] = [];
  const selected = new Set<string>();
  let chart: Chart | null = null;

  host.innerHTML = `
    <details class="iters-box">
      <summary><span class="iters-title">Iterations</span> <span class="iters-count mono"></span></summary>
      <div class="iters-body">
        <div class="iters-actions">
          <button class="btn btn-halftone" type="button" data-it="save">＋ Save current setup</button>
          <button class="btn btn-ghost" type="button" data-it="compare">Compare selected</button>
          <button class="btn btn-ghost" type="button" data-it="download">↓ CSV of selected</button>
          <span class="mono iters-status" data-it="status"></span>
        </div>
        <div class="iters-list" data-it="list"></div>
        <div class="iters-compare" data-it="comparePanel" hidden>
          <div class="iters-metric">
            Chart metric <select data-it="metric" aria-label="Metric to chart"></select>
          </div>
          <div class="iters-chart"><canvas data-it="chart"></canvas></div>
          <div class="iters-table" data-it="table"></div>
        </div>
      </div>
    </details>`;

  const q = <T extends HTMLElement>(k: string) => host!.querySelector(`[data-it="${k}"]`) as T;
  const listEl = q('list'), statusEl = q('status'), panel = q<HTMLElement>('comparePanel');
  const say = (m: string, ok = true) => { statusEl.textContent = m; statusEl.style.color = ok ? 'var(--state-linked)' : 'var(--heritage)'; };

  async function persist(msg?: string) {
    const err = await saveIterations(opts.tool, iters);
    if (err) say('Save failed: ' + err, false); else if (msg) say(msg);
  }

  function renderList() {
    q('count').textContent = `${iters.length}/${MAX_ITERATIONS}`;
    if (!iters.length) {
      listEl.innerHTML = '<p class="mono iters-empty">No iterations yet. Set the inputs you want to try, then “Save current setup”.</p>';
      return;
    }
    listEl.innerHTML = iters.map((it) => `
      <div class="iters-row${it.final ? ' is-final' : ''}">
        <input type="checkbox" data-pick="${esc(it.id)}" aria-label="Select ${esc(it.name)}"${selected.has(it.id) ? ' checked' : ''} />
        <button class="iters-star" data-star="${esc(it.id)}" title="${it.final ? 'The final setup — loaded into the tool' : 'Mark as the final setup (loads it + shares via Contribute)'}" aria-pressed="${!!it.final}">${it.final ? '★' : '☆'}</button>
        <button class="iters-name" data-rename="${esc(it.id)}" title="Rename">${esc(it.name)}</button>
        <span class="mono iters-when">${new Date(it.at).toLocaleString()}</span>
        <button class="btn btn-ghost" data-load="${esc(it.id)}" title="Load these inputs into the tool">Load</button>
        <button class="btn btn-ghost" data-del="${esc(it.id)}" title="Delete" aria-label="Delete ${esc(it.name)}">✕</button>
      </div>`).join('');

    listEl.querySelectorAll<HTMLInputElement>('[data-pick]').forEach((c) =>
      c.addEventListener('change', () => { c.checked ? selected.add(c.dataset.pick!) : selected.delete(c.dataset.pick!); if (!panel.hidden) renderCompare(); }));
    listEl.querySelectorAll<HTMLButtonElement>('[data-load]').forEach((b) =>
      b.addEventListener('click', () => { const it = iters.find((x) => x.id === b.dataset.load); if (it) { applyInputs(it.inputs); say(`loaded “${it.name}”`); } }));
    listEl.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => { iters = iters.filter((x) => x.id !== b.dataset.del); selected.delete(b.dataset.del!); renderList(); if (!panel.hidden) renderCompare(); await persist('deleted'); }));
    listEl.querySelectorAll<HTMLButtonElement>('[data-star]').forEach((b) =>
      b.addEventListener('click', () => finalize(b.dataset.star!)));
    listEl.querySelectorAll<HTMLButtonElement>('[data-rename]').forEach((b) =>
      b.addEventListener('click', async () => {
        const it = iters.find((x) => x.id === b.dataset.rename); if (!it) return;
        const name = window.prompt('Rename iteration:', it.name)?.trim();
        if (name) { it.name = name; renderList(); if (!panel.hidden) renderCompare(); await persist('renamed'); }
      }));
  }

  async function saveCurrent() {
    if (iters.length >= MAX_ITERATIONS) { say(`Limit is ${MAX_ITERATIONS}. Delete one first.`, false); return; }
    const { vals } = readOutputs();
    const name = window.prompt('Name this iteration:', `Setup ${iters.length + 1}`)?.trim();
    if (!name) return;
    iters.push({ id: uid(), name, at: new Date().toISOString(), inputs: readInputs(), outputs: vals });
    renderList();
    await persist(`saved “${name}”`);
  }

  async function finalize(id: string) {
    const it = iters.find((x) => x.id === id); if (!it) return;
    const wasFinal = !!it.final;
    iters.forEach((x) => { x.final = false; });
    it.final = !wasFinal;
    renderList();
    await persist();
    if (it.final) {
      applyInputs(it.inputs);                  // load it as the live setup
      // Share it, if the tool contributes to the Master / shared outputs.
      const sel = opts.contributeSelector === undefined ? '[data-contribute]' : opts.contributeSelector;
      const btn = sel ? root.querySelector<HTMLButtonElement>(sel) : null;
      if (btn) { setTimeout(() => btn.click(), 0); say(`“${it.name}” is final — loaded and shared`); }
      else say(`“${it.name}” is final — loaded into the tool`);
    }
  }

  function numericKeys(): string[] {
    const keys = new Set<string>();
    for (const it of iters) if (selected.has(it.id)) for (const k of Object.keys(it.outputs)) keys.add(k);
    return [...keys];
  }

  function renderCompare() {
    const picked = iters.filter((it) => selected.has(it.id));
    const labels = readOutputs().labels;
    if (picked.length < 1) {
      q('table').innerHTML = '<p class="mono iters-empty">Tick one or more iterations to compare.</p>';
      q<HTMLElement>('chart').parentElement!.style.display = 'none';
      q<HTMLElement>('metric').parentElement!.style.display = 'none';
      chart?.destroy(); chart = null; return;
    }
    q<HTMLElement>('chart').parentElement!.style.display = '';
    q<HTMLElement>('metric').parentElement!.style.display = '';
    const keys = numericKeys();
    const lab = (k: string) => labels[k] ?? k;

    // Metric dropdown (keep the current choice if still valid).
    const metricSel = q<HTMLSelectElement>('metric');
    const prev = metricSel.value;
    metricSel.innerHTML = keys.map((k) => `<option value="${esc(k)}">${esc(lab(k))}</option>`).join('');
    if (keys.includes(prev)) metricSel.value = prev;

    // Table: rows = metrics, columns = iterations; final column flagged.
    q('table').innerHTML = `<div style="overflow-x:auto;"><table class="iters-cmp">
      <thead><tr><th>Metric</th>${picked.map((it) => `<th class="ct-num">${esc(it.name)}${it.final ? ' ★' : ''}</th>`).join('')}</tr></thead>
      <tbody>${keys.map((k) => `<tr><td>${esc(lab(k))}</td>${picked.map((it) => `<td class="ct-num mono">${it.outputs[k] == null ? '—' : fmt(it.outputs[k], 3)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;

    drawChart(picked, metricSel.value, lab);
  }

  function drawChart(picked: Iteration[], metric: string, lab: (k: string) => string) {
    const cv = q<HTMLCanvasElement>('chart');
    const p = palette();
    const data = {
      labels: picked.map((it) => it.name),
      datasets: [{
        label: lab(metric),
        data: picked.map((it) => (it.outputs[metric] == null ? null : it.outputs[metric])),
        backgroundColor: picked.map((it) => (it.final ? p.amber : p.sky)),
      }],
    };
    const cfg: any = { type: 'bar', data, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: lab(metric) } } } } };
    if (chart) { chart.data = cfg.data; chart.options = cfg.options; chart.update(); }
    else chart = new Chart(cv, cfg);
  }

  function downloadSelected() {
    const picked = iters.filter((it) => selected.has(it.id));
    if (!picked.length) { say('Tick iterations to download first.', false); return; }
    const labels = readOutputs().labels;
    const inKeys = [...new Set(picked.flatMap((it) => Object.keys(it.inputs)))];
    const outKeys = [...new Set(picked.flatMap((it) => Object.keys(it.outputs)))];
    const header = ['field', 'type', ...picked.map((it) => it.name + (it.final ? ' (final)' : ''))];
    const rows: (string | number)[][] = [];
    for (const k of inKeys) rows.push([k, 'input', ...picked.map((it) => it.inputs[k] ?? '')]);
    for (const k of outKeys) rows.push([labels[k] ?? k, 'output', ...picked.map((it) => (it.outputs[k] ?? ''))]);
    downloadText(`${opts.tool}_iterations.csv`, toCsv(header, rows));
    say(`downloaded ${picked.length}`);
  }

  q<HTMLButtonElement>('save').addEventListener('click', saveCurrent);
  q<HTMLButtonElement>('download').addEventListener('click', downloadSelected);
  q<HTMLButtonElement>('compare').addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) renderCompare(); });
  q<HTMLSelectElement>('metric').addEventListener('change', () => renderCompare());

  applyChartDefaults();
  renderList();
  loadIterations(opts.tool).then((saved) => { iters = saved; renderList(); });
}
