/**
 * Fill MISSING driver measurements from stature. Measured values always win;
 * estimates are flagged so the UI can mark them. Sources:
 *  - Segment lengths as fractions of stature H: Drillis & Contini (1966), as
 *    reproduced in Winter, "Biomechanics and Motor Control of Human Movement"
 *    (thigh 0.245, shank 0.246, upper arm 0.186, forearm 0.146, hand 0.108,
 *    foot length 0.152, ankle height 0.039, shoulder height 0.818). The authors
 *    quote errors up to ~2 cm per segment — measure the driver.
 *  - Sitting height ≈ 0.52·H (Cormic index typical of adults).
 *  - Fist centre taken at half the hand length past the wrist.
 *  - Helmet adds ~50 mm above the head: the gap the rulebook's own template
 *    implies; measure sitting height with the helmet on instead.
 */
import type { DriverBody } from './geometry';

export const MEASUREMENTS: { key: keyof DriverBody; label: string; unit: string; how: string }[] = [
  { key: 'stature', label: 'Height (stature)', unit: 'mm', how: 'Standing, barefoot, floor to top of head.' },
  { key: 'mass', label: 'Mass in race gear', unit: 'kg', how: 'Suit, boots, helmet.' },
  { key: 'sittingHeight', label: 'Sitting height', unit: 'mm', how: 'Sitting erect on a flat seat: seat to top of head.' },
  { key: 'sittingHelmetHeight', label: 'Sitting height with helmet', unit: 'mm', how: 'Same, helmet on: seat to top of helmet.' },
  { key: 'sittingShoulderHeight', label: 'Sitting shoulder height', unit: 'mm', how: 'Seat to the bony tip of the shoulder (acromion).' },
  { key: 'thigh', label: 'Thigh length', unit: 'mm', how: 'Hip joint (greater trochanter, the bony bump at the side of the hip) to the knee joint line.' },
  { key: 'shank', label: 'Lower-leg length', unit: 'mm', how: 'Knee joint line to the outer ankle bone (lateral malleolus).' },
  { key: 'ankleHeight', label: 'Ankle height', unit: 'mm', how: 'Floor to the outer ankle bone, in race boots.' },
  { key: 'footLength', label: 'Foot length', unit: 'mm', how: 'Heel to toe, in race boots.' },
  { key: 'upperArm', label: 'Upper-arm length', unit: 'mm', how: 'Shoulder tip (acromion) to the elbow point.' },
  { key: 'forearmGrip', label: 'Elbow to grip', unit: 'mm', how: 'Elbow point to the centre of the closed fist.' },
];

export function estimateFromStature(H: number): Partial<DriverBody> {
  if (!(H > 0)) return {};
  const sitting = 0.52 * H;
  return {
    sittingHeight: sitting,
    sittingHelmetHeight: sitting + 50,
    sittingShoulderHeight: sitting - (1 - 0.818) * H,
    thigh: 0.245 * H,
    shank: 0.246 * H,
    ankleHeight: 0.039 * H,
    footLength: 0.152 * H,
    upperArm: 0.186 * H,
    forearmGrip: (0.146 + 0.108 / 2) * H,
  };
}

/** Measured values where present (> 0), estimates elsewhere; lists what was estimated. */
export function completeBody(measured: Partial<DriverBody>): { body: DriverBody; estimated: (keyof DriverBody)[] } {
  const est = estimateFromStature(Number(measured.stature));
  const body = {} as DriverBody;
  const estimated: (keyof DriverBody)[] = [];
  for (const m of MEASUREMENTS) {
    const v = Number(measured[m.key]);
    if (v > 0) body[m.key] = v;
    else if (est[m.key] !== undefined) { body[m.key] = est[m.key]!; estimated.push(m.key); }
    else body[m.key] = NaN;
  }
  // If only helmetless sitting height was measured, keep the helmet estimate tied to it.
  if (estimated.includes('sittingHelmetHeight') && !estimated.includes('sittingHeight')) body.sittingHelmetHeight = body.sittingHeight + 50;
  return { body, estimated };
}
