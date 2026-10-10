/** .tir parse + Master mapping (handoff P2.2). */
import { it, expect } from 'vitest';
import { parseTir, tirToMaster } from './tir';

const SAMPLE = `
[MDI_HEADER]
FILE_TYPE = 'tir'
$ a comment line
[DIMENSION]
UNLOADED_RADIUS = 0.2286
[VERTICAL]
VERTICAL_STIFFNESS = 110000   ! N/m
FNOMIN = 1100
[LATERAL_COEFFICIENTS]
PDY1 = 1.5
PDY2 = -0.1
PKY1 = 30
PKY2 = 1.8
`;

it('parses numeric keys, ignores comments and headers', () => {
  const t = parseTir(SAMPLE);
  expect(t.UNLOADED_RADIUS).toBe(0.2286);
  expect(t.VERTICAL_STIFFNESS).toBe(110000);
  expect(t.FNOMIN).toBe(1100);
  expect(t.FILE_TYPE).toBeUndefined();   // quoted string, non-numeric
});

it('maps to Master values at FNOMIN', () => {
  const d = tirToMaster(parseTir(SAMPLE));
  expect(d.rollingRadiusUnloaded).toBeCloseTo(228.6, 1);
  expect(d.rollingRadiusEffective).toBeCloseTo(221.7, 1);
  expect(d.tyreVertStiffness).toBeCloseTo(110, 3);
  expect(d.muLatPeak).toBeCloseTo(1.5, 3);        // dfz = 0 at Fz = FNOMIN
  expect(d.cornerStiffness).toBeCloseTo(489.4, 0); // |PKY1·FN·sin(2·atan(1/PKY2))|·π/180
});

it('dfz shifts μ away from FNOMIN', () => {
  const d = tirToMaster(parseTir(SAMPLE), 2200); // Fz = 2·FNOMIN → dfz = 1
  expect(d.muLatPeak).toBeCloseTo(1.4, 3);        // |1.5 + (−0.1)·1|
});
