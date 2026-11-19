/**
 * Cooling Dyno Analyzer — browser wiring (islands on /powertrain: #cooling-data, #cooling).
 *
 * Maths lives in cooling.ts (ported exactly from the original). Here:
 *  - the dyno + pump tables are team-shared in tool_state `cool_data` (last save wins),
 *  - the scalar inputs go through the standard calculator engine (tool `pt_cooling`),
 *    which also does the green links (rolling_radius via data-master; final_drive and
 *    engine_peak_power via data-output) and Contribute → tool_outputs,
 *  - the scenario / gear tables and curve charts are drawn here.
 */
import Chart from 'chart.js/auto';
import { mountCalculator, type CalcHandle, type Out, type Flat } from './engine';
import { loadToolJson, saveToolJson, debounce, fmt } from '../store';
import { esc } from '../html';
import { palette, applyChartDefaults, watchTheme } from '../chart-theme';
import {
  runCooling, parseDynoCsv, coreFrontalAreaM2, DEFAULT_INPUTS, KTM_PUMP, SAMPLE_DYNO,
  type CoolingInputs, type CoolingResult, type DynoRow, type PumpRow,
} from './cooling';

const TOOL_DATA = 'cool_data';
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const num = (v: unknown): number | null => (v === '' || v === null || v === undefined ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
const finite = (v: number): number | null => (Number.isFinite(v) ? v : null);

/** Saved rows can only be {rpm, power, torque?} / {rpm, lpm} numbers. */
function cleanDyno(raw: unknown): DynoRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r) => r && Number.isFinite(Number(r.rpm)) && Number.isFinite(Number(r.power)))
    .map((r) => ({ rpm: Number(r.rpm), power: Number(r.power), torque: num(r.torque) }));
}
function cleanPump(raw: unknown): PumpRow[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((r) => r && Number.isFinite(Number(r.rpm)) && Number.isFinite(Number(r.lpm))).map((r) => ({ rpm: Number(r.rpm), lpm: Number(r.lpm) }));
}

export async function mountCooling(): Promise<void> {
  const data = $('#cooling-data'), main = $('#cooling');
  if (!data || !main) return;
  applyChartDefaults();

  // ---- shared tables -------------------------------------------------------------------
  const saved = await loadToolJson<{ dyno?: unknown; pump?: unknown } | null>(TOOL_DATA, null);
  let dyno: DynoRow[] = cleanDyno(saved?.dyno);
  let pump: PumpRow[] = cleanPump(saved?.pump) ?? clone(KTM_PUMP);
  let handle: CalcHandle | undefined;

  const dataStatus = $('[data-cool-data-status]', data)!;
  const persist = debounce(async () => {
    dataStatus.textContent = 'Saving…';
    const err = await saveToolJson(TOOL_DATA, { dyno, pump });
    dataStatus.textContent = err ? 'Save failed: ' + err : 'Saved for the team ✓';
    dataStatus.style.color = err ? 'var(--heritage)' : 'var(--state-linked)';
  }, 700);
  const changed = () => { drawCurves(); handle?.recompute(); persist(); };

  // ---- dyno table ------------------------------------------------------------------------
  const dBody = $('#cd-body', data)!, pBody = $('#cp-body', data)!;
  const cell = (v: number | string | null, attrs: string, label: string) =>
    `<td class="ct-num"><input type="number" class="field field-input" ${attrs} value="${v ?? ''}" aria-label="${esc(label)}" /></td>`;
  function renderDyno(): void {
    dBody.innerHTML = dyno.length ? dyno.map((r, i) => `<tr>
      <td class="ct-unit">${i + 1}</td>
      ${cell(r.rpm, `data-d="${i}.rpm"`, `Row ${i + 1} rpm`)}
      ${cell(r.power, `data-d="${i}.power" step="0.1"`, `Row ${i + 1} power kW`)}
      ${cell(r.torque, `data-d="${i}.torque" step="0.1" placeholder="—"`, `Row ${i + 1} torque N·m`)}
      <td><button type="button" class="cool-del" data-ddel="${i}" aria-label="Delete row ${i + 1}">×</button></td></tr>`).join('')
      : '<tr><td colspan="5" class="ct-unit">No dyno data yet — add rows, paste a CSV, or load the sample.</td></tr>';
  }
  function renderPump(): void {
    pBody.innerHTML = pump.length ? pump.map((r, i) => `<tr>
      <td class="ct-unit">${i + 1}</td>
      ${cell(r.rpm, `data-p="${i}.rpm"`, `Pump row ${i + 1} rpm`)}
      ${cell(r.lpm, `data-p="${i}.lpm" step="0.5"`, `Pump row ${i + 1} flow L/min`)}
      <td><button type="button" class="cool-del" data-pdel="${i}" aria-label="Delete pump row ${i + 1}">×</button></td></tr>`).join('')
      : '<tr><td colspan="4" class="ct-unit">Empty — the model then assumes 20 L/min.</td></tr>';
  }
  dBody.addEventListener('input', (ev) => {
    const el = ev.target as HTMLInputElement; if (!el.dataset.d) return;
    const [i, f] = el.dataset.d.split('.'); const row = dyno[+i]; if (!row) return;
    if (f === 'torque') row.torque = el.value === '' ? null : Number(el.value); else (row as any)[f] = Number(el.value);
    changed();
  });
  dBody.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-ddel]'); if (!b) return;
    dyno.splice(+b.dataset.ddel!, 1); renderDyno(); changed();
  });
  pBody.addEventListener('input', (ev) => {
    const el = ev.target as HTMLInputElement; if (!el.dataset.p) return;
    const [i, f] = el.dataset.p.split('.'); const row = pump[+i]; if (!row) return;
    (row as any)[f] = Number(el.value); changed();
  });
  pBody.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-pdel]'); if (!b) return;
    pump.splice(+b.dataset.pdel!, 1); renderPump(); changed();
  });

  const val = (id: string) => ($(`#${id}`, data) as HTMLInputElement);
  $('#cd-add', data)!.addEventListener('click', () => {
    const rpm = Number(val('cd-rpm').value), power = Number(val('cd-pow').value), trq = val('cd-trq').value;
    if (!rpm || !power) { dataStatus.textContent = 'rpm and power are required.'; dataStatus.style.color = 'var(--heritage)'; return; }
    dyno.push({ rpm, power, torque: trq ? Number(trq) : null });
    dyno.sort((a, b) => a.rpm - b.rpm);
    for (const id of ['cd-rpm', 'cd-pow', 'cd-trq']) val(id).value = '';
    val('cd-rpm').focus(); renderDyno(); changed();
  });
  $('#cd-sort', data)!.addEventListener('click', () => { dyno.sort((a, b) => a.rpm - b.rpm); renderDyno(); changed(); });
  $('#cd-clear', data)!.addEventListener('click', () => {
    if (dyno.length && !confirm('Clear the whole dyno table for the team?')) return;
    dyno = []; renderDyno(); changed();
  });
  $('#cd-sample', data)!.addEventListener('click', () => {
    if (dyno.length && !confirm('Replace the dyno table with the KTM 390 RC sample?')) return;
    dyno = clone(SAMPLE_DYNO); renderDyno(); selectTab('manual'); changed();
  });
  $('#cd-parse', data)!.addEventListener('click', () => {
    const msg = $('#cd-csv-msg', data)!;
    const rows = parseDynoCsv(($('#cd-csv', data) as HTMLTextAreaElement).value);
    if (!rows) { msg.textContent = 'No valid data. Format: rpm, power_kW, torque_Nm'; msg.style.color = 'var(--heritage)'; return; }
    if (dyno.length && !confirm('Replace the dyno table with the pasted data?')) return;
    msg.textContent = `${rows.length} rows loaded.`; msg.style.color = 'var(--state-linked)';
    dyno = rows; renderDyno(); selectTab('manual'); changed();
  });

  // ---- pump table buttons ------------------------------------------------------------------
  $('#cp-add', data)!.addEventListener('click', () => {
    const rpm = Number(val('cp-rpm').value), lpm = Number(val('cp-lpm').value);
    if (!rpm || !lpm) { dataStatus.textContent = 'rpm and flow are required.'; dataStatus.style.color = 'var(--heritage)'; return; }
    pump.push({ rpm, lpm }); pump.sort((a, b) => a.rpm - b.rpm);
    val('cp-rpm').value = ''; val('cp-lpm').value = ''; val('cp-rpm').focus(); renderPump(); changed();
  });
  $('#cp-sort', data)!.addEventListener('click', () => { pump.sort((a, b) => a.rpm - b.rpm); renderPump(); changed(); });
  $('#cp-reset', data)!.addEventListener('click', () => { pump = clone(KTM_PUMP); renderPump(); changed(); });
  $('#cp-clear', data)!.addEventListener('click', () => {
    if (pump.length && !confirm('Clear the pump curve for the team?')) return;
    pump = []; renderPump(); changed();
  });

  // ---- entry tabs ------------------------------------------------------------------------------
  const tabs = Array.from(data.querySelectorAll<HTMLButtonElement>('[data-cool-tab]'));
  function selectTab(id: string): void {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.coolTab === id)));
    data!.querySelectorAll<HTMLElement>('[data-cool-panel]').forEach((p) => { p.hidden = p.dataset.coolPanel !== id; });
  }
  tabs.forEach((t) => t.addEventListener('click', () => selectTab(t.dataset.coolTab!)));

  // ---- curve charts (dyno + pump) ------------------------------------------------------------------
  let dynoChart: Chart | null = null, pumpChart: Chart | null = null;
  function drawCurves(): void {
    const p = palette();
    const hasTorque = dyno.some((d) => d.torque !== null);
    const dcfg: any = {
      type: 'line',
      data: { labels: dyno.map((d) => d.rpm), datasets: [
        { label: 'Power (kW)', data: dyno.map((d) => d.power), borderColor: p.maroon, backgroundColor: p.maroon, pointRadius: 4, tension: 0.35, yAxisID: 'y' },
        ...(hasTorque ? [{ label: 'Torque (N·m)', data: dyno.map((d) => d.torque), borderColor: p.amber, backgroundColor: p.amber, borderDash: [5, 3], pointRadius: 3, tension: 0.35, yAxisID: 'y2' }] : []),
      ] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { usePointStyle: true } } },
        scales: { x: { title: { display: true, text: 'engine rpm' } }, y: { title: { display: true, text: 'power (kW)' } },
          ...(hasTorque ? { y2: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'torque (N·m)' } } } : {}) } },
    };
    const pcfg: any = {
      type: 'line',
      data: { labels: pump.map((d) => d.rpm), datasets: [{ label: 'Pump flow (L/min)', data: pump.map((d) => d.lpm), borderColor: p.sky, backgroundColor: p.sky, pointRadius: 4, tension: 0.35 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { title: { display: true, text: 'engine rpm' } }, y: { min: 0, title: { display: true, text: 'flow (L/min)' } } } },
    };
    const upd = (chart: Chart | null, id: string, cfg: any): Chart | null => {
      if (chart) { chart.destroy(); }   // series count can change (torque present or not) — rebuild
      const cv = document.getElementById(id) as HTMLCanvasElement | null;
      return cv ? new Chart(cv, cfg) : null;
    };
    dynoChart = upd(dynoChart, 'ch-dyno', dcfg);
    pumpChart = upd(pumpChart, 'ch-pump', pcfg);
  }

  // ---- analysis (engine) --------------------------------------------------------------------------------
  let last: CoolingResult | null = null;
  const msg = $('[data-cool-msg]', main)!;
  const gearBody = $('[data-cool-gears]', main)!, scenBody = $('[data-cool-scens]', main)!;
  const GREEN = 'cool-pass', AMBER = 'cool-warn', RED = 'cool-fail';

  function renderTables(r: CoolingResult | null): void {
    if (!r) { gearBody.innerHTML = ''; scenBody.innerHTML = ''; return; }
    const P = r.resolved.P, gears = r.resolved.drive.gears;
    const peakIdx = r.rpmRange.reduce((best, rr, i) => Math.abs(rr - r.peakRPM) < Math.abs(r.rpmRange[best] - r.peakRPM) ? i : best, 0);
    gearBody.innerHTML = gears.map((gr, gi) => {
      const sol = r.ssByGear[gi][peakIdx], tg = r.ToutByGear[gi][peakIdx], pass = tg < P.maxSafeT;
      return `<tr><td><strong>Gear ${gi + 1}</strong></td><td class="ct-num mono">${gr.toFixed(3)}</td>
        <td class="ct-num mono">${r.speedsAtPeak[gi].toFixed(1)} km/h</td>
        <td class="ct-num mono ${pass ? GREEN : RED}">${tg.toFixed(1)} °C</td>
        <td class="ct-num mono">${sol.pumpLPM.toFixed(1)} L/min</td>
        <td class="${sol.fanActivated ? AMBER : GREEN}">${sol.fanActivated ? 'ON' : 'OFF'}</td>
        <td class="${pass ? GREEN : RED}">${pass ? `PASS (+${(P.maxSafeT - tg).toFixed(1)} °C)` : 'FAIL'}</td></tr>`;
    }).join('');
    const desc = [
      `${r.peakRPM.toLocaleString()} rpm @ ${r.scens[0].vspd.toFixed(1)} km/h`,
      `${r.peakRPM.toLocaleString()} rpm @ ${r.peakSpeedTopGear.toFixed(1)} km/h`,
      `Mid rpm @ top gear — ${r.midSpeed.toFixed(1)} km/h`,
    ];
    scenBody.innerHTML = r.scens.map((s, i) => {
      const t = s.ss.Tout, lim = s.maxSafeT || 110, margin = lim - t;
      const mCls = margin > 20 ? GREEN : margin > 10 ? AMBER : RED;
      const tCls = t < 103 ? GREEN : t < 110 ? AMBER : RED;
      return `<tr><td><strong>${esc(s.n)}</strong><br><span class="ct-unit">${esc(desc[i])}</span></td>
        <td class="ct-num mono">${(s.Q / 1000).toFixed(1)}</td><td class="ct-num mono">${(s.ss.Q_rad / 1000).toFixed(2)}</td>
        <td class="ct-num mono">${s.ss.pumpLPM.toFixed(1)} L/min</td>
        <td class="${s.ss.fanActivated ? AMBER : GREEN}">${s.ss.fanActivated ? P.fan + ' CFM' : 'OFF'}</td>
        <td class="ct-num mono ${tCls}">${t.toFixed(2)} °C</td><td class="ct-num mono ${mCls}">${margin.toFixed(1)} °C</td>
        <td class="${t < lim ? GREEN : RED}">${t < lim ? 'PASS' : 'FAIL'}</td></tr>`;
    }).join('');
  }

  const dash = '—';
  const emptyOut = (): Out => ({
    tout: dash, margin: dash, qRejected: dash, qPeak: dash, UA: dash, epsPct: dash, verdict: dash, verdictNote: '',
    ntu: dash, ha: dash, Re: dash, regime: dash, pumpLPM: dash, fanState: dash, coreArea: dash,
    tyreUsed: dash, tyreSrc: '', fdUsed: dash, fdSrc: '', peakNote: dash, litNote: '',
  });

  function compute(inp: Flat, master: Flat): Out {
    const merged = { ...DEFAULT_INPUTS, ...inp } as CoolingInputs;
    const run = runCooling(merged, dyno, pump, { rollingRadius: master.rolling_radius, finalDrive: master.final_drive });
    last = run.result ?? null;
    renderTables(last);
    if (!run.result) {
      msg.textContent = run.error === 'Enter at least 2 dyno data points.'
        ? 'Enter at least 2 dyno data points in "Cooling — dyno & pump data" (or load the sample) to run the analysis.' : run.error ?? '';
      return emptyOut();
    }
    msg.textContent = '';
    const r = run.result, rad = r.radAtPeak, P = r.resolved.P;
    const enginePeak = master.engine_peak_power;
    const dynoPeakKw = r.Ppeak / 1000;
    const out: Out = {
      tout: rad.Tout, margin: r.margin, qRejected: rad.Qa / 1000, qPeak: r.Qpeak / 1000, UA: rad.UA, epsPct: rad.eps * 100,
      verdict: r.pass ? 'PASS' : 'FAIL', verdictNote: `limit ${P.maxSafeT} °C (scenarios) · KPI margin against 110 °C, as the original`,
      ntu: rad.NTU, ha: rad.ha, Re: Math.round(rad.Re), regime: rad.reg, pumpLPM: rad.pumpLPM,
      fanState: rad.fanActivated ? `${P.fan} CFM (above ${P.fanTrig} °C trigger)` : `OFF (below ${P.fanTrig} °C)`,
      coreArea: coreFrontalAreaM2(P),
      tyreUsed: r.resolved.drive.tyreDia, tyreSrc: r.resolved.tyreSource, fdUsed: r.resolved.finalDriveRatio, fdSrc: r.resolved.finalDriveSource,
      peakNote: Number.isFinite(enginePeak) && enginePeak > 0
        ? `dyno ${fmt(dynoPeakKw, 1)} kW vs ${fmt(enginePeak, 1)} kW (${(((dynoPeakKw - enginePeak) / enginePeak) * 100) >= 0 ? '+' : ''}${fmt(((dynoPeakKw - enginePeak) / enginePeak) * 100, 1)} %)`
        : `dyno ${fmt(dynoPeakKw, 1)} kW — no engine peak power contributed yet`,
      litNote: P.litCorr ? `Literature correction active: h_air × (${P.wavePitch} ÷ 2.5)^−0.63 = ${rad.litFactor.toFixed(3)}× (Ismael, Yun & Ulugbek 2016; fit R² = 0.89).` : '',
    };
    return out;
  }

  // Colour helpers + chart specs. `last` is set by compute() just before the engine builds the charts.
  const lineBase = { pointRadius: 0, tension: 0.35 };
  const gearStyles: number[][] = [[4, 3], [8, 3], [2, 2], [10, 2, 2, 2], [6, 6], []];
  const commonOpts = (xTitle: string, yTitle: string, y: Record<string, unknown> = {}) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: true, labels: { usePointStyle: true, boxWidth: 12 } } },
    scales: { x: { title: { display: true, text: xTitle } }, y: { title: { display: true, text: yTitle }, ...y } },
  });
  const noData = (): any => ({ type: 'line', data: { labels: [], datasets: [] }, options: { responsive: true, maintainAspectRatio: false } });
  const stateColour = () => getComputedStyle(document.documentElement).getPropertyValue('--state-linked').trim() || '#2f7d4f';

  const charts = [
    { canvasId: 'ch-heat', build: ({ pal }: { pal: ReturnType<typeof palette> }) => {
      const r = last; if (!r) return noData();
      const P = r.resolved.P;
      const tMin = Math.min(...r.ToutSS), tMax = Math.max(...r.ToutSS);
      return { type: 'line', data: { labels: r.rpmRange, datasets: [
        { label: 'T_out (°C)', data: r.ToutSS.map(finite), borderColor: pal.maroon, backgroundColor: pal.maroon, borderWidth: 2.5, ...lineBase },
        { label: 'T_in to radiator (°C)', data: r.TcinSS.map(finite), borderColor: pal.amber, backgroundColor: pal.amber, borderWidth: 1.5, borderDash: [4, 3], ...lineBase },
        { label: 'Fan ON points', data: r.ssSolve.map((s, i) => (s.fanActivated ? finite(r.ToutSS[i]) : null)), borderColor: 'transparent', backgroundColor: pal.amber, pointStyle: 'triangle', pointRadius: 5, showLine: false },
        { label: `${P.maxSafeT} °C limit`, data: r.rpmRange.map(() => P.maxSafeT), borderColor: pal.ink, backgroundColor: pal.ink, borderWidth: 1, borderDash: [6, 4], ...lineBase },
        { label: `${P.fanTrig} °C fan trigger`, data: r.rpmRange.map(() => P.fanTrig), borderColor: pal.sky, backgroundColor: pal.sky, borderWidth: 1, borderDash: [3, 3], ...lineBase },
      ] }, options: commonOpts('engine rpm', 'coolant temperature (°C)', { min: Math.max(P.Tamb, Math.floor(tMin - 5)), max: Math.min(160, Math.ceil(tMax + 10)) }) };
    } },
    { canvasId: 'ch-tout', build: ({ pal }: { pal: ReturnType<typeof palette> }) => {
      const r = last; if (!r) return noData();
      const P = r.resolved.P;
      const fin = r.ToutV.filter(Number.isFinite);
      const tMin = Math.min(...fin), tMax = Math.max(...fin);
      return { type: 'line', data: { labels: r.vRange.map((v) => `${v}`), datasets: [
        { label: 'T_out at peak load (°C)', data: r.ToutV.map(finite), borderColor: pal.maroon, backgroundColor: pal.maroon, borderWidth: 2.5, pointRadius: 3, tension: 0.35 },
        { label: `${P.maxSafeT} °C limit`, data: r.vRange.map(() => P.maxSafeT), borderColor: pal.ink, backgroundColor: pal.ink, borderWidth: 1.5, borderDash: [6, 4], ...lineBase },
        { label: `${P.fanTrig} °C fan trigger`, data: r.vRange.map(() => P.fanTrig), borderColor: pal.sky, backgroundColor: pal.sky, borderWidth: 1.2, borderDash: [3, 3], ...lineBase },
      ] }, options: commonOpts('vehicle speed (km/h)', 'steady-state T_out (°C)', { min: Math.max(P.Tamb, Math.floor(tMin - 5)), max: Math.min(160, Math.ceil(Math.max(tMax, 115) + 5)) }) };
    } },
    { canvasId: 'ch-qrad', build: ({ pal }: { pal: ReturnType<typeof palette> }) => {
      const r = last; if (!r) return noData();
      return { type: 'bar', data: { labels: r.vRange.map((v) => `${v}`), datasets: [
        { label: 'Q rad rejected (kW)', data: r.QradV.map(finite), backgroundColor: pal.sky, borderColor: pal.sky, borderWidth: 1 },
        { label: 'Peak Q engine', type: 'line', data: r.vRange.map(() => r.Qpeak / 1000), borderColor: pal.maroon, backgroundColor: pal.maroon, borderWidth: 1.5, borderDash: [6, 4], ...lineBase },
        { label: 'Avg Q engine', type: 'line', data: r.vRange.map(() => r.Qavg / 1000), borderColor: pal.amber, backgroundColor: pal.amber, borderWidth: 1.2, borderDash: [3, 3], ...lineBase },
      ] }, options: commonOpts('vehicle speed (km/h)', 'heat (kW)') };
    } },
    { canvasId: 'ch-gears', build: ({ pal }: { pal: ReturnType<typeof palette> }) => {
      const r = last; if (!r) return noData();
      const P = r.resolved.P, gears = r.resolved.drive.gears;
      const colours = [pal.maroon, pal.amber, pal.sky, stateColour(), pal.ink, pal.ink3];
      const all = r.ToutByGear.flat().filter(Number.isFinite);
      const datasets: any[] = r.ToutByGear.map((arr, gi) => ({
        label: `Gear ${gi + 1} (${gears[gi].toFixed(3)})`, data: arr.map(finite),
        borderColor: colours[gi % 6], backgroundColor: colours[gi % 6],
        borderWidth: gi === r.topGearIdx ? 2.5 : 1.5, borderDash: gi === r.topGearIdx ? [] : gearStyles[gi % 6], ...lineBase,
      }));
      datasets.push(
        { label: `${P.maxSafeT} °C limit`, data: r.rpmRange.map(() => P.maxSafeT), borderColor: pal.ink, backgroundColor: pal.ink, borderWidth: 1.5, borderDash: [6, 4], ...lineBase },
        { label: `${P.fanTrig} °C fan trigger`, data: r.rpmRange.map(() => P.fanTrig), borderColor: pal.ink3, backgroundColor: pal.ink3, borderWidth: 1, borderDash: [3, 3], ...lineBase },
      );
      return { type: 'line', data: { labels: r.rpmRange, datasets },
        options: commonOpts('engine rpm', 'steady-state T_out (°C)', { min: Math.max(P.Tamb, Math.floor(Math.min(...all) - 3)), max: Math.ceil(Math.max(Math.max(...all), P.maxSafeT) + 8) }) };
    } },
  ];

  renderDyno(); renderPump(); selectTab('manual'); drawCurves();
  watchTheme(() => { applyChartDefaults(); drawCurves(); });

  handle = await mountCalculator({
    root: 'cooling', tool: 'pt_cooling', compute, defaultDigits: 2,
    digits: { Re: 0, UA: 1, coreArea: 4, tyreUsed: 0, fdUsed: 3, ntu: 3, epsPct: 1, margin: 1, pumpLPM: 1, ha: 1, tout: 2, qRejected: 2, qPeak: 1 },
    charts,
    toMaster: [
      { key: 'heat_rejection_kw', label: 'Radiator heat rejection (peak rpm, top gear)', unit: 'kW', from: 'qRejected' },
      { key: 'radiator_area', label: 'Radiator core frontal area (as modelled)', unit: 'm²', from: 'coreArea' },
      { key: 'coolant_tout_peak', label: 'Coolant outlet temp (peak rpm, top gear)', unit: '°C', from: 'tout' },
      { key: 'coolant_margin', label: 'Coolant margin below 110 °C (peak rpm, top gear)', unit: '°C', from: 'margin' },
    ],
  });
}

function $(sel: string, root: ParentNode = document): HTMLElement | null { return root.querySelector<HTMLElement>(sel); }
