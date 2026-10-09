/**
 * Springs & dampers (MASTER_BUILD_PLAN §6.5). The important correction vs the
 * old tool: the wheel rate is the ride rate with the TYRE IN SERIES —
 *   Kr = (2πf)²·m_sprung        (ride-rate target, N/m)
 *   Kw = Kr·Kt / (Kt − Kr)      (wheel rate, with the tyre spring in series)
 *   Ks = Kw / MR²               (spring rate)
 * Omitting the tyre (the old bug) overstates softness. All rates are kept in SI
 * (N/m) internally and converted to N/mm for display.
 *
 * Sources: §6.5 + the VD SpringsDampers sheet (verified), with the tyre-in-series
 * fix and MR-from-rocker-geometry from the FRS 2.0 method.
 */
import type { Out } from './engine';
const TWO_PI = 2 * Math.PI;

export interface SpringsMaster { mass: number; ff: number; kt: number; cogHeight: number; trackFront: number; trackRear: number; }
export interface SpringSide {
  targetFreq: number; unsprung: number; motionRatio: number;
  chosenSpringRate: number; bump: number; droop: number; dampingRatio: number;
}

/** Motion ratio from 3D rocker geometry (FRS 2.0): MR = L_d·cosθ_d / (L_p·cosθ_p). */
export function mrFromGeometry(Ldamper: number, thDamper: number, Lpushrod: number, thPushrod: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  return (Ldamper * Math.cos(rad(thDamper))) / (Lpushrod * Math.cos(rad(thPushrod)));
}

function side(s: SpringSide, sprungCorner: number, ktNmm: number) {
  const Kt = ktNmm * 1000;                                  // N/mm → N/m
  const Kr = (TWO_PI * s.targetFreq) ** 2 * sprungCorner;   // ride rate (N/m)
  const Kw = Kt > Kr ? (Kr * Kt) / (Kt - Kr) : NaN;         // wheel rate w/ tyre in series
  const Ks = Kw / s.motionRatio ** 2;                        // spring rate (N/m)
  // Re-check ride frequency with the chosen spring (spring via MR, in series with tyre).
  let recheckFreq = NaN;
  if (s.chosenSpringRate > 0 && sprungCorner > 0) {
    const KwChosen = s.chosenSpringRate * 1000 * s.motionRatio ** 2;  // N/m at the wheel
    const KrChosen = (KwChosen * Kt) / (KwChosen + Kt);               // in series with tyre
    recheckFreq = Math.sqrt(KrChosen / sprungCorner) / TWO_PI;
  }
  const springTravel = (s.bump + s.droop) * s.motionRatio;
  const critDamping = 2 * Math.sqrt(Kw * sprungCorner);     // N·s/m at the wheel
  const damperRate = s.dampingRatio * critDamping;
  // Roll stiffness contribution from this axle's springs: Kφ = ½·Kw·t² (N·m/rad).
  return {
    sprungCorner, rideRate: Kr / 1000, wheelRate: Kw / 1000, springRate: Ks / 1000,
    recheckFreq, springTravel, critDamping, damperRate, _Kw: Kw,
  };
}

export function springsCompute(front: SpringSide, rear: SpringSide, m: SpringsMaster): Out {
  const frontSprung = (m.mass * m.ff) / 2 - front.unsprung;
  const rearSprung = (m.mass * (1 - m.ff)) / 2 - rear.unsprung;
  const f = side(front, frontSprung, m.kt);
  const r = side(rear, rearSprung, m.kt);

  const out: Out = {};
  for (const [p, o] of [['f', f], ['r', r]] as const) {
    out[`${p}_sprungCorner`] = o.sprungCorner;
    out[`${p}_rideRate`] = o.rideRate;
    out[`${p}_wheelRate`] = o.wheelRate;
    out[`${p}_springRate`] = o.springRate;
    out[`${p}_recheckFreq`] = o.recheckFreq;
    out[`${p}_springTravel`] = o.springTravel;
    out[`${p}_critDamping`] = o.critDamping;
    out[`${p}_damperRate`] = o.damperRate;
  }

  // Roll stiffness (springs only; ARBs come in §6.7) and roll gradient.
  const tf = m.trackFront / 1000, tr = m.trackRear / 1000; // mm → m
  const kRollFront = 0.5 * f._Kw * tf * tf;                // N·m/rad
  const kRollRear = 0.5 * r._Kw * tr * tr;
  const kRollTotal = kRollFront + kRollRear;
  out.rollStiffFront = (kRollFront * Math.PI) / 180;       // N·m/deg
  out.rollStiffRear = (kRollRear * Math.PI) / 180;
  const rollMomentPerG = m.mass * 9.81 * (m.cogHeight / 1000); // N·m at 1 g
  out.rollGradient = Number.isFinite(kRollTotal) && kRollTotal > 0
    ? (rollMomentPerG / kRollTotal) * (180 / Math.PI) : NaN;  // deg/g
  return out;
}

/** Damper catalog (representative lengths/travel, mm) — verify against datasheets. */
export const DAMPER_PRESETS: Record<string, { eye: number; travel: number }> = {
  'FOX DHX2 (eye 190 / travel 50)': { eye: 190, travel: 50 },
  'Öhlins TTX25 (eye 200 / travel 57)': { eye: 200, travel: 57 },
};
