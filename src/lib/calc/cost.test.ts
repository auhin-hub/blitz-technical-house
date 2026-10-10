/** FSAE-J cost engine (Handoff v2 P3.2). */
import { it, expect } from 'vitest';
import { evalPriceFormula, tableUnitPrice, materialSub, processSub, toolingSub, fcaTotal, costSummary } from './cost';

it('evaluates a parametric price formula', () => {
  // Angular-contact bearing: [C1]*(([Size1]^2*[Size2]))^([C2]) with C1=0.1,C2=0.5,52,25
  expect(evalPriceFormula('[C1]*(([Size1]^2*[Size2]))^([C2])', { c1: 0.1, c2: 0.5, size1: 52, size2: 25 })).toBeCloseTo(26, 0);
});

it('rejects non-numeric formulas safely', () => {
  expect(Number.isNaN(evalPriceFormula('alert(1)', {}))).toBe(true);
});

it('tableUnitPrice falls back to calc when no formula', () => {
  expect(tableUnitPrice({ calc: 1.5 })).toBe(1.5);
  expect(tableUnitPrice({ formula: '[C1]*[Size1]+[C2]', c1: 0.002, c2: 0.08, size1: 25.4 })).toBeCloseTo(0.1308, 4);
});

it('block sub-totals', () => {
  expect(materialSub({ unitPrice: 2.5, qty: 3 })).toBe(7.5);
  expect(processSub({ unitCost: 4, qty: 2, multiplier: 2 })).toBe(16);
  expect(toolingSub({ cost: 1500, qty: 10, pvf: 1000 })).toBe(15);   // 10/1000 × 1500
});

it('fcaTotal sums the four blocks + sub-parts', () => {
  const t = fcaTotal({
    materials: [{ unitPrice: 2.5, qty: 3 }],
    processes: [{ unitCost: 4, qty: 2, multiplier: 2 }],
    fasteners: [{ unitPrice: 0.13, qty: 10 }],
    tooling: [{ cost: 1500, qty: 10, pvf: 1000 }],
    subParts: [{ partCost: 5, qty: 2 }],
  });
  expect(t).toBeCloseTo(7.5 + 16 + 1.3 + 15 + 10, 4);
});

it('costSummary rolls up by system → total vehicle cost', () => {
  const s = costSummary([{ system: 'Brake', total: 100 }, { system: 'Brake', total: 50 }, { system: 'Suspension', total: 200 }]);
  expect(s.bySystem).toEqual([{ system: 'Brake', total: 150 }, { system: 'Suspension', total: 200 }]);
  expect(s.total).toBe(350);
});
