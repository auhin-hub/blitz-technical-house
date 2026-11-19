/**
 * Minimal ASCII DXF (R12) writer — LINE and CIRCLE on named layers — so the
 * posed figures can be imported into a SolidWorks sketch (File → Open → DXF,
 * or Insert → DXF/DWG on a side-plane sketch). Units are millimetres:
 * DXF X = studio x (rearward from the front axle), DXF Y = z (up from ground).
 */
import type { Pt } from './geometry';

export type DxfEntity =
  | { kind: 'line'; layer: string; a: Pt; b: Pt }
  | { kind: 'circle'; layer: string; c: Pt; r: number };

const n = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : '0');
const layerName = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, '_').toUpperCase().slice(0, 31) || 'LAYER';

export function toDxf(entities: DxfEntity[]): string {
  // R12 has no units header — SolidWorks asks on import: choose millimetres.
  const out: string[] = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES'];
  for (const e of entities) {
    if (e.kind === 'line') {
      if (![e.a.x, e.a.z, e.b.x, e.b.z].every(Number.isFinite)) continue;
      out.push('0', 'LINE', '8', layerName(e.layer), '10', n(e.a.x), '20', n(e.a.z), '30', '0', '11', n(e.b.x), '21', n(e.b.z), '31', '0');
    } else {
      if (![e.c.x, e.c.z, e.r].every(Number.isFinite)) continue;
      out.push('0', 'CIRCLE', '8', layerName(e.layer), '10', n(e.c.x), '20', n(e.c.z), '30', '0', '40', n(e.r));
    }
  }
  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\r\n') + '\r\n';
}
