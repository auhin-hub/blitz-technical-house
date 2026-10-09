/**
 * Vehicle Dynamics — Brakes. Ported verbatim from the Brakes sheet of
 * Blitz_Vehicle_Dynamics_WorkingFile.xlsx (see TOOL_SPECS §7b). Pure functions
 * so the formulas are auditable against the workbook; no invented maths.
 *
 * Workbook cell trail (Front = column B):
 *   pushrod force   B10 = B6*B7
 *   MC area         B11 = PI()*(B8/1000)^2/4
 *   line pressure   B12 = B10/(B11*B9)           (Pa);  B13 = B12/1000 (kPa)
 *   caliper area    B20 = PI()*(B15/1000)^2/4
 *   clamp force     B21 = B12*B20*B16
 *   friction force  B22 = B21*2*B17
 *   eff. radius     B23 = (2/3)*(((Ro)^3-(Ro-depth)^3)/((Ro)^2-(Ro-depth)^2))/1000, Ro=OD/2 (→ m)
 *   brake torque    B24 = B22*B23                 (N·m per wheel)
 *   achieved bias   B25 = B24/(B24+C24)
 *   Olley optimum   B32 = ff + μ*(h/L)
 *   decel sweep     Bn  = ff + g*(h/L)   for g = 0.4 … 1.4
 */

export interface BrakeSide {
  pedalForce: number;   // N
  pedalRatio: number;   // -
  mcBore: number;       // mm
  circuits: number;     // 1 or 2
  caliperBore: number;  // mm
  pistons: number;      // per side
  padMu: number;        // -
  rotorOd: number;      // mm
  padDepth: number;     // mm (pad radial depth)
}

export interface BrakeSideOut {
  pushrodForce: number;   // N
  mcArea: number;         // m²
  linePressurePa: number; // Pa
  linePressureKpa: number;// kPa
  caliperArea: number;    // m²
  clamp: number;          // N
  friction: number;       // N
  effRadius: number;      // m
  brakeTorque: number;    // N·m per wheel
}

export interface BrakeMaster { ff: number; h: number; L: number; mu: number; } // h, L in mm

export interface BrakeResult {
  front: BrakeSideOut;
  rear: BrakeSideOut;
  achievedFrontBias: number;
  olleyOptimum: number;
  sweep: { g: number; optimumFrontBias: number }[];
}

export const DECEL_SWEEP = [0.4, 0.6, 0.8, 1.0, 1.2, 1.4];

function computeSide(s: BrakeSide): BrakeSideOut {
  const pushrodForce = s.pedalForce * s.pedalRatio;
  const mcArea = (Math.PI * (s.mcBore / 1000) ** 2) / 4;
  const linePressurePa = pushrodForce / (mcArea * s.circuits);
  const linePressureKpa = linePressurePa / 1000;
  const caliperArea = (Math.PI * (s.caliperBore / 1000) ** 2) / 4;
  const clamp = linePressurePa * caliperArea * s.pistons;
  const friction = clamp * 2 * s.padMu;
  const ro = s.rotorOd / 2;
  const ri = ro - s.padDepth;
  const effRadius = ((2 / 3) * ((ro ** 3 - ri ** 3) / (ro ** 2 - ri ** 2))) / 1000;
  const brakeTorque = friction * effRadius;
  return { pushrodForce, mcArea, linePressurePa, linePressureKpa, caliperArea, clamp, friction, effRadius, brakeTorque };
}

export function computeBrakes(front: BrakeSide, rear: BrakeSide, m: BrakeMaster): BrakeResult {
  const f = computeSide(front);
  const r = computeSide(rear);
  const achievedFrontBias = f.brakeTorque / (f.brakeTorque + r.brakeTorque);
  const hOverL = m.h / m.L;
  const olleyOptimum = m.ff + m.mu * hOverL;
  const sweep = DECEL_SWEEP.map((g) => ({ g, optimumFrontBias: m.ff + g * hOverL }));
  return { front: f, rear: r, achievedFrontBias, olleyOptimum, sweep };
}

export const BRAKE_DEFAULTS: { front: BrakeSide; rear: BrakeSide } = {
  front: { pedalForce: 400, pedalRatio: 5, mcBore: 15.875, circuits: 2, caliperBore: 25, pistons: 2, padMu: 0.45, rotorOd: 180, padDepth: 27 },
  rear:  { pedalForce: 400, pedalRatio: 5, mcBore: 15.875, circuits: 2, caliperBore: 25, pistons: 1, padMu: 0.45, rotorOd: 180, padDepth: 27 },
};
