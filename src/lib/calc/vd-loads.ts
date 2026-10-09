/**
 * Vehicle Dynamics — Wishbone & pushrod load cases.
 * Ported from the SuspensionLoads sheet (TOOL_SPECS §7e). Front = col B.
 *   static corner   B9  = m*9.81*ff/2            (rear uses 1-ff)
 *   max vertical    B10 = static*DMF + downforce
 *   pushrod force   B12 = maxVertical / sin(θ)
 *   anti-dive/squat B19 = share * tan(θ_svsa) * L / h   (L, h in mm → ratio)
 */
type Flat = Record<string, number>;
const rad = (d: number) => (d * Math.PI) / 180;

function sideLoads(inp: Flat, p: string, staticCorner: number, L: number, h: number): Flat {
  const maxVertical = staticCorner * inp[`${p}_dmf`] + inp[`${p}_downforce`];
  const pushrodForce = maxVertical / Math.sin(rad(inp[`${p}_pushrodAngle`]));
  const antiPct = inp[`${p}_share`] * Math.tan(rad(inp[`${p}_svsaAngle`])) * (L / h);
  return {
    [`${p}_staticCorner`]: staticCorner,
    [`${p}_maxVertical`]: maxVertical,
    [`${p}_pushrodForce`]: pushrodForce,
    [`${p}_antiPct`]: antiPct,
  };
}

export function loadsCompute(inp: Flat, m: Flat): Flat {
  const mass = m.mass_total, ff = m.mass_frac_front, L = m.wheelbase, h = m.cog_height;
  const frontStatic = (mass * 9.81 * ff) / 2;
  const rearStatic = (mass * 9.81 * (1 - ff)) / 2;
  return { ...sideLoads(inp, 'f', frontStatic, L, h), ...sideLoads(inp, 'r', rearStatic, L, h) };
}
