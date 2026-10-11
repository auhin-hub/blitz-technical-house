/**
 * Task Map graph logic — pure, so it is testable and the page only renders.
 *
 * The programme map is a directed graph: 109 activities in 13 buckets across 10
 * phases, joined by 385 hand-offs. The static version could draw it. With status
 * on each node, the same graph answers the questions a tech captain actually
 * asks:
 *
 *   - what can we start **now** (every upstream hand-off delivered)?
 *   - what is **blocking** this activity, by name?
 *   - which activity, if it slips, **stalls the most** of the programme?
 *   - where are we, per phase and per subteam?
 *
 * Two kinds of edge. A normal edge is a hand-off that must happen before the
 * target can proceed. A `is_feedback` edge is a deliberate loop-back (test data
 * informing next year's concept, FEA sending a part back to detail design) — the
 * map exists to show those, so they must NEVER count as a prerequisite or as a
 * cycle, or the whole graph deadlocks. Every traversal here takes that into
 * account, and `forwardCycles()` reports a cycle among *forward* edges only,
 * because that one is a genuine planning bug.
 */

export type ActivityStatus = 'not_started' | 'in_progress' | 'blocked' | 'done';

export interface Bucket { key: string; name: string; scope?: string | null; color?: string | null; kind?: string | null; display_order?: number }
export interface Phase { key: string; idx: number; name: string; subtitle?: string | null; is_gate?: boolean; gate_key?: string | null; display_order?: number }
export interface Loop { key: string; name: string; color?: string | null; description?: string | null; display_order?: number }

export interface Activity {
  code: string;
  bucket_key: string;
  phase_key: string;
  title: string;
  owner_role?: string | null;
  accountable?: string | null;
  contributor_keys?: string[];
  loop_keys?: string[];
  is_critical?: boolean;
  why?: string | null;
  done_when?: string | null;
  tools?: string | null;
  rules?: string | null;
  tasks?: string[];
  pitfalls?: string[];
  external_inputs?: string[];
  display_order?: number;
  status?: ActivityStatus;
  percent?: number | null;
  owner_user_id?: string | null;
  notes?: string | null;
  tool_href?: string | null;
}

export interface Dependency {
  id?: string;
  from_code: string;
  to_code: string;
  label?: string | null;
  is_feedback?: boolean;
}

export interface Graph {
  byCode: Map<string, Activity>;
  /** Edges INTO a code (its prerequisites, feedback included — filter as needed). */
  ins: Map<string, Dependency[]>;
  /** Edges OUT of a code (what it feeds). */
  outs: Map<string, Dependency[]>;
  activities: Activity[];
  dependencies: Dependency[];
}

export const isDone = (a: Activity | undefined): boolean => a?.status === 'done';
const forward = (e: Dependency) => !e.is_feedback;

/** Index the graph once; every helper below takes the result. */
export function buildGraph(activities: Activity[], dependencies: Dependency[]): Graph {
  const byCode = new Map<string, Activity>();
  for (const a of activities) byCode.set(a.code, a);
  const ins = new Map<string, Dependency[]>();
  const outs = new Map<string, Dependency[]>();
  for (const e of dependencies) {
    // Skip an edge pointing at something that is not in the graph: a half-deleted
    // activity must not make the whole map throw.
    if (!byCode.has(e.from_code) || !byCode.has(e.to_code)) continue;
    (ins.get(e.to_code) ?? ins.set(e.to_code, []).get(e.to_code)!).push(e);
    (outs.get(e.from_code) ?? outs.set(e.from_code, []).get(e.from_code)!).push(e);
  }
  return { byCode, ins, outs, activities, dependencies };
}

export interface ChainOptions {
  /** Follow feedback edges too. Default false — they are not prerequisites. */
  includeFeedback?: boolean;
  /** Stop after this many hops. Default Infinity (the whole chain). */
  maxDepth?: number;
}

/**
 * Everything upstream ('up') or downstream ('down') of a code, transitively.
 * Breadth-first with a visited set, so a feedback cycle cannot hang it.
 * The starting code is not included.
 */
export function chain(g: Graph, code: string, dir: 'up' | 'down', opts: ChainOptions = {}): Set<string> {
  const { includeFeedback = false, maxDepth = Infinity } = opts;
  const seen = new Set<string>();
  if (!g.byCode.has(code)) return seen;
  let frontier = [code];
  let depth = 0;
  while (frontier.length && depth < maxDepth) {
    const next: string[] = [];
    for (const cur of frontier) {
      const edges = (dir === 'up' ? g.ins.get(cur) : g.outs.get(cur)) ?? [];
      for (const e of edges) {
        if (!includeFeedback && e.is_feedback) continue;
        const other = dir === 'up' ? e.from_code : e.to_code;
        if (other === code || seen.has(other)) continue;
        seen.add(other);
        next.push(other);
      }
    }
    frontier = next;
    depth++;
  }
  return seen;
}

/**
 * A **co-design pair**: two activities that each hand something forward to the
 * other. In the seeded programme there are four — aero targets ↔ mass budget,
 * nose cone ↔ impact-attenuator envelope, logger inputs ↔ channel list, purchase
 * requests ↔ approvals. Both hand-offs are real, so neither edge is wrong; they
 * simply cannot be sequenced. Treating them as prerequisites would deadlock both
 * activities forever, so they are reported as "settle these together" instead.
 */
export function coDesignPartners(g: Graph, code: string): { activity: Activity; labels: string[] }[] {
  const outsTo = new Map<string, string[]>();
  for (const e of (g.outs.get(code) ?? []).filter(forward)) {
    (outsTo.get(e.to_code) ?? outsTo.set(e.to_code, []).get(e.to_code)!).push((e.label ?? '').trim());
  }
  const found: { activity: Activity; labels: string[] }[] = [];
  for (const e of (g.ins.get(code) ?? []).filter(forward)) {
    const back = outsTo.get(e.from_code);
    if (!back) continue;
    const partner = g.byCode.get(e.from_code);
    if (!partner || found.some((f) => f.activity.code === partner.code)) continue;
    found.push({ activity: partner, labels: [...new Set([...back, (e.label ?? '').trim()].filter(Boolean))] });
  }
  return found;
}

/** Every co-design pair in the programme, each listed once. */
export function coDesignPairs(g: Graph): { a: Activity; b: Activity; labels: string[] }[] {
  const out: { a: Activity; b: Activity; labels: string[] }[] = [];
  const seen = new Set<string>();
  for (const a of g.activities) {
    for (const p of coDesignPartners(g, a.code)) {
      const key = [a.code, p.activity.code].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ a, b: p.activity, labels: p.labels });
    }
  }
  return out;
}

/**
 * The activities that must be finished before `code` can proceed and are not
 * done yet — its direct blockers, each with the hand-off that is missing.
 * Direct only on purpose: "VD3 is waiting on CH2" is actionable; a transitive
 * list of twenty is not.
 *
 * Excludes feedback edges (not prerequisites) and co-design partners (not
 * sequenceable — see `coDesignPartners`).
 */
export function blockers(g: Graph, code: string): { activity: Activity; label: string }[] {
  const mutual = new Set(coDesignPartners(g, code).map((p) => p.activity.code));
  return ((g.ins.get(code) ?? []).filter(forward))
    .map((e) => ({ activity: g.byCode.get(e.from_code)!, label: (e.label ?? '').trim() }))
    .filter((b) => b.activity && !mutual.has(b.activity.code) && !isDone(b.activity));
}

/**
 * Activities that are not done and have no unfinished forward prerequisite —
 * the "you could start this today" list. An activity with no prerequisites at
 * all qualifies, which is how the programme begins.
 */
export function readyToStart(g: Graph): Activity[] {
  return g.activities
    .filter((a) => !isDone(a) && blockers(g, a.code).length === 0)
    .sort((a, b) => Number(!!b.is_critical) - Number(!!a.is_critical)
      || (a.display_order ?? 0) - (b.display_order ?? 0)
      || a.code.localeCompare(b.code));
}

/**
 * How much of the programme each unfinished activity is holding up: the size of
 * its downstream chain, counting only activities that are not done. Ranked, so
 * the top of the list is where attention is worth most.
 */
export function stallImpact(g: Graph): { activity: Activity; blocks: number; isCritical: boolean }[] {
  return g.activities
    .filter((a) => !isDone(a))
    .map((a) => {
      const down = chain(g, a.code, 'down');
      let blocks = 0;
      for (const c of down) if (!isDone(g.byCode.get(c))) blocks++;
      return { activity: a, blocks, isCritical: !!a.is_critical };
    })
    .sort((x, y) => y.blocks - x.blocks
      || Number(y.isCritical) - Number(x.isCritical)
      || x.activity.code.localeCompare(y.activity.code));
}

export interface Progress { total: number; done: number; inProgress: number; blocked: number; notStarted: number; pct: number }

const tally = (rows: Activity[]): Progress => {
  const done = rows.filter((a) => a.status === 'done').length;
  const inProgress = rows.filter((a) => a.status === 'in_progress').length;
  const blocked = rows.filter((a) => a.status === 'blocked').length;
  return {
    total: rows.length, done, inProgress, blocked,
    notStarted: rows.length - done - inProgress - blocked,
    pct: rows.length ? (done / rows.length) * 100 : 0,
  };
};

export const progressOf = (rows: Activity[]): Progress => tally(rows);

/** Progress per phase key, and per bucket key. */
export function progressByPhase(g: Graph): Record<string, Progress> {
  const out: Record<string, Activity[]> = {};
  for (const a of g.activities) (out[a.phase_key] ||= []).push(a);
  return Object.fromEntries(Object.entries(out).map(([k, rows]) => [k, tally(rows)]));
}

export function progressByBucket(g: Graph): Record<string, Progress> {
  const out: Record<string, Activity[]> = {};
  for (const a of g.activities) (out[a.bucket_key] ||= []).push(a);
  return Object.fromEntries(Object.entries(out).map(([k, rows]) => [k, tally(rows)]));
}

/**
 * Bucket-to-bucket hand-off counts — "who gives what to whom", the matrix the
 * programme map is really about. Self-hand-offs (inside one subteam) are kept
 * separately: they are work sequencing, not an interface to negotiate.
 */
export interface Handoff { from: string; to: string; count: number; feedback: number; labels: string[] }

export function handoffMatrix(g: Graph): { cells: Handoff[]; internal: Record<string, number> } {
  const cells = new Map<string, Handoff>();
  const internal: Record<string, number> = {};
  for (const e of g.dependencies) {
    const a = g.byCode.get(e.from_code), b = g.byCode.get(e.to_code);
    if (!a || !b) continue;
    if (a.bucket_key === b.bucket_key) { internal[a.bucket_key] = (internal[a.bucket_key] ?? 0) + 1; continue; }
    const key = `${a.bucket_key}>${b.bucket_key}`;
    const cell = cells.get(key) ?? { from: a.bucket_key, to: b.bucket_key, count: 0, feedback: 0, labels: [] };
    cell.count++;
    if (e.is_feedback) cell.feedback++;
    const label = (e.label ?? '').trim();
    if (label && cell.labels.length < 12) cell.labels.push(`${e.from_code}→${e.to_code}: ${label}`);
    cells.set(key, cell);
  }
  return { cells: [...cells.values()].sort((x, y) => y.count - x.count), internal };
}

/** The activities in a loop, in phase order. */
export function loopMembers(g: Graph, phases: Phase[], loopKey: string): Activity[] {
  const idx = new Map(phases.map((p) => [p.key, p.idx]));
  return g.activities
    .filter((a) => (a.loop_keys ?? []).includes(loopKey))
    .sort((a, b) => (idx.get(a.phase_key) ?? 0) - (idx.get(b.phase_key) ?? 0) || a.code.localeCompare(b.code));
}

/** Critical activities plus the forward edges that run between two of them. */
export function criticalPath(g: Graph): { codes: Set<string>; edges: Dependency[] } {
  const codes = new Set(g.activities.filter((a) => a.is_critical).map((a) => a.code));
  const edges = g.dependencies.filter((e) => !e.is_feedback && codes.has(e.from_code) && codes.has(e.to_code));
  return { codes, edges };
}

/**
 * Cycles among FORWARD edges, **longer than a co-design pair**. A feedback edge
 * closing a loop is the point of the map, and a two-activity mutual hand-off is
 * co-design (see `coDesignPairs`) — both are legitimate. A longer forward cycle
 * is not: it means a chain of activities each waiting on the next, which no
 * amount of co-design can resolve, so it is a planning bug worth surfacing.
 * Pass `minLength: 2` to include co-design pairs as well.
 *
 * Returns one representative cycle per entry, as a code path that ends where it
 * began (so a 2-cycle reads `['A','B','A']`, length 3).
 */
export function forwardCycles(g: Graph, limit = 10, minLength = 3): string[][] {
  const found: string[][] = [];
  const state = new Map<string, 0 | 1 | 2>();   // 0 unseen, 1 on stack, 2 done
  const stack: string[] = [];

  const visit = (code: string): void => {
    if (found.length >= limit) return;
    state.set(code, 1);
    stack.push(code);
    for (const e of (g.outs.get(code) ?? [])) {
      if (e.is_feedback) continue;
      const next = e.to_code;
      const st = state.get(next) ?? 0;
      if (st === 1) {
        const at = stack.indexOf(next);
        // stack.slice(at) is the cycle's distinct nodes; +1 for the closing node.
        if (at >= 0 && stack.length - at + 1 > minLength) found.push([...stack.slice(at), next]);
        if (found.length >= limit) break;
      } else if (st === 0) {
        visit(next);
      }
    }
    stack.pop();
    state.set(code, 2);
  };

  for (const a of g.activities) if ((state.get(a.code) ?? 0) === 0) visit(a.code);
  return found;
}

/** Search across the fields a member would actually search by. */
export function searchActivities(g: Graph, query: string): Activity[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hay = (a: Activity) => [
    a.code, a.title, a.owner_role ?? '', a.why ?? '', a.done_when ?? '',
    a.tools ?? '', a.notes ?? '', ...(a.tasks ?? []), ...(a.pitfalls ?? []),
  ].join(' ').toLowerCase();
  return g.activities
    .map((a) => ({ a, hit: hay(a).indexOf(q) }))
    .filter((r) => r.hit >= 0)
    .sort((x, y) => Number(x.a.code.toLowerCase().startsWith(q)) * -1 - Number(y.a.code.toLowerCase().startsWith(q)) * -1 || x.hit - y.hit)
    .map((r) => r.a);
}

/** Seed-file shape (public/data/taskmap-seed.json) → the table shapes. */
export interface SeedFile {
  meta?: Record<string, unknown>;
  buckets: { key: string; name: string; scope?: string; color?: string; kind?: string; order?: number }[];
  phases: { key: string; idx: number; name: string; subtitle?: string; is_gate?: boolean; order?: number }[];
  loops: { key: string; name: string; color?: string; description?: string; member_codes?: string[] }[];
  activities: {
    code: string; bucket_key: string; phase_key: string; title: string;
    owner_role?: string; accountable?: string;
    contributor_keys?: string[]; loop_keys?: string[]; is_critical?: boolean;
    why?: string; tools?: string; rules?: string;
    tasks?: string[]; pitfalls?: string[]; external_inputs?: string[];
    /** The map calls it `done`; the row calls it `done_when` (status owns "done"). */
    done?: string; done_when?: string;
    order?: number; phase_idx?: number;
  }[];
  dependencies: Dependency[];
}

export interface SeedRows {
  buckets: Bucket[];
  phases: Phase[];
  loops: Loop[];
  activities: Activity[];
  dependencies: Dependency[];
}

/**
 * Normalise the seed file into row shapes. Renames the map's `done` to
 * `done_when` (`done` collides with the status vocabulary) and drops any edge
 * whose endpoints are not in the seed, so a hand-edited file cannot produce a
 * foreign-key failure halfway through a load.
 */
export function seedToRows(seed: SeedFile): SeedRows {
  const buckets: Bucket[] = seed.buckets.map((b, i) => ({
    key: b.key, name: b.name, scope: b.scope ?? null, color: b.color ?? null,
    kind: b.kind ?? null, display_order: b.order ?? i,
  }));
  const phases: Phase[] = seed.phases.map((p, i) => ({
    key: p.key, idx: p.idx, name: p.name, subtitle: p.subtitle ?? null,
    is_gate: !!p.is_gate, gate_key: null, display_order: p.order ?? i,
  }));
  const loops: Loop[] = seed.loops.map((l, i) => ({
    key: l.key, name: l.name, color: l.color ?? null,
    description: l.description ?? null, display_order: i,
  }));
  const activities: Activity[] = seed.activities.map((a, i) => ({
    code: a.code, bucket_key: a.bucket_key, phase_key: a.phase_key, title: a.title,
    owner_role: a.owner_role ?? null, accountable: a.accountable ?? null,
    contributor_keys: a.contributor_keys ?? [], loop_keys: a.loop_keys ?? [],
    is_critical: !!a.is_critical, why: a.why ?? null,
    done_when: a.done ?? a.done_when ?? null,
    tools: a.tools ?? null, rules: a.rules ?? null,
    tasks: a.tasks ?? [], pitfalls: a.pitfalls ?? [], external_inputs: a.external_inputs ?? [],
    display_order: a.order ?? i,
  }));
  const codes = new Set(activities.map((a) => a.code));
  const dependencies: Dependency[] = seed.dependencies
    .filter((e) => codes.has(e.from_code) && codes.has(e.to_code) && e.from_code !== e.to_code)
    .map((e) => ({ from_code: e.from_code, to_code: e.to_code, label: (e.label ?? '').trim(), is_feedback: !!e.is_feedback }));
  return { buckets, phases, loops, activities, dependencies };
}
