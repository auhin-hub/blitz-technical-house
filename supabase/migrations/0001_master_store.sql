-- ============================================================================
-- MIST Blitz FS Workspace — 0001  Vehicle Spec (Master) store + governance
--
-- Mirrors TOOL_SPECS §0 (the shared schema) plus the foundation tables the
-- later steps slot into: change_log, gates, tyre_results.
--
-- HOW TO RUN (one time): Supabase dashboard → SQL Editor → paste this whole
-- file → Run. Re-running is safe (idempotent-ish: IF NOT EXISTS + upsert seed).
--
-- SECURITY: every table has row-level security ON. Only authenticated members
-- (a real Supabase login) can read or write; the public anon key alone returns
-- nothing. The anon key being public (BRIEF §J) is therefore fine.
--
-- NOT YET ENFORCED HERE (comes in the Gates/freeze step, BRIEF §E5): the rule
-- that editing a *frozen* parameter must write a change_log row. The columns and
-- tables are shaped for it; the trigger is added later.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- vehicle_spec — one row per canonical parameter (the backbone, BRIEF §E1)
-- ---------------------------------------------------------------------------
create table if not exists public.vehicle_spec (
  key            text primary key,
  label          text not null,
  symbol         text default '',
  unit           text default '',
  value          numeric,
  source         text,                         -- MassBudget | input | Tyre | target | VD | =formula
  confidence     text not null default 'Est'
                   check (confidence in ('Live', 'Est')),
  frozen         boolean not null default false,
  frozen_gate    text,                          -- e.g. 'G3' (null until frozen)
  display_order  int,
  updated_by     uuid references auth.users (id) on delete set null,
  updated_at     timestamptz not null default now()
);

comment on table public.vehicle_spec is
  'Shared Master parameter store — the single source of truth (TOOL_SPECS §0).';

-- ---------------------------------------------------------------------------
-- change_log — append-only audit of edits to governed numbers (BRIEF §E5)
-- ---------------------------------------------------------------------------
create table if not exists public.change_log (
  id          bigint generated always as identity primary key,
  param_key   text references public.vehicle_spec (key) on delete set null,
  field       text not null default 'value',   -- value | frozen | confidence …
  old_value   text,
  new_value   text,
  reason      text,
  changed_by  uuid references auth.users (id) on delete set null default auth.uid(),
  changed_at  timestamptz not null default now()
);

comment on table public.change_log is
  'Who / what / old→new / when for every edit to a governed parameter.';

-- ---------------------------------------------------------------------------
-- gates — G0..G9 phase status + sign-off (BRIEF §E5)
-- ---------------------------------------------------------------------------
create table if not exists public.gates (
  id             text primary key,             -- 'G0' … 'G9'
  name           text not null,
  status         text not null default 'open'
                   check (status in ('open', 'in_review', 'signed_off')),
  signed_off_by  uuid references auth.users (id) on delete set null,
  signed_off_at  timestamptz,
  notes          text,
  display_order  int
);

-- ---------------------------------------------------------------------------
-- tyre_results — shared, anonymised fit records (BRIEF §E4, §G)
-- ---------------------------------------------------------------------------
create table if not exists public.tyre_results (
  id          uuid primary key default gen_random_uuid(),
  tyre_label  text not null,                   -- anonymised: 'Tyre A' / size class
  run         text,
  scope       text,
  r_squared   numeric,
  rms         numeric,
  lmux        numeric,
  lmuy        numeric,
  tir_link    text,                            -- link only; never raw coeffs in-repo
  plot_path   text,                            -- private storage object path
  notes       text,
  author      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at touch trigger for vehicle_spec
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_vehicle_spec_touch on public.vehicle_spec;
create trigger trg_vehicle_spec_touch
  before update on public.vehicle_spec
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Row-level security — authenticated members only
-- ============================================================================
alter table public.vehicle_spec enable row level security;
alter table public.change_log   enable row level security;
alter table public.gates        enable row level security;
alter table public.tyre_results enable row level security;

-- vehicle_spec: members read + write (freeze-log enforcement added later).
drop policy if exists vehicle_spec_select on public.vehicle_spec;
create policy vehicle_spec_select on public.vehicle_spec
  for select to authenticated using (true);
drop policy if exists vehicle_spec_write on public.vehicle_spec;
create policy vehicle_spec_write on public.vehicle_spec
  for update to authenticated using (true) with check (true);
drop policy if exists vehicle_spec_insert on public.vehicle_spec;
create policy vehicle_spec_insert on public.vehicle_spec
  for insert to authenticated with check (true);

-- change_log: append-only — members read + insert, never update/delete.
drop policy if exists change_log_select on public.change_log;
create policy change_log_select on public.change_log
  for select to authenticated using (true);
drop policy if exists change_log_insert on public.change_log;
create policy change_log_insert on public.change_log
  for insert to authenticated with check (changed_by = auth.uid());

-- gates: members read + update status/sign-off.
drop policy if exists gates_select on public.gates;
create policy gates_select on public.gates
  for select to authenticated using (true);
drop policy if exists gates_write on public.gates;
create policy gates_write on public.gates
  for update to authenticated using (true) with check (true);

-- tyre_results: members read all; insert own; edit/delete only their own.
drop policy if exists tyre_results_select on public.tyre_results;
create policy tyre_results_select on public.tyre_results
  for select to authenticated using (true);
drop policy if exists tyre_results_insert on public.tyre_results;
create policy tyre_results_insert on public.tyre_results
  for insert to authenticated with check (author = auth.uid());
drop policy if exists tyre_results_modify on public.tyre_results;
create policy tyre_results_modify on public.tyre_results
  for update to authenticated using (author = auth.uid()) with check (author = auth.uid());
drop policy if exists tyre_results_delete on public.tyre_results;
create policy tyre_results_delete on public.tyre_results
  for delete to authenticated using (author = auth.uid());

-- ============================================================================
-- Seed — current workbook values (TOOL_SPECS §0). Upsert so re-runs refresh
-- labels/units/sources without clobbering a live value a member has edited.
-- ============================================================================
insert into public.vehicle_spec (key, label, symbol, unit, value, source, display_order) values
  ('mass_total',       'Total mass (with driver)',  'm',  'kg',    264,    'MassBudget',       1),
  ('mass_frac_front',  'Front mass fraction',       '',   '-',     0.4569, 'MassBudget',       2),
  ('cog_height',       'CoG height',                'h',  'mm',    263.4,  'MassBudget',       3),
  ('wheelbase',        'Wheelbase',                 'L',  'mm',    1550,   'input',            4),
  ('track_front',      'Front track',               '',   'mm',    1200,   'input',            5),
  ('track_rear',       'Rear track',                '',   'mm',    1180,   'input',            6),
  ('ride_height',      'Ride height',               '',   'mm',    40,     'input',            7),
  ('mu_lat_peak',      'Peak lateral μ',            '',   '-',     1.5,    'Tyre',             8),
  ('corner_stiffness', 'Cornering stiffness',       'Cα', 'N/deg', 1100,   'Tyre',             9),
  ('rolling_radius',   'Loaded rolling radius',     '',   'mm',    228,    'Tyre',             10),
  ('accel_lat_target', 'Target lateral accel',      '',   'g',     1.5,    'target',           11),
  ('motion_ratio',     'Motion ratio (wheel→spring)','MR','-',     0.7,    'VD',               12),
  ('axle_load_front',  'Front axle static load',    '',   'N',     1183.2, '=m·g·ff',          13),
  ('axle_load_rear',   'Rear axle static load',     '',   'N',     1406.6, '=m·g·(1−ff)',      14)
on conflict (key) do update set
  label = excluded.label,
  symbol = excluded.symbol,
  unit = excluded.unit,
  source = excluded.source,
  display_order = excluded.display_order;

-- Seed the gate set (G0..G9). Names are placeholders — rename to the team's
-- actual gate titles from the workbook's Gates sheet when that tab is built.
insert into public.gates (id, name, display_order) values
  ('G0', 'Concept',            0),
  ('G1', 'Targets set',        1),
  ('G2', 'Architecture',       2),
  ('G3', 'Hardpoints frozen',  3),
  ('G4', 'Detailed design',    4),
  ('G5', 'Design freeze',      5),
  ('G6', 'Manufacturing',      6),
  ('G7', 'Assembly',           7),
  ('G8', 'Testing',            8),
  ('G9', 'Competition',        9)
on conflict (id) do nothing;
