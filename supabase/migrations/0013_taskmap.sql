-- ============================================================================
-- MIST Blitz FS Workspace — 0013  Task Map (the car programme work map)
--
-- The programme map was a standalone HTML page: 13 buckets (subteams) × 10
-- phases, 109 activities and 385 hand-offs between them. Read-only, and dead the
-- moment the plan moved.
--
-- Here it becomes shared state, which buys three things the static page cannot:
--   1. STATUS — each activity carries not_started / in_progress / blocked / done,
--      an owner and notes, so the map says where the programme actually is.
--   2. "WHAT CAN WE START" — with status on the graph, the dependency edges can
--      answer which activities are unblocked right now, and what is blocking the
--      rest. That is the question a tech captain asks every week.
--   3. It is editable by the team, versioned by the change-aware tables around
--      it, and live (Realtime), like every other shared view in the workspace.
--
-- Structure (buckets / phases / loops) is governance, so deleting one is
-- lead-only. Content (activities, dependencies) is the team's working plan, so
-- any member may add, edit or remove.
--
-- The seed itself is NOT in this file: it ships as public/data/taskmap-seed.json
-- and the /taskmap page loads it, so re-seeding or resetting needs no SQL.
--
-- HOW TO RUN: SQL Editor → paste → Run (after 0001–0012).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Buckets — the subteams/lanes (TM, VD, CH, ERG, PT, AC, BR, ECS, TEL, DOC, …)
-- ---------------------------------------------------------------------------
create table if not exists public.taskmap_buckets (
  key            text primary key,
  name           text not null,
  scope          text,
  color          text,
  kind           text,                         -- 'technical' | 'business' | …
  display_order  int not null default 0
);

-- ---------------------------------------------------------------------------
-- Phases — P0..P9, the columns of the map. `gate_key` optionally ties a phase
-- to a real gate (G0..G9) so the map can show its sign-off state.
-- ---------------------------------------------------------------------------
create table if not exists public.taskmap_phases (
  key            text primary key,
  idx            int not null,
  name           text not null,
  subtitle       text,
  is_gate        boolean not null default false,
  gate_key       text references public.gates (id) on delete set null,
  display_order  int not null default 0
);

-- ---------------------------------------------------------------------------
-- Iteration loops — the named cycles (season, concept, hardpoint, mass & CG, …)
-- ---------------------------------------------------------------------------
create table if not exists public.taskmap_loops (
  key            text primary key,
  name           text not null,
  color          text,
  description    text,
  display_order  int not null default 0
);

-- ---------------------------------------------------------------------------
-- Activities — one row per programme activity. The descriptive columns come
-- from the map; the state columns are what the workspace adds.
-- ---------------------------------------------------------------------------
create table if not exists public.taskmap_activities (
  code             text primary key,                    -- 'TM1', 'VD7', …
  bucket_key       text not null references public.taskmap_buckets (key) on update cascade on delete cascade,
  phase_key        text not null references public.taskmap_phases (key) on update cascade on delete cascade,
  title            text not null,
  owner_role       text,
  accountable      text,
  contributor_keys text[] not null default '{}',        -- bucket keys
  loop_keys        text[] not null default '{}',        -- loop keys
  is_critical      boolean not null default false,
  why              text,
  done_when        text,                                -- the map's "done" text
  tools            text,
  rules            text,
  tasks            text[] not null default '{}',
  pitfalls         text[] not null default '{}',
  external_inputs  text[] not null default '{}',
  display_order    int not null default 0,

  -- Live state.
  status           text not null default 'not_started'
                     check (status in ('not_started', 'in_progress', 'blocked', 'done')),
  percent          int check (percent is null or (percent >= 0 and percent <= 100)),
  owner_user_id    uuid references auth.users (id) on delete set null,
  notes            text,
  /** Optional deep link to the workspace tool this activity is done in. */
  tool_href        text,

  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null default auth.uid()
);

create index if not exists taskmap_activities_phase_idx  on public.taskmap_activities (phase_key);
create index if not exists taskmap_activities_bucket_idx on public.taskmap_activities (bucket_key);
create index if not exists taskmap_activities_status_idx on public.taskmap_activities (status);

drop trigger if exists trg_taskmap_activities_touch on public.taskmap_activities;
create trigger trg_taskmap_activities_touch
  before update on public.taskmap_activities
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Dependencies — "from_code hands `label` to to_code". `is_feedback` marks a
-- deliberate loop-back (the map's whole point is that these exist), so a cycle
-- through a feedback edge is by design, while a cycle through forward edges is
-- a planning bug the page flags.
--
-- The label is part of the identity: two activities legitimately hand over more
-- than one thing, and each handover is its own edge.
-- ---------------------------------------------------------------------------
create table if not exists public.taskmap_dependencies (
  id          uuid primary key default gen_random_uuid(),
  from_code   text not null references public.taskmap_activities (code) on update cascade on delete cascade,
  to_code     text not null references public.taskmap_activities (code) on update cascade on delete cascade,
  label       text not null default '',
  is_feedback boolean not null default false,
  constraint taskmap_dependencies_no_self check (from_code <> to_code),
  constraint taskmap_dependencies_unique unique (from_code, to_code, label)
);

create index if not exists taskmap_dependencies_from_idx on public.taskmap_dependencies (from_code);
create index if not exists taskmap_dependencies_to_idx   on public.taskmap_dependencies (to_code);

-- ---------------------------------------------------------------------------
-- RLS. Every member reads everything and edits the plan; only a lead may delete
-- a bucket, phase or loop, because that restructures the programme rather than
-- working inside it.
-- ---------------------------------------------------------------------------
alter table public.taskmap_buckets      enable row level security;
alter table public.taskmap_phases       enable row level security;
alter table public.taskmap_loops        enable row level security;
alter table public.taskmap_activities   enable row level security;
alter table public.taskmap_dependencies enable row level security;

do $$
declare t text;
begin
  foreach t in array array['taskmap_buckets', 'taskmap_phases', 'taskmap_loops',
                           'taskmap_activities', 'taskmap_dependencies']
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (true)', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (true) with check (true)', t, t);
  end loop;

  -- Content: any member may delete.
  foreach t in array array['taskmap_activities', 'taskmap_dependencies']
  loop
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (true)', t, t);
  end loop;

  -- Structure: lead-only delete.
  foreach t in array array['taskmap_buckets', 'taskmap_phases', 'taskmap_loops']
  loop
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (public.is_lead())', t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime: a status change should appear on everyone's map without a reload.
-- ---------------------------------------------------------------------------
alter table public.taskmap_activities   replica identity full;
alter table public.taskmap_dependencies replica identity full;

do $$
declare t text;
begin
  foreach t in array array['taskmap_activities', 'taskmap_dependencies',
                           'taskmap_buckets', 'taskmap_phases', 'taskmap_loops']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
