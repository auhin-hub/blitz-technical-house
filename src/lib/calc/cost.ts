/**
 * FSAE-Japan 2026 Cost engine (Handoff v2 P3.2). Pure. The bundled cost tables
 * (public/data/cost-tables.json) drive the dropdowns; Materials/Fasteners carry
 * parametric price formulas ([C1]*[Size1]^[C2] …) evaluated with the row's
 * coefficients and the user's Size1/Size2. The four FCA blocks:
 *   Materials : eval(formula | calc) → price                      (× qty)
 *   Processes : unitCost · qty · multiplier
 *   Fasteners : eval(formula | calc) · qty
 *   Tooling   : FracIncld = qty / PVF;  cost · FracIncld   (PVF = production volume)
 * Part total = Σ the four blocks + sub-parts (part_cost · qty). BOM rolls parts
 * up by system → total vehicle cost.
 */

/** Safe evaluator for the table price formulas: tokens → numbers, ^→**, numeric-only. */
export function evalPriceFormula(formula: string, v: { c1?: number; c2?: number; size1?: number; size2?: number }): number {
  if (!formula) return NaN;
  let e = formula
    .replace(/\[C1\]/gi, String(v.c1 ?? 0))
    .replace(/\[C2\]/gi, String(v.c2 ?? 0))
    .replace(/\[Size1\]/gi, String(v.size1 ?? 0))
    .replace(/\[Size2\]/gi, String(v.size2 ?? 0))
    .replace(/\^/g, '**');
  if (!/^[-+*/()eE0-9.\s]+$/.test(e)) return NaN;  // numbers + operators only
  try { const r = Function('"use strict";return (' + e + ')')(); return typeof r === 'number' && Number.isFinite(r) ? r : NaN; }
  catch { return NaN; }
}

export interface PricedRow { formula?: string; calc?: number | null; c1?: number | null; c2?: number | null; size1?: number | null; size2?: number | null; }

/** Unit price of a Materials/Fasteners row at the given sizes (fallback to its calc). */
export function tableUnitPrice(row: PricedRow, size1?: number | null, size2?: number | null): number {
  const s1 = size1 ?? row.size1 ?? undefined;
  const s2 = size2 ?? row.size2 ?? undefined;
  if (row.formula) {
    const p = evalPriceFormula(row.formula, { c1: row.c1 ?? 0, c2: row.c2 ?? 0, size1: s1 ?? 0, size2: s2 ?? 0 });
    if (Number.isFinite(p)) return p;
  }
  return Number.isFinite(row.calc as number) ? (row.calc as number) : NaN;
}

export const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export interface MaterialLine { unitPrice: number; qty: number; }
export interface ProcessLine { unitCost: number; qty: number; multiplier: number; }
export interface FastenerLine { unitPrice: number; qty: number; }
export interface ToolingLine { cost: number; qty: number; pvf: number; }
export interface SubPartLine { partCost: number; qty: number; }

export const materialSub = (l: MaterialLine) => num(l.unitPrice) * num(l.qty);
export const processSub = (l: ProcessLine) => num(l.unitCost) * num(l.qty) * (l.multiplier ? num(l.multiplier) : 1);
export const fastenerSub = (l: FastenerLine) => num(l.unitPrice) * num(l.qty);
export const toolingSub = (l: ToolingLine) => (num(l.pvf) > 0 ? num(l.cost) * (num(l.qty) / num(l.pvf)) : 0);
export const subPartSub = (l: SubPartLine) => num(l.partCost) * num(l.qty);

export interface Fca {
  materials: MaterialLine[]; processes: ProcessLine[]; fasteners: FastenerLine[]; tooling: ToolingLine[]; subParts: SubPartLine[];
}
export function fcaTotal(f: Partial<Fca>): number {
  return (f.materials ?? []).reduce((s, l) => s + materialSub(l), 0)
    + (f.processes ?? []).reduce((s, l) => s + processSub(l), 0)
    + (f.fasteners ?? []).reduce((s, l) => s + fastenerSub(l), 0)
    + (f.tooling ?? []).reduce((s, l) => s + toolingSub(l), 0)
    + (f.subParts ?? []).reduce((s, l) => s + subPartSub(l), 0);
}

export interface BomRow { system: string; total: number | null; }
/** Roll BOM rows up by system → subtotal + grand total. */
export function costSummary(rows: BomRow[]): { bySystem: { system: string; total: number }[]; total: number } {
  const m: Record<string, number> = {};
  for (const r of rows) { const s = r.system || '—'; m[s] = (m[s] ?? 0) + num(r.total); }
  const bySystem = Object.entries(m).map(([system, total]) => ({ system, total })).sort((a, b) => a.system.localeCompare(b.system));
  return { bySystem, total: bySystem.reduce((s, x) => s + x.total, 0) };
}
