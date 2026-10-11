-- ============================================================================
-- MIST Blitz FS Workspace — 0009  Peak longitudinal μ (audit P1.4)
--
-- The traction limit (drive force vs rear axle load) and the brake load-transfer
-- cases are LONGITUDINAL limits, but both read `mu_lat_peak` — the cornering
-- figure. The workbook used one μ for everything, which is the isotropic
-- friction-circle assumption; a real tyre's μx and μy differ.
--
-- This adds `mu_long_peak`. While it is null, both tools fall back to
-- `mu_lat_peak`, so every existing reference number reproduces exactly; fill it
-- from the Tyre tool's longitudinal fit to get the honest number.
--
-- HOW TO RUN: SQL Editor → paste → Run (after 0001–0008).
-- ============================================================================

insert into public.vehicle_spec (key, label, symbol, unit, value, source, display_order) values
  ('mu_long_peak', 'Peak longitudinal μ', 'μx', '-', null, 'Tyre', 66)
on conflict (key) do update set
  label = excluded.label, symbol = excluded.symbol, unit = excluded.unit,
  source = excluded.source, display_order = excluded.display_order;
