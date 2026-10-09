/**
 * Vehicle Dynamics — Spring & damper sizing (ride-frequency method).
 * Ported from the SpringsDampers sheet (TOOL_SPECS §7d). Front = col B.
 *   sprung corner  B10 = m*ff/2 - unsprung         (rear uses 1-ff)
 *   wheel rate     B11 = (2π f)² * sprung / 1000    (N/mm)
 *   spring rate    B12 = wheelRate / MR²
 *   re-check freq  B14 = IFERROR(√(k*MR²/sprung*1000)/(2π), "")
 *   spring travel  B19 = (bump + droop) * MR
 *   crit. damping  B21 = 2√(wheelRate*1000 * sprung)  (N·s/m)
 *   damper rate    B22 = ζ * Cc
 */
type Flat = Record<string, number>;

function sideSprings(inp: Flat, p: string, sprungCorner: number): Flat {
  const mr = inp[`${p}_motionRatio`];
  const f = inp[`${p}_targetFreq`];
  const wheelRate = ((2 * Math.PI * f) ** 2 * sprungCorner) / 1000; // N/mm
  const springRate = wheelRate / mr ** 2;
  const chosen = inp[`${p}_chosenRate`];
  const recheckFreq = chosen > 0
    ? Math.sqrt(((chosen * mr ** 2) / sprungCorner) * 1000) / (2 * Math.PI)
    : NaN;
  const springTravel = (inp[`${p}_bump`] + inp[`${p}_droop`]) * mr;
  const criticalDamping = 2 * Math.sqrt(wheelRate * 1000 * sprungCorner);
  const damperRate = inp[`${p}_dampingRatio`] * criticalDamping;
  return {
    [`${p}_sprungCorner`]: sprungCorner,
    [`${p}_wheelRate`]: wheelRate,
    [`${p}_springRate`]: springRate,
    [`${p}_recheckFreq`]: recheckFreq,
    [`${p}_springTravel`]: springTravel,
    [`${p}_criticalDamping`]: criticalDamping,
    [`${p}_damperRate`]: damperRate,
  };
}

export function springsCompute(inp: Flat, m: Flat): Flat {
  const mass = m.mass_total, ff = m.mass_frac_front;
  const frontSprung = (mass * ff) / 2 - inp.f_unsprung;
  const rearSprung = (mass * (1 - ff)) / 2 - inp.r_unsprung;
  return { ...sideSprings(inp, 'f', frontSprung), ...sideSprings(inp, 'r', rearSprung) };
}
