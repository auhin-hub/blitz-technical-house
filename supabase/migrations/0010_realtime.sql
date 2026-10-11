-- ============================================================================
-- MIST Blitz FS Workspace — 0010  Realtime publication (feature review Tier 1 #1)
--
-- "Enter mass once, see it everywhere" used to mean "on the next page load". To
-- push a Master change to a tool someone already has open, the tables must be in
-- the `supabase_realtime` publication. Realtime still honours RLS, so a member
-- only receives rows they could already SELECT.
--
-- REPLICA IDENTITY FULL makes the `old` record available on UPDATE/DELETE, which
-- the client uses to say which key changed (and to detect a conflicting edit).
--
-- Safe to re-run. If you skip this migration the site behaves exactly as before:
-- the client subscribes, never receives an event, and nothing breaks.
--
-- HOW TO RUN: SQL Editor → paste → Run (after 0001–0009).
-- ============================================================================

alter table public.vehicle_spec replica identity full;
alter table public.tool_outputs replica identity full;
alter table public.tool_state   replica identity full;
alter table public.gates        replica identity full;

do $$
declare t text;
begin
  foreach t in array array['vehicle_spec', 'tool_outputs', 'tool_state', 'gates', 'change_log']
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
