/**
 * Reusable control bar for list/grid tools (handoff P1.5): Download CSV,
 * Upload CSV (replace or append), and team-shared named presets (save / load /
 * delete). Each tool supplies small callbacks; the bar handles the UI + storage.
 * Keeps every list tool consistent and lets P1.1 / P2.4 reuse it verbatim.
 */
import { loadPresets, saveNamedPreset, deletePreset } from './store';
import { downloadText, readFileText } from './csv';

export interface ListControlsOpts {
  /** Element the bar is rendered into. */
  container: HTMLElement;
  /** Tool id used to namespace presets (stored under `${tool}__presets`). */
  tool: string;
  /** CSV download filename. */
  filename: string;
  /** Produce the current data as a CSV string. */
  getCsv: () => string;
  /** Apply an uploaded CSV; return an error string to report, or null/void on success. */
  applyCsv: (text: string, mode: 'replace' | 'append') => string | null | void;
  /** Snapshot the current inputs for a preset. */
  getPresetPayload: () => unknown;
  /** Restore a preset payload into the tool. */
  applyPreset: (payload: unknown) => void;
  /** Whether Upload should offer replace-vs-append (default true). */
  allowAppend?: boolean;
}

export function mountListControls(o: ListControlsOpts): void {
  const allowAppend = o.allowAppend !== false;
  o.container.innerHTML = `
    <div class="list-ctrls" style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;margin:0.5rem 0;">
      <button class="btn btn-ghost" type="button" data-lc="dl" style="font-size:var(--fs-200);">↓ CSV</button>
      <button class="btn btn-ghost" type="button" data-lc="up" style="font-size:var(--fs-200);">↑ CSV</button>
      <input type="file" accept=".csv,text/csv" data-lc="file" hidden />
      <span style="width:1px;height:1.1em;background:var(--rule-strong);"></span>
      <select data-lc="preset" aria-label="Preset" style="font-family:var(--font-mono);font-size:var(--fs-200);background:var(--surface-2);border:1px solid var(--rule-strong);border-radius:var(--radius);color:var(--ink);padding:0.2rem 0.35rem;">
        <option value="">— preset —</option>
      </select>
      <button class="btn btn-ghost" type="button" data-lc="load" style="font-size:var(--fs-200);">Load</button>
      <button class="btn btn-ghost" type="button" data-lc="save" style="font-size:var(--fs-200);">Save as…</button>
      <button class="btn btn-ghost" type="button" data-lc="del" style="font-size:var(--fs-200);">Delete</button>
      <span class="mono" data-lc="status" style="font-size:var(--fs-200);color:var(--ink-3);"></span>
    </div>`;

  const q = <T extends HTMLElement>(k: string) => o.container.querySelector(`[data-lc="${k}"]`) as T;
  const fileInput = q<HTMLInputElement>('file');
  const presetSel = q<HTMLSelectElement>('preset');
  const statusEl = q<HTMLElement>('status');
  const say = (msg: string, ok = true) => { statusEl.textContent = msg; statusEl.style.color = ok ? 'var(--state-linked)' : 'var(--heritage)'; };

  async function refreshPresets() {
    const presets = await loadPresets(o.tool);
    const names = Object.keys(presets).sort();
    presetSel.innerHTML = '<option value="">— preset —</option>' + names.map((n) => `<option value="${n.replace(/"/g, '&quot;')}">${n}</option>`).join('');
  }

  q<HTMLButtonElement>('dl').addEventListener('click', () => { downloadText(o.filename, o.getCsv()); say('downloaded ✓'); });

  q<HTMLButtonElement>('up').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0]; if (!f) return;
    try {
      const text = await readFileText(f);
      let mode: 'replace' | 'append' = 'replace';
      if (allowAppend) mode = confirm('OK = replace existing rows, Cancel = append to them') ? 'replace' : 'append';
      const err = o.applyCsv(text, mode);
      say(err ? 'Import failed: ' + err : 'imported ✓', !err);
    } catch (e) {
      say('Import failed: ' + (e as Error).message, false);
    } finally { fileInput.value = ''; }
  });

  q<HTMLButtonElement>('save').addEventListener('click', async () => {
    const name = prompt('Preset name (saved for the whole team):')?.trim();
    if (!name) return;
    say('Saving…');
    const err = await saveNamedPreset(o.tool, name, o.getPresetPayload());
    if (err) { say('Save failed: ' + err, false); return; }
    await refreshPresets(); presetSel.value = name; say('saved ✓');
  });

  q<HTMLButtonElement>('load').addEventListener('click', async () => {
    const name = presetSel.value; if (!name) { say('Pick a preset first.', false); return; }
    const presets = await loadPresets(o.tool);
    if (!(name in presets)) { say('Preset not found.', false); return; }
    o.applyPreset(presets[name]); say(`loaded "${name}" ✓`);
  });

  q<HTMLButtonElement>('del').addEventListener('click', async () => {
    const name = presetSel.value; if (!name) { say('Pick a preset first.', false); return; }
    if (!confirm(`Delete preset "${name}" for everyone?`)) return;
    const err = await deletePreset(o.tool, name);
    if (err) { say('Delete failed: ' + err, false); return; }
    await refreshPresets(); say('deleted ✓');
  });

  refreshPresets();
}
