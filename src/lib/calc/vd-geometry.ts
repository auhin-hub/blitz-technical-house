/**
 * Vehicle Dynamics — Suspension geometry derived angles.
 * Ported from the SuspensionGeom sheet (TOOL_SPECS §7c):
 *   caster (rad) B15 = RADIANS(90 - caster_deg)
 *   KPI (rad)    B16 = RADIANS(KPI_deg)
 * The hardpoint coordinate grid is a separate data-entry table (freeze at G3);
 * it has no derived outputs here.
 */
type Flat = Record<string, number>;
const rad = (d: number) => (d * Math.PI) / 180;

export function geometryCompute(inp: Flat): Flat {
  return {
    casterRad: rad(90 - inp.caster),
    kpiRad: rad(inp.kpi),
  };
}
