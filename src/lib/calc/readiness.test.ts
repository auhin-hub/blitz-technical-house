/** Component Readiness logic (Handoff v2 P4). */
import { it, expect } from 'vitest';
import { prereqStatus, componentReadiness, blockingSummary, type Component, type MasterCell } from './readiness';

const master: Record<string, MasterCell> = {
  rolling_radius: { value: 228, frozen: true },          // green
  cog_height: { value: 300, frozen: false },             // amber (set, unfrozen)
  wheelbase: { value: null, frozen: false },             // grey (unset)
  engine_selected: { value: null, text_value: 'KTM 390', frozen: true }, // green (text, frozen)
};
const outputs = { rc_height_static: { value: 48 }, brake_torque_front: { value: null } };

it('resolves status by freeze mechanic', () => {
  const mk = (source_type: any, source_key: string): any => ({ label: '', bin: 'blocking', source_type, source_key, produced_by_team: 'VD' });
  expect(prereqStatus(mk('master', 'rolling_radius'), master, outputs)).toBe('green');
  expect(prereqStatus(mk('master', 'cog_height'), master, outputs)).toBe('amber');
  expect(prereqStatus(mk('master', 'wheelbase'), master, outputs)).toBe('grey');
  expect(prereqStatus(mk('procurement', 'engine_selected'), master, outputs)).toBe('green');
  expect(prereqStatus(mk('tool_output', 'rc_height_static'), master, outputs)).toBe('green');
  expect(prereqStatus(mk('tool_output', 'brake_torque_front'), master, outputs)).toBe('grey');
});

const comp: Component = {
  name: 'Front Upright', owner_team: 'VD', subassembly: 'Corner',
  prereqs: [
    { label: 'RC frozen', bin: 'blocking', source_type: 'tool_output', source_key: 'rc_height_static', produced_by_team: 'VD' },
    { label: 'Rolling radius', bin: 'blocking', source_type: 'master', source_key: 'rolling_radius', produced_by_team: 'Tyre' },
    { label: 'Brake torque', bin: 'blocking', source_type: 'tool_output', source_key: 'brake_torque_front', produced_by_team: 'Brake' },
    { label: 'CoG (nice to have)', bin: 'soft', source_type: 'master', source_key: 'cog_height', produced_by_team: 'VD' },
  ],
};

it('component is not ready while a blocking item is pending; names the owner', () => {
  const r = componentReadiness(comp, master, outputs);
  expect(r.ready).toBe(false);
  expect(r.blockingTotal).toBe(3);
  expect(r.blockingGreen).toBe(2);
  expect(r.pending).toEqual([{ label: 'Brake torque', team: 'Brake', source_key: 'brake_torque_front', status: 'grey' }]);
});

it('freezing/contributing the last blocking item flips it ready', () => {
  const r = componentReadiness(comp, master, { ...outputs, brake_torque_front: { value: 120 } });
  expect(r.ready).toBe(true);
});

it('blockingSummary ranks the gating key', () => {
  const s = blockingSummary([comp], master, outputs);
  expect(s[0]).toEqual({ source_key: 'brake_torque_front', team: 'Brake', count: 1 });
});
