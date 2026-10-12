-- ============================================================================
-- MIST Blitz FS Workspace — 0015  Server-side derived Master keys (revision P1-3/P1-4)
--
-- The four computed Master rows — avg_track, weight, axle_load_front,
-- axle_load_rear — were recomputed only by the Vehicle Spec page, and only when
-- someone edited there. So after MassBudget contributed a new mass or front
-- fraction, the axle loads stayed stale, and the traction limit (reads
-- axle_load_rear) and steering effort (reads axle_load_front) ran on old numbers
-- until someone happened to open Vehicle Spec and poke it.
--
-- Move the derivation to where the data lives: a trigger recomputes the four
-- rows whenever mass_total, mass_frac_front, track_front or track_rear changes,
-- no matter which page made the change. The client then stops writing them,
-- which also removes the two-member Realtime write-loop (P1-4).
--
--   avg_track        = (track_front + track_rear) / 2
--   weight           = mass_total · 9.81
--   axle_load_front  = weight · mass_frac_front
--   axle_load_rear   = weight · (1 − mass_frac_front)
--
-- Nulls propagate (a missing input leaves the derived value null → the UI shows
-- "—"). No recursion: the derived keys are not in the trigger's WHEN set.
--
-- HOW TO RUN: SQL Editor → paste → Run (after 0001–0014). Re-runnable.
-- ============================================================================

create or replace function public.recompute_derived()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare m numeric; ff numeric; tf numeric; tr numeric;
begin
  select value into m  from public.vehicle_spec where key = 'mass_total';
  select value into ff from public.vehicle_spec where key = 'mass_frac_front';
  select value into tf from public.vehicle_spec where key = 'track_front';
  select value into tr from public.vehicle_spec where key = 'track_rear';

  -- The derived rows are black/computed and never frozen, but let the guard pass
  -- unconditionally in case one ever is.
  perform set_config('app.allow_frozen', 'true', true);

  update public.vehicle_spec set value = (tf + tr) / 2       where key = 'avg_track';
  update public.vehicle_spec set value = m * 9.81            where key = 'weight';
  update public.vehicle_spec set value = m * 9.81 * ff       where key = 'axle_load_front';
  update public.vehicle_spec set value = m * 9.81 * (1 - ff) where key = 'axle_load_rear';
  return null;
end;
$$;

drop trigger if exists trg_recompute_derived on public.vehicle_spec;
create trigger trg_recompute_derived
  after insert or update of value on public.vehicle_spec
  for each row
  when (NEW.key in ('mass_total', 'mass_frac_front', 'track_front', 'track_rear'))
  execute function public.recompute_derived();

-- Seed the derived values once, now, so they are correct without waiting for the
-- next edit.
do $$
declare m numeric; ff numeric; tf numeric; tr numeric;
begin
  select value into m  from public.vehicle_spec where key = 'mass_total';
  select value into ff from public.vehicle_spec where key = 'mass_frac_front';
  select value into tf from public.vehicle_spec where key = 'track_front';
  select value into tr from public.vehicle_spec where key = 'track_rear';
  perform set_config('app.allow_frozen', 'true', true);
  update public.vehicle_spec set value = (tf + tr) / 2       where key = 'avg_track';
  update public.vehicle_spec set value = m * 9.81            where key = 'weight';
  update public.vehicle_spec set value = m * 9.81 * ff       where key = 'axle_load_front';
  update public.vehicle_spec set value = m * 9.81 * (1 - ff) where key = 'axle_load_rear';
end;
$$;
