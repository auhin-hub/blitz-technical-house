-- ============================================================================
-- MIST Blitz FS Workspace — 0012  Spec snapshots (feature review Tier 2 #4)
--
-- The free tier has no automatic backups, and BRIEF §J says the Excel Master
-- stays the authoritative archive with periodic exported snapshots. This gives
-- that a home in the database as well as a download: one row per snapshot,
-- holding the full Master (values, frozen flags, gates) plus the contributed
-- tool outputs, as taken at that moment.
--
-- It also answers "what did the car look like at G3?" — a snapshot taken at each
-- gate sign-off is a design baseline you can compare against later.
--
-- Snapshots are immutable: insert and delete only, no update. Any member may
-- take one (that is a backup, which should never need permission); only a lead
-- may delete one.
--
-- HOW TO RUN: SQL Editor → paste → Run (after 0001–0011).
-- ============================================================================

create table if not exists public.spec_snapshots (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  note        text,
  gate        text,                               -- 'G3' when taken at a gate
  payload     jsonb not null,                     -- { spec: [...], outputs: [...] }
  taken_at    timestamptz not null default now(),
  taken_by    uuid references auth.users (id) on delete set null default auth.uid(),
  actor_email text
);

create index if not exists spec_snapshots_taken_at_idx
  on public.spec_snapshots (taken_at desc);

alter table public.spec_snapshots enable row level security;

drop policy if exists spec_snapshots_select on public.spec_snapshots;
create policy spec_snapshots_select on public.spec_snapshots
  for select to authenticated using (true);

-- Taking a backup never needs permission.
drop policy if exists spec_snapshots_insert on public.spec_snapshots;
create policy spec_snapshots_insert on public.spec_snapshots
  for insert to authenticated with check (true);

-- Deleting a baseline does.
drop policy if exists spec_snapshots_delete on public.spec_snapshots;
create policy spec_snapshots_delete on public.spec_snapshots
  for delete to authenticated using (public.is_lead());

-- Stamp the actor's e-mail for display (the client need not send it).
create or replace function public.snapshot_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.actor_email is null then NEW.actor_email := auth.jwt() ->> 'email'; end if;
  return NEW;
end;
$$;

drop trigger if exists trg_snapshot_stamp on public.spec_snapshots;
create trigger trg_snapshot_stamp
  before insert on public.spec_snapshots
  for each row execute function public.snapshot_stamp();
