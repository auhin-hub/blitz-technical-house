/** Steering effort (handoff P1.6) vs hand-computed values. */
import { it, expect } from 'vitest';
import { steeringEffortCompute } from './vd-steering';

it('steering-wheel torque at max lateral grip', () => {
  const r = steeringEffortCompute(
    { caster: 5, pneumaticTrail: 30, scrubRadius: 10, fx: 0, steeringArm: 90, steeringRatio: 5, efficiency: 0.9 },
    { mu_lat_peak: 1.5, axle_load_front: 1300, rolling_radius: 228 },
  );
  expect(r.fyTyre).toBeCloseTo(975, 0);
  expect(r.kingpinMoment).toBeCloseTo(48.62, 1);   // 975·(0.228·sin5° + 0.030)
  expect(r.rackForce).toBeCloseTo(1081, 0);         // 2·M_kp / 0.090
  expect(r.swTorque).toBeCloseTo(21.6, 1);          // 2·M_kp / (5·0.9)
});

it('braking force adds a scrub-radius term', () => {
  const base = steeringEffortCompute({ caster: 5, pneumaticTrail: 30, scrubRadius: 10, fx: 0, steeringArm: 90, steeringRatio: 5, efficiency: 0.9 }, { mu_lat_peak: 1.5, axle_load_front: 1300, rolling_radius: 228 });
  const braked = steeringEffortCompute({ caster: 5, pneumaticTrail: 30, scrubRadius: 10, fx: 2000, steeringArm: 90, steeringRatio: 5, efficiency: 0.9 }, { mu_lat_peak: 1.5, axle_load_front: 1300, rolling_radius: 228 });
  expect(braked.kingpinMoment - base.kingpinMoment).toBeCloseTo(20, 6); // 0.010·2000
});
