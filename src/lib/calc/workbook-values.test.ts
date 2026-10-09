/**
 * Unit tests: every pure compute() vs the workbook's own computed values
 * (captured from the real .xlsx). This is the "numbers match the Excel Master"
 * gate from MASTER_BUILD_PLAN §10 — if a refactor breaks a formula, this fails.
 */
import { describe, it, expect } from 'vitest';
import { brakesCompute } from './vd-brakes';
import { springsCompute } from './vd-springs';
import { loadsCompute } from './vd-loads';
import { steeringCompute } from './vd-steering';
import { geometryCompute } from './vd-geometry';
import { tractionCompute } from './pt-traction';
import { aeroCompute } from './aero';
import { tubeCompute } from './chassis-tube';
import { massCompute } from './chassis-mass';
import { powerCompute } from './elec-power';
import { daqCompute } from './daq';

// Workbook Master values used by the VD/PT sheets (the current-car leftovers the
// sheets were built with — exact, so outputs reproduce the workbook).
const FF = 0.456867057673509;
const H = 263.409090909091;
const L = 1550;
const MU = 1.5;
const MASS = 264;

describe('VD · Brakes (Brakes sheet)', () => {
  const front = { pedalForce: 400, pedalRatio: 5, mcBore: 15.875, circuits: 2, caliperBore: 25, pistons: 2, padMu: 0.45, rotorOd: 180, padDepth: 27 };
  const rear = { ...front, pistons: 1 };
  const inp: Record<string, number> = {};
  for (const [k, v] of Object.entries(front)) inp[`f_${k}`] = v;
  for (const [k, v] of Object.entries(rear)) inp[`r_${k}`] = v;
  const out = brakesCompute(inp, { mass_frac_front: FF, cog_height: H, wheelbase: L, mu_lat_peak: MU });

  it('front chain', () => {
    expect(out.f_pushrodForce).toBeCloseTo(2000, 6);
    expect(out.f_linePressureKpa).toBeCloseTo(5052.2246, 3);
    expect(out.f_clamp).toBeCloseTo(4960.0099, 3);
    expect(out.f_friction).toBeCloseTo(4464.0089, 3);
    expect(out.f_effRadius).toBeCloseTo(0.0772941, 6);
    expect(out.f_brakeTorque).toBeCloseTo(345.0416, 3);
  });
  it('rear torque + bias + Olley', () => {
    expect(out.r_brakeTorque).toBeCloseTo(172.5208, 3);
    expect(out.achievedFrontBias).toBeCloseTo(0.6666667, 6);
    expect(out.olleyOptimum).toBeCloseTo(0.7117791, 6);
  });
});

describe('VD · Springs & dampers (SpringsDampers sheet)', () => {
  const inp: Record<string, number> = {
    f_motionRatio: 0.7, f_unsprung: 12, f_targetFreq: 2.8, f_chosenRate: 0, f_bump: 30, f_droop: 25, f_dampingRatio: 0.65,
    r_motionRatio: 0.7, r_unsprung: 12, r_targetFreq: 3, r_chosenRate: 0, r_bump: 25, r_droop: 25, r_dampingRatio: 0.65,
  };
  const out = springsCompute(inp, { mass_total: MASS, mass_frac_front: FF });
  it('front', () => {
    expect(out.f_sprungCorner).toBeCloseTo(48.3064516, 5);
    expect(out.f_wheelRate).toBeCloseTo(14.9513682, 5);
    expect(out.f_springRate).toBeCloseTo(30.5129963, 5);
    expect(out.f_springTravel).toBeCloseTo(38.5, 6);
    expect(out.f_criticalDamping).toBeCloseTo(1699.70297, 3);
  });
  it('rear', () => {
    expect(out.r_sprungCorner).toBeCloseTo(59.6935484, 5);
    expect(out.r_wheelRate).toBeCloseTo(21.2094615, 5);
    expect(out.r_springRate).toBeCloseTo(43.2846153, 5);
  });
  it('recheck frequency is NaN when no chosen rate', () => {
    expect(Number.isNaN(out.f_recheckFreq)).toBe(true);
  });
});

describe('VD · Suspension loads (SuspensionLoads sheet)', () => {
  const inp: Record<string, number> = {
    f_dmf: 3, f_downforce: 50, f_pushrodAngle: 45, f_svsaAngle: 8, f_share: 0.65,
    r_dmf: 3, r_downforce: 50, r_pushrodAngle: 45, r_svsaAngle: 6, r_share: 1,
  };
  const out = loadsCompute(inp, { mass_total: MASS, mass_frac_front: FF, wheelbase: L, cog_height: H });
  it('front/rear', () => {
    expect(out.f_staticCorner).toBeCloseTo(591.6063, 3);
    expect(out.f_maxVertical).toBeCloseTo(1824.8189, 3);
    expect(out.f_pushrodForce).toBeCloseTo(2580.6836, 3);
    expect(out.f_antiPct).toBeCloseTo(0.5375475, 6);
    expect(out.r_staticCorner).toBeCloseTo(703.3137, 3);
    expect(out.r_antiPct).toBeCloseTo(0.6184736, 6);
  });
});

describe('VD · Steering (Steering sheet)', () => {
  const out = steeringCompute(
    { turningRadius: 3.5, pinionPitchDia: 50, teeth: 18, kingpinDist: 1100, steeringArm: 90, rackTravel: 120, swTurns: 1.5 },
    { wheelbase: L, track_front: 1200 },
  );
  it('ackermann + gear geometry', () => {
    expect(out.ackermannSplit).toBeCloseTo(7.4146978, 5);
    expect(out.module).toBeCloseTo(2.7777778, 6);
    expect(out.circularPitch).toBeCloseTo(8.7266463, 5);
    expect(out.baseDia).toBeCloseTo(46.9846310, 5);
    expect(out.rackTravelPerRev).toBeCloseTo(157.0796327, 5);
  });
});

describe('VD · Geometry derived angles (SuspensionGeom sheet)', () => {
  const out = geometryCompute({ caster: 5, kpi: 6 });
  it('caster/KPI in radians', () => {
    expect(out.casterRad).toBeCloseTo(1.4835299, 6); // RADIANS(90-5)
    expect(out.kpiRad).toBeCloseTo(0.1047198, 6);     // RADIANS(6)
  });
});

describe('Powertrain · Drivetrain & traction (Powertrain sheet)', () => {
  const out = tractionCompute(
    { peakTorque: 35.3, peakPower: 32, peakRpm: 9500, primary: 3, firstGear: 2.5, finalDrive: 3, drivelineEff: 0.9 },
    { rolling_radius: 228, axle_load_rear: 1406.62741935484, mu_lat_peak: MU, mass_total: MASS },
  );
  it('torque/force/limit/accel/verdict', () => {
    expect(out.wheelTorque).toBeCloseTo(714.825, 3);
    expect(out.tractiveForce).toBeCloseTo(3135.1974, 3);
    expect(out.tractionLimit).toBeCloseTo(2109.9411, 3);
    expect(out.launchAccel).toBeCloseTo(0.8146994, 6);
    expect(out.gripLimited).toBe('Yes — traction limited');
  });
});

describe('Aerodynamics · downforce/drag (Aero sheet)', () => {
  const out = aeroCompute({ clA: 0.8, cdA: 0.6, rho: 1.18, aeroBalance: 0.45 }, { mass_total: MASS });
  it('40 and 120 km/h + L/D', () => {
    expect(out.df_40).toBeCloseTo(58.2716, 3);
    expect(out.drag_40).toBeCloseTo(43.7037, 3);
    expect(out.pct_40).toBeCloseTo(2.2500079, 5);  // percent (workbook fraction ×100)
    expect(out.df_120).toBeCloseTo(524.4444, 3);
    expect(out.ld).toBeCloseTo(1.3333333, 6);
  });
});

describe('Chassis · tube stress & FoS (Chassis sheet)', () => {
  const out = tubeCompute({ memberForce: 1455, tubeOd: 25, tubeWall: 2, yield: 435, torsionMeasured: 0 });
  it('area/stress/FoS', () => {
    expect(out.sectionArea).toBeCloseTo(144.5132621, 5);
    expect(out.axialStress).toBeCloseTo(10.0682801, 5);
    expect(out.fos).toBeCloseTo(43.2049959, 5);
  });
});

describe('Chassis · component-mass tracker (ComponentMass sheet)', () => {
  // The sheet shipped empty; assert the formula CAD=unit·qty, Δ=meas−CAD, totals.
  const out = massCompute({ unit_frontUpperArm: 0.5, qty_frontUpperArm: 2, meas_frontUpperArm: 1.1 });
  it('cad/delta/totals', () => {
    expect(out.cad_frontUpperArm).toBeCloseTo(1.0, 6);
    expect(out.delta_frontUpperArm).toBeCloseTo(0.1, 6);
    expect(out.totalCad).toBeCloseTo(1.0, 6);
    expect(out.totalMeas).toBeCloseTo(1.1, 6);
    expect(out.totalDelta).toBeCloseTo(0.1, 6);
  });
});

describe('Electronics · power budget (Electronics sheet)', () => {
  const out = powerCompute({ ecuSensors: 3, fuelPump: 5, fan: 8, daqTelemetry: 2, dashLights: 2, ignitionCoils: 6, stator: 22.1, mainFuse: 150, batteryMass: 4 });
  it('total + margin', () => {
    expect(out.total).toBeCloseTo(26, 6);
    expect(out.margin).toBeCloseTo(-3.9, 6);
  });
});

describe('DAQ · CAN bus load (DAQ_Telemetry sheet)', () => {
  const inp: Record<string, number> = { capacity: 500000 };
  const defaults: [string, number, number][] = [
    ['damperPos', 500, 8], ['imu', 200, 12], ['wheelSpeed', 200, 8], ['steering', 100, 2],
    ['brakePressure', 200, 4], ['throttle', 100, 2], ['pushrodLoad', 500, 8], ['tyreTempPress', 10, 8], ['gps', 20, 16],
  ];
  for (const [k, rate, bytes] of defaults) { inp[`rate_${k}`] = rate; inp[`bytes_${k}`] = bytes; }
  const out = daqCompute(inp);
  it('total + utilisation', () => {
    expect(out.totalBusLoad).toBeCloseTo(108800, 6);
    expect(out.utilisation).toBeCloseTo(21.76, 4); // percent
  });
});
