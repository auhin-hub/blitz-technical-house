-- ============================================================================
-- MIST Blitz FS Workspace — 0003  Shared tool state + contributed outputs
--
-- Each subteam workbook is ONE shared file the team works in together, so the
-- web tools keep their editable inputs as SHARED server state too (BRIEF §A/§C:
-- "one member's input shows on another's screen"), not per-member scratch.
--
--   tool_state   — one row per tool; `data` jsonb holds that tool's editable
--                  (blue) inputs. Shared across members.
--   tool_outputs — the ToMaster results a tool contributes (spring rate, brake
--                  torque, …). Their governed destinations (Validation/Springs/
--                  Brakes hand-off tabs) are built later; stored here meanwhile.
--
-- HOW TO RUN: SQL Editor → paste → Run (after 0001/0002).
-- ============================================================================

create table if not exists public.tool_state (
  tool        text primary key,              -- e.g. 'vd_brakes'
  data        jsonb not null default '{}'::jsonb,
  updated_by  uuid references auth.users (id) on delete set null default auth.uid(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.tool_outputs (
  tool        text not null,
  key         text not null,
  label       text,
  value       numeric,
  unit        text,
  updated_by  uuid references auth.users (id) on delete set null default auth.uid(),
  updated_at  timestamptz not null default now(),
  primary key (tool, key)
);

-- Reuse the touch function from 0001 (public.touch_updated_at).
drop trigger if exists trg_tool_state_touch on public.tool_state;
create trigger trg_tool_state_touch
  before update on public.tool_state
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_tool_outputs_touch on public.tool_outputs;
create trigger trg_tool_outputs_touch
  before update on public.tool_outputs
  for each row execute function public.touch_updated_at();

-- RLS — authenticated members read + write both tables.
alter table public.tool_state   enable row level security;
alter table public.tool_outputs enable row level security;

drop policy if exists tool_state_select on public.tool_state;
create policy tool_state_select on public.tool_state
  for select to authenticated using (true);
drop policy if exists tool_state_write on public.tool_state;
create policy tool_state_write on public.tool_state
  for insert to authenticated with check (true);
drop policy if exists tool_state_update on public.tool_state;
create policy tool_state_update on public.tool_state
  for update to authenticated using (true) with check (true);

drop policy if exists tool_outputs_select on public.tool_outputs;
create policy tool_outputs_select on public.tool_outputs
  for select to authenticated using (true);
drop policy if exists tool_outputs_write on public.tool_outputs;
create policy tool_outputs_write on public.tool_outputs
  for insert to authenticated with check (true);
drop policy if exists tool_outputs_update on public.tool_outputs;
create policy tool_outputs_update on public.tool_outputs
  for update to authenticated using (true) with check (true);
