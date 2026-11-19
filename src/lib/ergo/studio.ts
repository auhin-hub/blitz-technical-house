/**
 * Cockpit Packaging Studio — browser island for /ergonomics (#studio, #drivers).
 *
 * State lives in two shared rows (tool_state, behind the login):
 *   erg_studio  — rulebook choice, cockpit points, view toggles, angle bands, STL mapping
 *   erg_drivers — the driver roster: name, measurements, per-driver seat setup
 * Last save wins for both (no merge) — the page says so.
 * The STL file itself never leaves the browser.
 */
import { loadToolJson, saveToolJson, debounce, fmt } from '../store';
import { esc } from '../html';
import { RULES, type RuleId } from './rules';
import { EXAMPLE_COCKPIT } from './defaults';
import {
  percyChecks, poseDriver, driverChecks, seatFrame, add, mul, sub, unit,
  type Cockpit, type Pt, type Check, type DriverBody, type DriverSetup, type DriverPose,
} from './geometry';
import { completeBody, estimateFromStature, MEASUREMENTS } from './estimate';
import { parseStl, projectStl, bounds2d, type StlMapping } from './stl';
import { toDxf, type DxfEntity } from './dxf';

export interface Driver { id: string; name: string; measured: Partial<DriverBody>; setup: DriverSetup; }
type Band = [number | null, number | null];
interface StudioState {
  rules: RuleId;
  cockpit: Cockpit;
  show: { percy: boolean; driver: boolean; all: boolean; cad: boolean };
  driverId: string | null;
  bands: Record<'hip' | 'knee' | 'ankle' | 'elbow', Band>;
  stl: StlMapping;
}

const DEFAULT_STATE: StudioState = {
  rules: 'fsae',
  cockpit: EXAMPLE_COCKPIT,
  show: { percy: true, driver: true, all: false, cad: true },
  driverId: null,
  bands: { hip: [null, null], knee: [null, null], ankle: [null, null], elbow: [null, null] },
  stl: { forward: '-x', up: '+y', scale: 1, frontAxle: 0, ground: 0 },
};
const SETUP_DEFAULT: DriverSetup = { insert: 0, pedalShift: 0, restraintShift: 0 };

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
const num = (v: string) => (v.trim() === '' ? null : Number(v));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** Merge a saved state over the defaults so new fields never come back undefined. */
function mergeState(saved: Partial<StudioState> | null): StudioState {
  const s = clone(DEFAULT_STATE);
  if (!saved || typeof saved !== 'object') return s;
  if (saved.rules && saved.rules in RULES) s.rules = saved.rules;
  if (saved.cockpit) for (const k of Object.keys(s.cockpit) as (keyof Cockpit)[]) {
    const v = (saved.cockpit as any)[k];
    if (v !== undefined && v !== null) (s.cockpit as any)[k] = v;
  }
  Object.assign(s.show, saved.show ?? {});
  Object.assign(s.bands, saved.bands ?? {});
  Object.assign(s.stl, saved.stl ?? {});
  for (const k of ['scale', 'frontAxle', 'ground'] as const) s.stl[k] = Number(s.stl[k]) || (k === 'scale' ? 1 : 0);
  s.driverId = saved.driverId ?? null;
  return s;
}

export async function mountStudio(): Promise<void> {
  const root = $('#studio');
  const rosterRoot = $('#drivers');
  if (!root || !rosterRoot) return;

  let state = mergeState(await loadToolJson<Partial<StudioState> | null>('erg_studio', null));
  const rosterSaved = await loadToolJson<{ drivers?: Driver[] } | null>('erg_drivers', null);
  let drivers: Driver[] = Array.isArray(rosterSaved?.drivers) ? rosterSaved!.drivers : [];
  for (const d of drivers) d.setup = { ...SETUP_DEFAULT, ...(d.setup ?? {}) };
  let stlTris: Float32Array | null = null;   // raw vertices, this session only
  let stlProj: Float32Array | null = null;

  // ---- persistence ----------------------------------------------------------
  const status = (sel: string, text: string, ok = true) => {
    const el = $(sel); if (el) { el.textContent = text; el.style.color = ok ? 'var(--state-linked)' : 'var(--heritage)'; }
  };
  const saveState = debounce(async () => {
    status('[data-studio-status]', 'Saving…');
    const err = await saveToolJson('erg_studio', state);
    status('[data-studio-status]', err ? 'Save failed: ' + err : 'Saved for the team ✓', !err);
  }, 700);
  const saveRoster = debounce(async () => {
    status('[data-roster-status]', 'Saving…');
    const err = await saveToolJson('erg_drivers', { drivers });
    status('[data-roster-status]', err ? 'Save failed: ' + err : 'Saved for the team ✓', !err);
  }, 700);

  // ---- inputs → state ----------------------------------------------------------
  function writeInputs(): void {
    ($('#st-rules') as HTMLSelectElement).value = state.rules;
    for (const el of $$<HTMLInputElement>('[data-ck]', root!)) {
      const [k, axis] = el.dataset.ck!.split('.');
      const v: any = (state.cockpit as any)[k];
      el.value = String(axis ? v[axis] : v);
    }
    for (const el of $$<HTMLInputElement>('[data-show]', root!)) el.checked = (state.show as any)[el.dataset.show!];
    for (const el of $$<HTMLInputElement>('[data-band]', root!)) {
      const [k, i] = el.dataset.band!.split('.');
      const v = (state.bands as any)[k]?.[+i];
      el.value = v === null || v === undefined ? '' : String(v);
    }
    for (const el of $$<HTMLInputElement | HTMLSelectElement>('[data-stl]', root!)) el.value = String((state.stl as any)[el.dataset.stl!]);
  }
  root.addEventListener('input', (ev) => {
    const el = ev.target as HTMLInputElement;
    if (el.dataset.ck) {
      const [k, axis] = el.dataset.ck.split('.');
      const v = Number(el.value);
      if (!Number.isFinite(v)) return;
      if (axis) (state.cockpit as any)[k][axis] = v; else (state.cockpit as any)[k] = v;
    } else if (el.dataset.band) {
      const [k, i] = el.dataset.band.split('.');
      (state.bands as any)[k][+i] = num(el.value);
    } else if (el.dataset.stl) {
      const k = el.dataset.stl as keyof StlMapping;
      (state.stl as any)[k] = k === 'forward' || k === 'up' ? el.value : Number(el.value);
      reproject();
    } else if (el.dataset.setup) {
      const d = drivers.find((x) => x.id === state.driverId);
      if (d) { (d.setup as any)[el.dataset.setup] = Number(el.value) || 0; saveRoster(); }
    } else return;
    update(); saveState();
  });
  root.addEventListener('change', (ev) => {
    const el = ev.target as HTMLInputElement | HTMLSelectElement;
    if (el.id === 'st-rules') state.rules = el.value as RuleId;
    else if (el.id === 'st-driver') state.driverId = el.value || null;
    else if ((el as HTMLInputElement).dataset.show) (state.show as any)[(el as HTMLInputElement).dataset.show!] = (el as HTMLInputElement).checked;
    // (STL selects are handled on 'input', which keeps the unit scale numeric.)
    else return;
    if (el.id === 'st-driver') writeSetupInputs();
    update(); saveState();
  });
  $('[data-reset-cockpit]', root)?.addEventListener('click', () => {
    if (!confirm('Reset every cockpit point to the example layout? This overwrites the team\'s saved points.')) return;
    state.cockpit = clone(EXAMPLE_COCKPIT); writeInputs(); update(); saveState();
  });

  // ---- STL ---------------------------------------------------------------------
  function reproject(): void {
    const info = $('[data-stl-info]', root!);
    if (!stlTris) { stlProj = null; return; }
    try {
      stlProj = projectStl(stlTris, state.stl);
      const b = bounds2d(stlProj);
      const L = b.maxX - b.minX, Hh = b.maxZ - b.minZ;
      const odd = L < 800 || L > 6000 || Hh > 2500;
      if (info) {
        info.innerHTML = `${(stlTris.length / 9).toLocaleString()} triangles · side-view extent ${fmt(L, 0)} × ${fmt(Hh, 0)} mm` +
          ` · x ${fmt(b.minX, 0)} → ${fmt(b.maxX, 0)}, z ${fmt(b.minZ, 0)} → ${fmt(b.maxZ, 0)}` +
          (odd ? ' — <strong>size looks wrong for a car: check units and axes</strong>' : '');
      }
    } catch (e) {
      stlProj = null;
      if (info) info.textContent = (e as Error).message;
    }
  }
  $<HTMLInputElement>('#st-stl', root)?.addEventListener('change', async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    const info = $('[data-stl-info]', root!);
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) { if (info) info.textContent = 'File over 200 MB — export at a coarser resolution.'; return; }
    try {
      stlTris = parseStl(await file.arrayBuffer());
      reproject(); update();
    } catch (e) {
      stlTris = null; stlProj = null;
      if (info) info.textContent = (e as Error).message;
      update();
    }
  });

  // ---- roster ----------------------------------------------------------------------
  const rosterList = $('#roster-list', rosterRoot)!;
  function bodyOf(d: Driver) { return completeBody(d.measured); }
  function renderRoster(): void {
    rosterList.innerHTML = drivers.length ? drivers.map((d) => {
      const est = estimateFromStature(Number(d.measured.stature));
      const fields = MEASUREMENTS.map((m) => {
        const v = d.measured[m.key];
        const e = est[m.key];
        return `<label class="drv-f" title="${esc(m.how)}"><span>${esc(m.label)} <span class="ct-unit">${esc(m.unit)}</span></span>
          <input type="number" step="any" min="0" class="field field-input" data-m="${m.key}" value="${v ?? ''}"
            placeholder="${e !== undefined ? '≈ ' + fmt(e, 0) + ' est.' : ''}" aria-label="${esc(d.name)} ${esc(m.label)}" /></label>`;
      }).join('');
      return `<details class="drv" data-id="${esc(d.id)}" open>
        <summary><span class="drv-name">${esc(d.name || 'Unnamed driver')}</span>
          <span class="mono ct-unit">${d.measured.stature ? fmt(Number(d.measured.stature), 0) + ' mm' : 'no height yet'}</span></summary>
        <div class="drv-grid">
          <label class="drv-f drv-wide"><span>Name</span><input type="text" maxlength="60" class="field field-input" data-m="name" value="${esc(d.name)}" /></label>
          ${fields}
        </div>
        <p style="margin-top:0.6rem;"><button type="button" class="btn btn-ghost" data-del style="font-size:var(--fs-200);">Remove ${esc(d.name || 'driver')}</button></p>
      </details>`;
    }).join('') : '<p class="mono" style="color:var(--ink-3);font-size:var(--fs-200);">No drivers yet — add the first one.</p>';
  }
  rosterList.addEventListener('input', (ev) => {
    const el = ev.target as HTMLInputElement;
    const card = el.closest<HTMLElement>('[data-id]');
    const d = card && drivers.find((x) => x.id === card.dataset.id);
    if (!d || !el.dataset.m) return;
    if (el.dataset.m === 'name') {
      d.name = el.value;
      const nm = $('.drv-name', card!); if (nm) nm.textContent = d.name || 'Unnamed driver';
    } else {
      const v = num(el.value);
      if (v === null || !(v > 0)) delete (d.measured as any)[el.dataset.m]; else (d.measured as any)[el.dataset.m] = v;
      if (el.dataset.m === 'stature') {
        const est = estimateFromStature(Number(d.measured.stature));
        for (const inp of $$<HTMLInputElement>('[data-m]', card!)) {
          const e = (est as any)[inp.dataset.m!];
          if (inp.dataset.m !== 'name' && inp.dataset.m !== 'stature' && inp.dataset.m !== 'mass') inp.placeholder = e !== undefined ? '≈ ' + fmt(e, 0) + ' est.' : '';
        }
      }
    }
    renderDriverSelect(); update(); saveRoster();
  });
  rosterList.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest('[data-del]');
    if (!btn) return;
    const card = btn.closest<HTMLElement>('[data-id]');
    const d = drivers.find((x) => x.id === card?.dataset.id);
    if (!d || !confirm(`Remove ${d.name || 'this driver'} and their measurements from the team roster?`)) return;
    drivers = drivers.filter((x) => x !== d);
    if (state.driverId === d.id) state.driverId = drivers[0]?.id ?? null;
    renderRoster(); renderDriverSelect(); writeSetupInputs(); update(); saveRoster(); saveState();
  });
  $('[data-add-driver]', rosterRoot)?.addEventListener('click', () => {
    const id = (crypto as any).randomUUID ? crypto.randomUUID() : String(Date.now());
    drivers.push({ id, name: `Driver ${drivers.length + 1}`, measured: {}, setup: { ...SETUP_DEFAULT } });
    if (!state.driverId) state.driverId = id;
    renderRoster(); renderDriverSelect(); writeSetupInputs(); update(); saveRoster(); saveState();
  });

  function renderDriverSelect(): void {
    const sel = $<HTMLSelectElement>('#st-driver', root!)!;
    if (state.driverId && !drivers.some((d) => d.id === state.driverId)) state.driverId = drivers[0]?.id ?? null;
    sel.innerHTML = drivers.length
      ? drivers.map((d) => `<option value="${esc(d.id)}"${d.id === state.driverId ? ' selected' : ''}>${esc(d.name || 'Unnamed driver')}</option>`).join('')
      : '<option value="">— add drivers in the roster —</option>';
  }
  function writeSetupInputs(): void {
    const d = drivers.find((x) => x.id === state.driverId);
    for (const el of $$<HTMLInputElement>('[data-setup]', root!)) {
      el.disabled = !d;
      el.value = d ? String((d.setup as any)[el.dataset.setup!] ?? 0) : '';
    }
  }

  // ---- compute + draw ------------------------------------------------------------------
  interface Posed { d: Driver; pose: DriverPose | null; estimated: string[]; checks: Check[]; }
  let lastPercy: ReturnType<typeof percyChecks> | null = null;
  let lastPosed: Posed[] = [];

  function poseAll(upright: boolean): Posed[] {
    return drivers.map((d) => {
      const { body, estimated } = bodyOf(d);
      // Mass isn't used for posing (and isn't estimated) — don't let it block the pose.
      const ok = (Object.keys(body) as (keyof DriverBody)[]).every((k) => k === 'mass' || Number.isFinite(body[k]));
      if (!ok) return { d, pose: null, estimated, checks: [] };
      const pose = poseDriver(state.cockpit, body, d.setup);
      return { d, pose, estimated, checks: driverChecks(state.cockpit, RULES[state.rules], pose, d.name || 'Driver', upright) };
    });
  }

  function update(): void {
    const rules = RULES[state.rules];
    const rep = percyChecks(state.cockpit, rules);
    lastPercy = rep;
    lastPosed = poseAll(rep.upright);
    renderRulesInfo();
    drawSvg();
    drawStl();
    renderChecks();
    renderAngles();
  }

  function renderRulesInfo(): void {
    const r = RULES[state.rules];
    const el = $('[data-rules-info]', root!);
    if (!el) return;
    el.innerHTML = `<strong>${esc(r.edition)}</strong><br><span>${esc(r.source)}</span>` +
      `<br><span class="mono" style="font-size:var(--fs-100);">Egress ≤ ${r.egress.maxS} s (${esc(r.egress.ref)}) · helmet clearance ${r.helmetClearance.min} mm · shoulder mounts ${r.shoulderBelt.spacing[0]}–${r.shoulderBelt.spacing[1]} mm apart</span>` +
      (r.unverified.length ? `<div class="st-unverified">Not confirmed from the source: <ul>${r.unverified.map((u) => `<li>${esc(u)}</li>`).join('')}</ul></div>` : '');
  }

  // View box from everything drawn (+ the CAD silhouette when shown).
  function viewBounds() {
    const c = state.cockpit;
    const pts: Pt[] = [c.frontHoopTop, c.mainHoopTop, c.mainBraceLow, c.seatJunction, c.headRestraint, c.pedalFace, c.heel, c.wheelCentre, c.shoulderMount, c.lapMount, { x: 0, z: 0 }];
    if (lastPercy) { const p = lastPercy.percy; pts.push(add(p.head, { x: 160, z: 160 }), sub(p.head, { x: 160, z: 160 })); }
    for (const q of lastPosed) if (q.pose) pts.push(add(q.pose.head, { x: 160, z: 160 }), q.pose.toe, q.pose.knee);
    let minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
    let minZ = Math.min(...pts.map((p) => p.z)), maxZ = Math.max(...pts.map((p) => p.z));
    if (state.show.cad && stlProj) { const b = bounds2d(stlProj); minX = Math.min(minX, b.minX); maxX = Math.max(maxX, b.maxX); minZ = Math.min(minZ, b.minZ); maxZ = Math.max(maxZ, b.maxZ); }
    const m = 120;
    return { minX: minX - m, maxX: maxX + m, minZ: Math.min(minZ, 0) - m, maxZ: maxZ + m };
  }

  const line = (a: Pt, b: Pt, cls: string) => `<line x1="${a.x.toFixed(1)}" y1="${(-a.z).toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${(-b.z).toFixed(1)}" class="${cls}"/>`;
  const circle = (c: Pt, r: number, cls: string) => `<circle cx="${c.x.toFixed(1)}" cy="${(-c.z).toFixed(1)}" r="${r}" class="${cls}"/>`;
  const dot = (c: Pt, cls: string) => `<circle cx="${c.x.toFixed(1)}" cy="${(-c.z).toFixed(1)}" r="9" class="${cls}"/>`;
  const label = (p: Pt, text: string, cls = 'st-label', dx = 14, dz = 14) => `<text x="${(p.x + dx).toFixed(1)}" y="${(-(p.z + dz)).toFixed(1)}" class="${cls}">${esc(text)}</text>`;

  function figureSvg(pose: DriverPose, cls: string): string {
    return [
      circle(pose.hip, pose.rHip, cls), circle(pose.shoulder, pose.rHip, cls), circle(pose.head, pose.rHead, cls),
      line(pose.hip, pose.shoulder, cls), line(pose.shoulder, pose.head, cls),
      line(pose.hip, pose.knee, cls), line(pose.knee, pose.ankle, cls), line(pose.heel, pose.toe, cls), line(pose.ankle, pose.heel, cls),
      line(pose.shoulder, pose.elbow, cls), line(pose.elbow, pose.grip, cls),
      dot(pose.knee, cls + ' st-joint'), dot(pose.elbow, cls + ' st-joint'),
    ].join('');
  }

  function drawSvg(): void {
    const svg = $<SVGSVGElement>('#st-svg', root!)!;
    const c = state.cockpit, f = seatFrame(c), b = viewBounds();
    svg.setAttribute('viewBox', `${b.minX} ${-b.maxZ} ${b.maxX - b.minX} ${b.maxZ - b.minZ}`);
    const r = RULES[state.rules];
    const parts: string[] = [];

    // ground + front axle
    parts.push(line({ x: b.minX, z: 0 }, { x: b.maxX, z: 0 }, 'st-ground'), line({ x: 0, z: -40 }, { x: 0, z: 120 }, 'st-ground'), label({ x: 0, z: 0 }, 'front axle', 'st-label st-dim', 12, -60));
    // hoops (indicative uprights), hoop line, brace line, clearance offsets
    parts.push(line(c.frontHoopTop, { x: c.frontHoopTop.x, z: Math.min(250, c.frontHoopTop.z) }, 'st-chassis'), label(c.frontHoopTop, 'front hoop'));
    parts.push(line(c.mainHoopTop, { x: c.mainHoopTop.x, z: Math.min(150, c.mainHoopTop.z) }, 'st-chassis'), label(c.mainHoopTop, 'main hoop'));
    parts.push(line(c.mainHoopTop, c.mainBraceLow, 'st-chassis'));
    parts.push(line(c.frontHoopTop, c.mainHoopTop, 'st-hoopline'));
    const off = (a: Pt, bb: Pt) => { const u = unit(sub(bb, a)); let n = { x: -u.z, z: u.x }; if (n.z > 0) n = mul(n, -1); return [add(a, mul(n, r.helmetClearance.min)), add(bb, mul(n, r.helmetClearance.min))]; };
    const [o1, o2] = off(c.frontHoopTop, c.mainHoopTop);
    parts.push(line(o1, o2, 'st-clear'), label(o2, `${r.helmetClearance.min} mm`, 'st-label st-dim', -150, -40));
    if (c.mainBraceLow.x > c.mainHoopTop.x) {
      const u = unit(sub(c.mainBraceLow, c.mainHoopTop)); let n = { x: -u.z, z: u.x }; if (n.x > 0) n = mul(n, -1);
      parts.push(line(add(c.mainHoopTop, mul(n, r.helmetClearance.min)), add(c.mainBraceLow, mul(n, r.helmetClearance.min)), 'st-clear'));
    }
    // seat, head restraint, pedals, wheel, mounts
    parts.push(line(c.seatJunction, add(c.seatJunction, mul(f.uPan, 480)), 'st-seat'), line(c.seatJunction, add(c.seatJunction, mul(f.uBack, 820)), 'st-seat'));
    parts.push(`<rect x="${c.headRestraint.x.toFixed(1)}" y="${(-(c.headRestraint.z + 140)).toFixed(1)}" width="45" height="280" class="st-hr"/>`, label(add(c.headRestraint, { x: 50, z: 140 }), 'head restraint'));
    const a = c.pedalDeg * Math.PI / 180, toeDir = { x: -Math.cos(a), z: Math.sin(a) };
    parts.push(line(add(c.pedalFace, mul(toeDir, -70)), add(c.pedalFace, mul(toeDir, 70)), 'st-pedal'), label(c.pedalFace, 'pedal face', 'st-label', -20, 90));
    const t = c.wheelTiltDeg * Math.PI / 180, R = c.wheelDia / 2, w = { x: R * Math.sin(t), z: R * Math.cos(t) };
    parts.push(line(sub(c.wheelCentre, w), add(c.wheelCentre, w), 'st-wheel'), dot(c.wheelCentre, 'st-wheel'));
    parts.push(dot(c.shoulderMount, 'st-mount'), label(c.shoulderMount, 'shoulder belt'), dot(c.lapMount, 'st-mount'), label(c.lapMount, 'lap belt', 'st-label', 14, -40));
    parts.push(dot(c.heel, 'st-mount'));

    // other drivers (faint), selected driver, Percy on top
    if (state.show.all) for (const q of lastPosed) if (q.pose && q.d.id !== state.driverId) parts.push(figureSvg(q.pose, 'st-other'));
    const sel = lastPosed.find((q) => q.d.id === state.driverId);
    if (state.show.driver && sel?.pose) {
      parts.push(figureSvg(sel.pose, 'st-driver'));
      const shTop = add(sel.pose.shoulder, mul(unit(sub(sel.pose.shoulder, sel.pose.hip)), sel.pose.rHip));
      parts.push(line(c.lapMount, sel.pose.hip, 'st-belt'), line(shTop, c.shoulderMount, 'st-belt'));
      parts.push(label(sel.pose.head, sel.d.name || 'Driver', 'st-label st-drvlabel', -150, 175));
    }
    if (state.show.percy && lastPercy) {
      const p = lastPercy.percy;
      parts.push(circle(p.hip, p.rHip, 'st-percy'), circle(p.shoulder, p.rShoulder, 'st-percy'), circle(p.head, p.rHead, 'st-percy'),
        line(p.hip, p.shoulder, 'st-percy'), line(p.shoulder, p.head, 'st-percy'), label(p.head, 'Percy (95th)', 'st-label st-percylabel', 100, 140));
    }
    svg.innerHTML = parts.join('');
  }

  function drawStl(): void {
    const cv = $<HTMLCanvasElement>('#st-canvas', root!)!;
    const svg = $<SVGSVGElement>('#st-svg', root!)!;
    const rect = svg.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(rect.width * dpr)); cv.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = cv.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!state.show.cad || !stlProj) return;
    const b = viewBounds();
    const vbW = b.maxX - b.minX, vbH = b.maxZ - b.minZ;
    const s = Math.min(cv.width / vbW, cv.height / vbH);
    const ox = (cv.width - vbW * s) / 2, oy = (cv.height - vbH * s) / 2;
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim() || '#888';
    ctx.fillStyle = ink; ctx.globalAlpha = 0.16;
    ctx.beginPath();
    const p = stlProj;
    for (let i = 0; i < p.length; i += 6) {
      ctx.moveTo(ox + (p[i] - b.minX) * s, oy + (b.maxZ - p[i + 1]) * s);
      ctx.lineTo(ox + (p[i + 2] - b.minX) * s, oy + (b.maxZ - p[i + 3]) * s);
      ctx.lineTo(ox + (p[i + 4] - b.minX) * s, oy + (b.maxZ - p[i + 5]) * s);
      ctx.closePath();
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const pill = (s: Check['status']) => `<span class="st-pill st-${s}">${s}</span>`;
  const row = (c: Check) => `<tr><td>${esc(c.label)}${c.note ? `<br><span class="ct-unit">${esc(c.note)}</span>` : ''}</td>
    <td class="ct-num mono">${Number.isFinite(c.value) ? fmt(c.value, 1) : '—'} <span class="ct-unit">${esc(c.unit)}</span></td>
    <td class="mono">${esc(c.limit)}</td><td>${pill(c.status)}</td><td class="ct-unit">${esc(c.ref)}</td></tr>`;

  function renderChecks(): void {
    const el = $('[data-checks]', root!);
    if (!el || !lastPercy) return;
    const sel = lastPosed.find((q) => q.d.id === state.driverId);
    const head = '<thead><tr><th>Check</th><th class="ct-num">Value</th><th>Limit</th><th>Status</th><th>Rule</th></tr></thead>';
    let html = `<h3 class="ct-h3">Percy — 95th-percentile template</h3><div class="ct-wrap"><table class="ct-table">${head}<tbody>${lastPercy.checks.map(row).join('')}</tbody></table></div>`;
    if (sel) {
      html += `<h3 class="ct-h3">${esc(sel.d.name || 'Driver')}</h3>`;
      if (!sel.pose) html += '<p class="ct-sub">Enter at least the height in the roster — the rest can be estimated.</p>';
      else {
        if (sel.estimated.length) html += `<p class="ct-sub">Estimated from height (measure for accuracy): ${sel.estimated.map((k) => esc(MEASUREMENTS.find((m) => m.key === k)?.label ?? k)).join(', ')}.</p>`;
        html += `<div class="ct-wrap"><table class="ct-table">${head}<tbody>${sel.checks.map(row).join('')}</tbody></table></div>`;
      }
    }
    const others = lastPosed.filter((q) => q.pose);
    if (others.length > 1 || (others.length === 1 && !sel)) {
      html += `<h3 class="ct-h3">All drivers</h3><div class="ct-wrap"><table class="ct-table"><thead><tr><th>Driver</th><th class="ct-num">Fails</th><th>What fails</th></tr></thead><tbody>` +
        others.map((q) => { const fails = q.checks.filter((c) => c.status === 'fail');
          return `<tr><td>${esc(q.d.name || 'Driver')}</td><td class="ct-num mono">${fails.length}</td><td class="ct-unit">${fails.length ? esc(fails.map((c) => c.label.replace(/^[^:]*:\s*/, '')).join(' · ')) : 'all pass'}</td></tr>`; }).join('') +
        '</tbody></table></div>';
    }
    el.innerHTML = html;
  }

  function renderAngles(): void {
    const sel = lastPosed.find((q) => q.d.id === state.driverId);
    for (const k of ['hip', 'knee', 'ankle', 'elbow'] as const) {
      const out = $(`[data-angle="${k}"]`, root!), st = $(`[data-angle-status="${k}"]`, root!);
      const v = sel?.pose?.angles[k];
      if (out) out.textContent = v === undefined ? '—' : fmt(v, 0);
      const [lo, hi] = state.bands[k];
      if (st) st.innerHTML = v === undefined || (lo === null && hi === null) ? '' :
        pill((lo === null || v >= lo) && (hi === null || v <= hi) ? 'pass' : 'advisory');
    }
  }

  // ---- exports ---------------------------------------------------------------------------
  function download(name: string, text: string, type: string): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportEntities(): DxfEntity[] {
    const c = state.cockpit, f = seatFrame(c), e: DxfEntity[] = [];
    const L = (layer: string, a: Pt, b: Pt) => e.push({ kind: 'line', layer, a, b });
    const O = (layer: string, cc: Pt, r: number) => e.push({ kind: 'circle', layer, c: cc, r });
    L('CHASSIS', c.frontHoopTop, c.mainHoopTop); L('CHASSIS', c.mainHoopTop, c.mainBraceLow);
    L('SEAT', c.seatJunction, add(c.seatJunction, mul(f.uPan, 480))); L('SEAT', c.seatJunction, add(c.seatJunction, mul(f.uBack, 820)));
    L('CHASSIS', { x: c.headRestraint.x, z: c.headRestraint.z - 140 }, { x: c.headRestraint.x, z: c.headRestraint.z + 140 });
    if (lastPercy) { const p = lastPercy.percy; O('PERCY', p.hip, p.rHip); O('PERCY', p.shoulder, p.rShoulder); O('PERCY', p.head, p.rHead); L('PERCY', p.hip, p.shoulder); L('PERCY', p.shoulder, p.head); }
    for (const q of lastPosed) {
      if (!q.pose || (q.d.id !== state.driverId && !state.show.all)) continue;
      const k = 'DRIVER_' + (q.d.name || 'X'), d = q.pose;
      O(k, d.hip, d.rHip); O(k, d.shoulder, d.rHip); O(k, d.head, d.rHead);
      for (const [a, b] of [[d.hip, d.shoulder], [d.shoulder, d.head], [d.hip, d.knee], [d.knee, d.ankle], [d.ankle, d.heel], [d.heel, d.toe], [d.shoulder, d.elbow], [d.elbow, d.grip]] as [Pt, Pt][]) L(k, a, b);
    }
    return e;
  }
  $('[data-export-dxf]', root)?.addEventListener('click', () => download('cockpit-packaging.dxf', toDxf(exportEntities()), 'application/dxf'));
  $('[data-export-csv]', root)?.addEventListener('click', () => {
    const rows: string[][] = [['item', 'x_mm_rearward_of_front_axle', 'z_mm_above_ground']];
    const add2 = (n: string, p: Pt) => rows.push([n, p.x.toFixed(1), p.z.toFixed(1)]);
    for (const [k, v] of Object.entries(state.cockpit)) if (typeof v === 'object') add2(k, v as Pt);
    if (lastPercy) { const p = lastPercy.percy; add2('percy_hip', p.hip); add2('percy_shoulder', p.shoulder); add2('percy_head', p.head); }
    for (const q of lastPosed) if (q.pose) for (const k of ['hip', 'shoulder', 'head', 'knee', 'ankle', 'elbow'] as const) add2(`${q.d.name}_${k}`, q.pose[k]);
    download('cockpit-points.csv', rows.map((r) => r.map((x) => /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x).join(',')).join('\n'), 'text/csv');
  });

  // ---- go ----------------------------------------------------------------------------------
  if (!state.driverId && drivers.length) state.driverId = drivers[0].id;
  writeInputs(); renderRoster(); renderDriverSelect(); writeSetupInputs(); update();
  // Window resizes — and the cockpit shell, which fires 'resize' when it reveals
  // this tool — redraw the CAD layer at the new size.
  window.addEventListener('resize', debounce(() => drawStl(), 120));
}
