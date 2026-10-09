/**
 * MassBudget + weight/balance (MASTER_BUILD_PLAN §6.2, FRS 2.0 component list).
 * A CAD-vs-measured component table → total mass, CG, yaw inertia and front
 * fraction, written to the Master.
 *
 * Coordinate convention: x = longitudinal from the FRONT axle (0 at front,
 * = wheelbase at rear); y = lateral from centreline (+ = right); z = height
 * from ground. Then front axle fraction = 1 − x_cg / wheelbase (§6.2).
 *
 *   total   = Σ mass
 *   x_cg    = Σ(mass·x) / total                 (same for y_cg, z_cg)
 *   Izz     = Σ mass·(((x−x_cg)/1000)² + ((y−y_cg)/1000)²)   (mm → m)
 *   ff      = 1 − x_cg / wheelbase
 */

export interface MbComponent { key: string; name: string; subsystem: string; unsprung: boolean; }

/** Seed component list (names only — masses/coords are entered by the team). */
export const MB_COMPONENTS: MbComponent[] = [
  { key: 'fua', name: 'Front upper arms', subsystem: 'Suspension', unsprung: true },
  { key: 'fla', name: 'Front lower arms', subsystem: 'Suspension', unsprung: true },
  { key: 'rua', name: 'Rear upper arms', subsystem: 'Suspension', unsprung: true },
  { key: 'rla', name: 'Rear lower arms', subsystem: 'Suspension', unsprung: true },
  { key: 'pushrods', name: 'Pushrods', subsystem: 'Suspension', unsprung: true },
  { key: 'bellcranks', name: 'Bellcranks', subsystem: 'Suspension', unsprung: false },
  { key: 'dampers', name: 'Dampers / springs', subsystem: 'Suspension', unsprung: false },
  { key: 'uprights', name: 'Uprights / knuckles', subsystem: 'Wheel corner', unsprung: true },
  { key: 'hubs', name: 'Wheel hubs', subsystem: 'Wheel corner', unsprung: true },
  { key: 'wheels', name: 'Wheels', subsystem: 'Wheel corner', unsprung: true },
  { key: 'tyres', name: 'Tyres', subsystem: 'Wheel corner', unsprung: true },
  { key: 'rotors', name: 'Brake rotors', subsystem: 'Wheel corner', unsprung: true },
  { key: 'calipers', name: 'Brake calipers', subsystem: 'Wheel corner', unsprung: true },
  { key: 'chassis', name: 'Chassis / frame', subsystem: 'Chassis', unsprung: false },
  { key: 'engine', name: 'Engine', subsystem: 'Powertrain', unsprung: false },
  { key: 'drivetrain', name: 'Drivetrain (diff, chain)', subsystem: 'Powertrain', unsprung: false },
  { key: 'driver', name: 'Driver', subsystem: 'Driver', unsprung: false },
  { key: 'battery', name: 'Battery', subsystem: 'Electrical', unsprung: false },
  { key: 'electronics', name: 'Electronics / harness', subsystem: 'Electrical', unsprung: false },
  { key: 'bodywork', name: 'Bodywork / aero', subsystem: 'Aero / body', unsprung: false },
  { key: 'cooling', name: 'Cooling', subsystem: 'Cooling', unsprung: false },
  { key: 'misc', name: 'Fasteners / misc', subsystem: 'Misc', unsprung: false },
];

export interface MbRow { mass: number; x: number; y: number; z: number; unsprung: boolean; subsystem: string; }
export interface MbResult {
  total: number; xCg: number; yCg: number; zCg: number; izz: number;
  frontFraction: number; sprung: number; unsprung: number;
  bySubsystem: Record<string, number>;
}

export function massBudget(rows: MbRow[], wheelbase: number): MbResult {
  const valid = rows.filter((r) => Number.isFinite(r.mass) && r.mass > 0);
  const total = valid.reduce((s, r) => s + r.mass, 0);
  const bySubsystem: Record<string, number> = {};
  let sprung = 0, unsprung = 0;
  for (const r of valid) {
    bySubsystem[r.subsystem] = (bySubsystem[r.subsystem] ?? 0) + r.mass;
    if (r.unsprung) unsprung += r.mass; else sprung += r.mass;
  }
  if (total === 0) {
    return { total: 0, xCg: NaN, yCg: NaN, zCg: NaN, izz: NaN, frontFraction: NaN, sprung, unsprung, bySubsystem };
  }
  const xCg = valid.reduce((s, r) => s + r.mass * r.x, 0) / total;
  const yCg = valid.reduce((s, r) => s + r.mass * r.y, 0) / total;
  const zCg = valid.reduce((s, r) => s + r.mass * r.z, 0) / total;
  const izz = valid.reduce((s, r) => s + r.mass * (((r.x - xCg) / 1000) ** 2 + ((r.y - yCg) / 1000) ** 2), 0);
  const frontFraction = Number.isFinite(wheelbase) && wheelbase > 0 ? 1 - xCg / wheelbase : NaN;
  return { total, xCg, yCg, zCg, izz, frontFraction, sprung, unsprung, bySubsystem };
}
