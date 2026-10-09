-- ============================================================================
-- MIST Blitz FS Workspace — 0007  Canonical blank Vehicle Spec (MASTER_BUILD_PLAN §0/§4)
--
-- The old 14 seeded numbers were last year's leftovers. Ship Vehicle Spec BLANK:
-- the full ~25-parameter set with names + units + source only, NO values — the
-- team fills in the new car in-app. Mass/ff/CoG/Izz are written by MassBudget;
-- weight, avg track and axle loads are computed in the Vehicle Spec UI.
--
-- ⚠️ ONE-TIME RESET: this clears every current value in vehicle_spec. Run once.
-- HOW TO RUN: SQL Editor → paste → Run (after 0001–0006).
-- ============================================================================

-- Clear last year's leftovers + the old param set (change_log FK is ON DELETE
-- SET NULL, so the audit history is preserved).
delete from public.vehicle_spec;

insert into public.vehicle_spec (key, label, symbol, unit, source, display_order) values
  ('mass_total',          'Total mass (with driver)',          'm',    'kg',    'MassBudget', 1),
  ('mass_frac_front',     'Front mass fraction',               'ff',   '-',     'MassBudget', 2),
  ('cog_height',          'CoG height',                        'h',    'mm',    'MassBudget', 3),
  ('yaw_inertia',         'Yaw inertia',                       'Izz',  'kg·m²', 'MassBudget', 4),
  ('unsprung_corner',     'Unsprung mass per corner',          '',     'kg',    'VD',         5),
  ('wheelbase',           'Wheelbase',                         'L',    'mm',    'input',      6),
  ('track_front',         'Front track',                       'tf',   'mm',    'input',      7),
  ('track_rear',          'Rear track',                        'tr',   'mm',    'input',      8),
  ('avg_track',           'Average track',                     't',    'mm',    '=(tf+tr)/2', 9),
  ('ride_height',         'Ride height',                       '',     'mm',    'input',      10),
  ('mu_lat_peak',         'Peak lateral μ',                    'μ',    '-',     'Tyre',       11),
  ('corner_stiffness',    'Cornering stiffness',               'Cα',   'N/deg', 'Tyre',       12),
  ('slip_peak',           'Peak slip angle',                   '',     'deg',   'Tyre',       13),
  ('rolling_radius',      'Loaded rolling radius',             'Re',   'mm',    'Tyre',       14),
  ('tyre_vert_stiffness', 'Tyre vertical stiffness',           'Kt',   'N/mm',  'Tyre',       15),
  ('accel_lat_target',    'Target lateral accel',              '',     'g',     'target',     16),
  ('accel_brake_target',  'Target braking decel',              '',     'g',     'target',     17),
  ('roll_grad_target',    'Roll gradient target',              '',     'deg/g', 'target',     18),
  ('ride_freq_front',     'Ride frequency front',              '',     'Hz',    'target',     19),
  ('ride_freq_rear',      'Ride frequency rear',               '',     'Hz',    'target',     20),
  ('tlltd_front',         'Front lateral LT distribution',     'TLLTD','-',     'VD',         21),
  ('motion_ratio',        'Motion ratio (wheel→spring)',       'MR',   '-',     'VD',         22),
  ('weight',              'Weight',                            'W',    'N',     '=m·g',       23),
  ('axle_load_front',     'Front axle static load',            '',     'N',     '=W·ff',      24),
  ('axle_load_rear',      'Rear axle static load',             '',     'N',     '=W·(1−ff)',  25)
on conflict (key) do update set
  label = excluded.label, symbol = excluded.symbol, unit = excluded.unit,
  source = excluded.source, display_order = excluded.display_order;
