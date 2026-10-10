/**
 * Lateral load-transfer calculator (handoff P2.5). Steady-state, per axle, the
 * standard geometric + elastic + unsprung decomposition (Milliken RCVD):
 *   geometric : ΔW_geo  = W_sprung,axle · ay · z_RC / t
 *   elastic   : M_roll  = W_sprung · ay · (h_cg − h_rollaxis);
 *               ΔW_el   = M_roll · (K_axle/ΣK) / t
 *   unsprung  : ΔW_u    = W_unsprung,axle · ay · h_unsprung / t
 *   ΔW_axle   = geo + elastic + unsprung;  per-corner = static ± ΔW_axle
 * Achieved TLLTD_front = ΔW_front / (ΔW_front + ΔW_rear). ay in g; lengths mm→m.
 * The roll-axis height under the CG is interpolated between the two RC heights.
 */
const G = 9.81;

export interface LtMaster { mass: number; ff: number; cogHeight: number; trackFront: number; trackRear: number; unsprungCorner: number; }
export interface LtInput { ay: number; rcFront: number; rcRear: number; kRollFront: number; kRollRear: number; unsprungCog: number; }

export function loadTransfer(i: LtInput, m: LtMaster) {
  const W = m.mass * G;
  const tf = m.trackFront / 1000, tr = m.trackRear / 1000, hCg = m.cogHeight / 1000;
  const rcF = i.rcFront / 1000, rcR = i.rcRear / 1000, hU = i.unsprungCog / 1000;

  const WuAxle = 2 * m.unsprungCorner * G;         // unsprung weight per axle
  const Ws = W - 4 * m.unsprungCorner * G;          // total sprung weight
  const WsF = Ws * m.ff, WsR = Ws * (1 - m.ff);
  const hRA = rcF + (rcR - rcF) * (1 - m.ff);        // roll-axis height under the CG
  const Ktot = i.kRollFront + i.kRollRear;

  const geoF = (WsF * i.ay * rcF) / tf, geoR = (WsR * i.ay * rcR) / tr;
  const Mroll = Ws * i.ay * (hCg - hRA);
  const elF = Ktot > 0 ? (Mroll * (i.kRollFront / Ktot)) / tf : NaN;
  const elR = Ktot > 0 ? (Mroll * (i.kRollRear / Ktot)) / tr : NaN;
  const uF = (WuAxle * i.ay * hU) / tf, uR = (WuAxle * i.ay * hU) / tr;

  const dWFront = geoF + elF + uF, dWRear = geoR + elR + uR;
  const tlltdFront = dWFront + dWRear > 0 ? dWFront / (dWFront + dWRear) : NaN;
  const Wf = W * m.ff, Wr = W * (1 - m.ff);
  return {
    dWFront, dWRear, tlltdFront,
    frontOuter: Wf / 2 + dWFront, frontInner: Wf / 2 - dWFront,
    rearOuter: Wr / 2 + dWRear, rearInner: Wr / 2 - dWRear,
    geoFront: geoF, elasticFront: elF, unsprungFront: uF,
  };
}
