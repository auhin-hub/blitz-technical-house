/**
 * Task Map graph logic. Two halves: a small hand-built graph where every answer
 * is checkable by eye, and integrity tests against the REAL shipped seed, so a
 * hand-edit to public/data/taskmap-seed.json that breaks a reference or creates
 * a forward cycle fails here instead of halfway through a database load.
 */
import { describe, it, expect } from 'vitest';
// Imported, not read from disk, so this needs no node typings and fails loudly
// if the shipped seed file ever stops being valid JSON.
import seedJson from '../../../public/data/taskmap-seed.json';
import {
  buildGraph, chain, blockers, readyToStart, stallImpact, handoffMatrix,
  loopMembers, criticalPath, forwardCycles, searchActivities, seedToRows,
  progressByPhase, progressByBucket, coDesignPartners, coDesignPairs,
  type Activity, type Dependency, type SeedFile,
} from './taskmap';

const act = (code: string, bucket: string, phase: string, extra: Partial<Activity> = {}): Activity =>
  ({ code, bucket_key: bucket, phase_key: phase, title: code, status: 'not_started', ...extra });

const dep = (from: string, to: string, label = '', is_feedback = false): Dependency =>
  ({ from_code: from, to_code: to, label, is_feedback });

describe('hand-built graph', () => {
  //  A ─▶ B ─▶ C          (forward chain)
  //  A ─▶ D               (branch)
  //  C ─feedback▶ A       (deliberate loop-back)
  //  E                    (isolated)
  const activities = [
    act('A', 'VD', 'P1', { is_critical: true }),
    act('B', 'CH', 'P2', { is_critical: true }),
    act('C', 'CH', 'P3'),
    act('D', 'PT', 'P2'),
    act('E', 'DOC', 'P0'),
  ];
  const deps = [
    dep('A', 'B', 'hardpoints'),
    dep('B', 'C', 'frame loads'),
    dep('A', 'D', 'targets'),
    dep('C', 'A', 'test findings', true),
  ];
  const g = buildGraph(activities, deps);

  it('indexes edges both ways and ignores edges to unknown codes', () => {
    expect(g.outs.get('A')!.map((e) => e.to_code).sort()).toEqual(['B', 'D']);
    expect(g.ins.get('C')!.map((e) => e.from_code)).toEqual(['B']);
    const g2 = buildGraph(activities, [...deps, dep('A', 'GHOST')]);
    expect(g2.outs.get('A')).toHaveLength(2);           // the ghost edge is dropped
  });

  it('chains follow forward edges only, so a feedback loop cannot hang them', () => {
    expect([...chain(g, 'A', 'down')].sort()).toEqual(['B', 'C', 'D']);
    expect([...chain(g, 'C', 'up')].sort()).toEqual(['A', 'B']);
    // With feedback included, A is reachable downstream of itself — which is
    // exactly what a loop means, and why prerequisites never use this mode.
    expect(chain(g, 'A', 'down', { includeFeedback: true }).has('A')).toBe(false); // start excluded
    expect([...chain(g, 'C', 'down', { includeFeedback: true })].sort()).toEqual(['A', 'B', 'D']);
    expect([...chain(g, 'A', 'down', { maxDepth: 1 })].sort()).toEqual(['B', 'D']);
  });

  it('blockers are direct, unfinished and named with the missing hand-off', () => {
    expect(blockers(g, 'B').map((b) => [b.activity.code, b.label])).toEqual([['A', 'hardpoints']]);
    const gDone = buildGraph(activities.map((a) => (a.code === 'A' ? { ...a, status: 'done' as const } : a)), deps);
    expect(blockers(gDone, 'B')).toEqual([]);
    // A feedback edge is never a blocker, or the loop would deadlock.
    expect(blockers(g, 'A')).toEqual([]);
  });

  it('readyToStart lists the unblocked work, critical first', () => {
    expect(readyToStart(g).map((a) => a.code)).toEqual(['A', 'E']);
    const gA = buildGraph(activities.map((a) => (a.code === 'A' ? { ...a, status: 'done' as const } : a)), deps);
    expect(readyToStart(gA).map((a) => a.code)).toEqual(['B', 'D', 'E']);
  });

  it('stallImpact counts the unfinished work each activity holds up', () => {
    const rank = stallImpact(g);
    expect(rank[0].activity.code).toBe('A');
    expect(rank[0].blocks).toBe(3);                      // B, C and D
    expect(rank.find((r) => r.activity.code === 'E')!.blocks).toBe(0);
    // Finishing something removes it from the ranking entirely.
    const gA = buildGraph(activities.map((a) => (a.code === 'A' ? { ...a, status: 'done' as const } : a)), deps);
    expect(stallImpact(gA).some((r) => r.activity.code === 'A')).toBe(false);
  });

  it('handoffMatrix separates cross-team interfaces from internal sequencing', () => {
    const { cells, internal } = handoffMatrix(g);
    expect(internal).toEqual({ CH: 1 });                 // B→C is inside Chassis
    const vdToCh = cells.find((c) => c.from === 'VD' && c.to === 'CH')!;
    expect(vdToCh.count).toBe(1);
    expect(vdToCh.labels[0]).toContain('hardpoints');
    const chToVd = cells.find((c) => c.from === 'CH' && c.to === 'VD')!;
    expect(chToVd.feedback).toBe(1);                     // the loop-back is counted, and marked
  });

  it('criticalPath takes the flagged activities and the forward edges between them', () => {
    const { codes, edges } = criticalPath(g);
    expect([...codes].sort()).toEqual(['A', 'B']);
    expect(edges).toHaveLength(1);
    expect(edges[0].to_code).toBe('B');
  });

  it('a mutual hand-off is co-design: it blocks neither side', () => {
    // B and C each hand something to the other. Both edges are real, so neither
    // can be a prerequisite — otherwise both deadlock forever.
    const co = buildGraph(activities, [...deps, dep('C', 'B', 'revised loads')]);
    expect(coDesignPartners(co, 'B').map((p) => p.activity.code)).toEqual(['C']);
    expect(coDesignPartners(co, 'C').map((p) => p.activity.code)).toEqual(['B']);
    expect(coDesignPartners(co, 'B')[0].labels.sort()).toEqual(['frame loads', 'revised loads']);
    expect(blockers(co, 'C').map((b) => b.activity.code)).toEqual([]);   // not B
    expect(blockers(co, 'B').map((b) => b.activity.code)).toEqual(['A']); // still A
    const pairs = coDesignPairs(co);
    expect(pairs).toHaveLength(1);
    expect([pairs[0].a.code, pairs[0].b.code].sort()).toEqual(['B', 'C']);
  });

  it('forwardCycles skips feedback and co-design, but catches a longer deadlock', () => {
    expect(forwardCycles(g)).toEqual([]);                // the only cycle is feedback
    const co = buildGraph(activities, [...deps, dep('C', 'B', 'revised loads')]);
    expect(forwardCycles(co)).toEqual([]);               // a 2-cycle is co-design
    expect(forwardCycles(co, 10, 2).length).toBeGreaterThan(0);  // unless asked for
    // A → B → C → A with every edge forward: nobody can start. A real bug.
    const bad = buildGraph(activities, [...deps.filter((e) => !e.is_feedback), dep('C', 'A', 'impossible')]);
    const cycles = forwardCycles(bad);
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain('A');
    expect(cycles[0]).toContain('C');
  });

  it('progress rolls up by phase and by bucket', () => {
    const mixed = buildGraph([
      act('A', 'VD', 'P1', { status: 'done' }),
      act('B', 'VD', 'P1', { status: 'in_progress' }),
      act('C', 'CH', 'P2', { status: 'blocked' }),
    ], []);
    expect(progressByPhase(mixed).P1).toMatchObject({ total: 2, done: 1, inProgress: 1, pct: 50 });
    expect(progressByBucket(mixed).CH).toMatchObject({ total: 1, blocked: 1, notStarted: 0, pct: 0 });
  });

  it('search covers code, title and the prose a member would remember', () => {
    const gs = buildGraph([act('VD7', 'VD', 'P3', { title: 'Kinematics sweep', why: 'camber gain drives grip' })], []);
    expect(searchActivities(gs, 'vd7').map((a) => a.code)).toEqual(['VD7']);
    expect(searchActivities(gs, 'camber').map((a) => a.code)).toEqual(['VD7']);
    expect(searchActivities(gs, 'nothing here')).toEqual([]);
    expect(searchActivities(gs, '   ')).toEqual([]);
  });

  it('loopMembers returns a loop in phase order', () => {
    const gl = buildGraph([
      act('X', 'VD', 'P3', { loop_keys: ['L3'] }),
      act('Y', 'CH', 'P1', { loop_keys: ['L3'] }),
      act('Z', 'PT', 'P2', { loop_keys: ['L4'] }),
    ], []);
    const phases = [{ key: 'P1', idx: 1, name: 'one' }, { key: 'P2', idx: 2, name: 'two' }, { key: 'P3', idx: 3, name: 'three' }];
    expect(loopMembers(gl, phases, 'L3').map((a) => a.code)).toEqual(['Y', 'X']);
  });
});

describe('the shipped seed (public/data/taskmap-seed.json)', () => {
  const seed = seedJson as unknown as SeedFile;
  const rows = seedToRows(seed);
  const g = buildGraph(rows.activities, rows.dependencies);

  it('carries the whole programme', () => {
    expect(rows.buckets).toHaveLength(13);
    expect(rows.phases).toHaveLength(10);
    expect(rows.loops).toHaveLength(9);
    expect(rows.activities).toHaveLength(109);
    expect(rows.dependencies).toHaveLength(385);
  });

  it('every reference resolves (no dangling bucket, phase, loop or edge)', () => {
    const buckets = new Set(rows.buckets.map((b) => b.key));
    const phases = new Set(rows.phases.map((p) => p.key));
    const loops = new Set(rows.loops.map((l) => l.key));
    for (const a of rows.activities) {
      expect(buckets.has(a.bucket_key), `${a.code} bucket ${a.bucket_key}`).toBe(true);
      expect(phases.has(a.phase_key), `${a.code} phase ${a.phase_key}`).toBe(true);
      for (const k of a.loop_keys ?? []) expect(loops.has(k), `${a.code} loop ${k}`).toBe(true);
      for (const k of a.contributor_keys ?? []) expect(buckets.has(k), `${a.code} contributor ${k}`).toBe(true);
    }
    // buildGraph drops unresolvable edges, so a count match proves they all resolve.
    expect(g.dependencies.filter((e) => g.byCode.has(e.from_code) && g.byCode.has(e.to_code))).toHaveLength(385);
  });

  it('renames the map’s "done" to done_when, so it cannot collide with a status', () => {
    const tm1 = rows.activities.find((a) => a.code === 'TM1')!;
    expect(tm1.done_when).toBeTruthy();
    expect((tm1 as any).done).toBeUndefined();
    expect(tm1.status).toBeUndefined();      // the seed never dictates progress
  });

  it('has no unresolvable forward cycle, and its four mutual pairs are co-design', () => {
    expect(forwardCycles(g)).toEqual([]);          // nothing longer than a pair
    expect(rows.dependencies.filter((e) => e.is_feedback)).toHaveLength(66);
    // These four each hand something to the other; both directions are real, so
    // the map shows them as "settle together" rather than blocking either side.
    const pairs = coDesignPairs(g).map((p) => [p.a.code, p.b.code].sort().join('↔')).sort();
    expect(pairs).toEqual(['AC1↔TM3', 'AC5↔CH5', 'ECS1↔TEL1', 'FIN2↔LOG3']);
  });

  it('is fully reachable: nothing is orphaned from the programme', () => {
    const orphans = rows.activities.filter((a) => !g.ins.get(a.code)?.length && !g.outs.get(a.code)?.length);
    expect(orphans.map((a) => a.code)).toEqual([]);
  });

  it('starts somewhere and ranks a real bottleneck', () => {
    const ready = readyToStart(g);
    expect(ready.length).toBeGreaterThan(0);
    expect(ready[0].is_critical).toBe(true);          // critical work surfaces first
    const top = stallImpact(g)[0];
    expect(top.blocks).toBeGreaterThan(20);           // the first activities gate most of it
  });

  it('describes 13 subteams that really do hand work to each other', () => {
    const { cells } = handoffMatrix(g);
    expect(cells.length).toBeGreaterThan(20);
    expect(cells[0].count).toBeGreaterThan(1);
    const involved = new Set(cells.flatMap((c) => [c.from, c.to]));
    expect(involved.size).toBeGreaterThanOrEqual(10);
  });
});
