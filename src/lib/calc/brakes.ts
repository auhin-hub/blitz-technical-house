/**
 * Brake system — Sizing + Bias sweep (MASTER_BUILD_PLAN §6.6).
 * The per-side hydraulic chain is the canonical §6.6 form, reused from
 * vd-brakes.ts (already unit-tested against the Brakes sheet). This module adds
 * the dynamic axle loads, required wheel torque, a recommended MC diameter, and
 * the deceleration bias sweep (optimal vs achieved).
 *
 * Sources: §6.6 + the VD Brakes sheet; `Braking Calculation.xlsm` (Bhavik) for
 * the Advanced tab (ported separately). Hardware presets below are from makers'
 * published bores; anything unverified is flagged in the UI.
 */
import { computeBrakes, type BrakeSide } from './vd-brakes';
import type { Out } from './engine';

export const DECEL_SWEEP = [0.4, 0.6, 0.8, 1.0, 1.2, 1.4];
const G = 9.81;

export interface BrakeSystemMaster { ff: number; h: number; L: number; mu: number; tyreRadius: number; mass: number; }

/** Master-cylinder bore presets (mm). Published bores; verify for your exact part. */
export const MC_PRESETS: Record<string, number> = {
  'Tilton 78-series 0.625"': 15.88,
  'Tilton 78-series 0.700"': 17.78,
  'Tilton 78-series 0.750"': 19.05,
  'Tilton 78-series 0.875"': 22.23,
};
/** Caliper piston-bore presets (mm) — representative; verify against the datasheet. */
export const CALIPER_PRESETS: Record<string, number> = {
  'ISR 22-048/049': 25.4,
  'Wilwood GP200': 31.75,
};

export function computeBrakeSystem(
  front: BrakeSide, rear: BrakeSide, m: BrakeSystemMaster, targetDecel: number,
): Out {
  // Canonical per-side chain (tested). computeBrakes returns a typed, nested
  // result; flatten it to f_*/r_* keys for the UI.
  const base = computeBrakes(front, rear, { ff: m.ff, h: m.h, L: m.L, mu: m.mu });
  const out: Out = { achievedFrontBias: base.achievedFrontBias, olleyOptimum: base.olleyOptimum };
  (['pushrodForce', 'linePressureKpa', 'clamp', 'friction', 'effRadius', 'brakeTorque'] as const).forEach((k) => {
    out[`f_${k}`] = base.front[k];
    out[`r_${k}`] = base.rear[k];
  });

  const W = m.mass * G;                 // total weight (N)
  const hL = m.h / m.L;                 // CoG height / wheelbase (both mm → ratio)
  const a = targetDecel;                // g

  // Dynamic axle loads at the target decel (longitudinal transfer W·a·h/L).
  out.dynFront = W * (m.ff + a * hL);
  out.dynRear = W * (1 - m.ff - a * hL);
  out.optimalBiasTarget = m.ff + a * hL;

  // Required braking force + per-wheel torque at the target decel (ideal bias).
  const totalForce = W * a;
  const Re = m.tyreRadius / 1000;       // mm → m
  out.reqWheelTorqueFront = (totalForce * out.optimalBiasTarget * Re) / 2;
  out.reqWheelTorqueRear = (totalForce * (1 - out.optimalBiasTarget) * Re) / 2;

  // Recommended front MC bore: pressure to make the required front torque with
  // the chosen caliper/rotor, then A_mc = pushrod / pressure → Ø. A sizing aid.
  const frontClampPerPressure = ((Math.PI * (front.caliperBore / 1000) ** 2) / 4) * front.pistons; // A·n
  const reqFrictionFront = out.reqWheelTorqueFront / base.front.effRadius; // N (friction needed)
  const reqClampFront = reqFrictionFront / (2 * front.padMu);
  const reqPressureFront = reqClampFront / frontClampPerPressure;          // Pa
  const pushrodFront = front.pedalForce * front.pedalRatio;                // N
  const recMcArea = pushrodFront / reqPressureFront;                       // m²
  out.recommendedMcDia = Number.isFinite(recMcArea) && recMcArea > 0 ? Math.sqrt((4 * recMcArea) / Math.PI) * 1000 : NaN; // mm

  return out;
}

/** Bias sweep: optimal (ff + g·h/L) vs achieved (hardware torque ratio, fixed). */
export function biasSweep(achievedFrontBias: number, m: BrakeSystemMaster) {
  const hL = m.h / m.L;
  return DECEL_SWEEP.map((g) => ({
    g,
    optimal: m.ff + g * hL,
    achieved: achievedFrontBias,
  }));
}
