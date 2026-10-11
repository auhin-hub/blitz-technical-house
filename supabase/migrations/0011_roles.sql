-- ============================================================================
-- MIST Blitz FS Workspace — 0011  Member roles (feature review Tier 1 #3)
--
-- Governance was advisory: any signed-in member could freeze a parameter, break
-- a freeze, or sign off a gate. Those are the three acts that are supposed to
-- carry authority, so they become lead-only — enforced in the database, not in
-- the UI (the UI only hides what the database would refuse anyway).
--
--   members            one row per workspace member: role + team.
--   public.is_lead()   the single source of truth, used by policies/triggers.
--
-- Everything else is unchanged: any member still edits ordinary values, saves
-- tool state, contributes outputs.
--
-- BOOTSTRAP: while NO LEAD exists, is_lead() returns true for any signed-in
-- member — otherwise running this migration before seeding anyone would lock the
-- whole team out of its own gates. The bootstrap ends the moment the first lead
-- row exists, and members self-registering as plain members cannot end it.
--
-- HOW TO RUN: SQL Editor → paste → Run (after 0001–0010), then edit and run the
-- seed INSERT at the bottom with your leads' e-mail addresses.
-- ============================================================================

create table if not exists public.members (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  team        text,                             -- 'VD', 'Chassis', … (free text)
  role        text not null default 'member'
                check (role in ('lead', 'member', 'viewer')),
  created_at  timestamptz not null default now()
);

-- Keep the e-mail in step with auth.users for display, when known.
create or replace function public.members_fill_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.email is null then
    select u.email into NEW.email from auth.users u where u.id = NEW.user_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_members_fill_email on public.members;
create trigger trg_members_fill_email
  before insert or update on public.members
  for each row execute function public.members_fill_email();

-- ---------------------------------------------------------------------------
-- is_lead() — SECURITY DEFINER so it can read `members` without recursing into
-- that table's own RLS policies.
-- ---------------------------------------------------------------------------
create or replace function public.is_lead()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    case
      when auth.uid() is null then false
      -- Bootstrap: no lead has been appointed yet, so don't lock the team out.
      when not exists (select 1 from public.members m where m.role = 'lead') then true
      else exists (select 1 from public.members m where m.user_id = auth.uid() and m.role = 'lead')
    end;
$$;

grant execute on function public.is_lead() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS on members: everyone sees the roster (you must know who your leads are);
-- only a lead can change it.
-- ---------------------------------------------------------------------------
alter table public.members enable row level security;

drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select to authenticated using (true);

-- A lead can add anyone; anyone else may only add THEMSELVES as a plain member,
-- which is how the roster fills up without a lead typing in e-mail addresses.
drop policy if exists members_insert on public.members;
create policy members_insert on public.members
  for insert to authenticated
  with check (public.is_lead() or (user_id = auth.uid() and role = 'member'));

drop policy if exists members_update on public.members;
create policy members_update on public.members
  for update to authenticated using (public.is_lead()) with check (public.is_lead());

drop policy if exists members_delete on public.members;
create policy members_delete on public.members
  for delete to authenticated using (public.is_lead());

-- ---------------------------------------------------------------------------
-- Gate sign-off is lead-only.
-- ---------------------------------------------------------------------------
drop policy if exists gates_update on public.gates;
create policy gates_update on public.gates
  for update to authenticated using (public.is_lead()) with check (public.is_lead());

-- ---------------------------------------------------------------------------
-- Freezing / unfreezing a parameter is lead-only. Ordinary value edits are not
-- touched, so this rides on the existing update policy as a trigger.
-- ---------------------------------------------------------------------------
create or replace function public.guard_freeze_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (NEW.frozen is distinct from OLD.frozen or NEW.frozen_gate is distinct from OLD.frozen_gate)
     and not public.is_lead() then
    raise exception 'Only a team lead can freeze or unfreeze "%" (gate control).', OLD.key;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_guard_freeze_role on public.vehicle_spec;
create trigger trg_guard_freeze_role
  before update on public.vehicle_spec
  for each row execute function public.guard_freeze_role();

-- ---------------------------------------------------------------------------
-- Breaking a freeze (editing a frozen value) is lead-only too — the reason and
-- the change_log row stay required exactly as before.
-- ---------------------------------------------------------------------------
create or replace function public.edit_param(p_key text, p_value numeric, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare old_row public.vehicle_spec;
begin
  select * into old_row from public.vehicle_spec where key = p_key for update;
  if not found then raise exception 'unknown parameter %', p_key; end if;

  if old_row.frozen and not public.is_lead() then
    raise exception 'Only a team lead can change the frozen parameter "%". Ask your lead.', p_key;
  end if;

  if old_row.frozen and (p_reason is null or length(btrim(p_reason)) = 0) then
    raise exception 'A change reason is required to edit the frozen parameter "%"', p_key;
  end if;

  if p_value is distinct from old_row.value then
    perform set_config('app.allow_frozen', 'true', true);
    update public.vehicle_spec set value = p_value, updated_by = auth.uid() where key = p_key;
    insert into public.change_log (param_key, field, old_value, new_value, reason, changed_by, actor_email)
    values (p_key, 'value', old_row.value::text, p_value::text, p_reason, auth.uid(), auth.jwt() ->> 'email');
  end if;
end;
$$;

create or replace function public.edit_param_text(p_key text, p_text text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare old_row public.vehicle_spec;
begin
  select * into old_row from public.vehicle_spec where key = p_key for update;
  if not found then raise exception 'unknown parameter %', p_key; end if;

  if old_row.frozen and not public.is_lead() then
    raise exception 'Only a team lead can change the frozen parameter "%". Ask your lead.', p_key;
  end if;

  if old_row.frozen and (p_reason is null or length(btrim(p_reason)) = 0) then
    raise exception 'A change reason is required to edit the frozen parameter "%"', p_key;
  end if;

  if p_text is distinct from old_row.text_value then
    perform set_config('app.allow_frozen', 'true', true);
    update public.vehicle_spec set text_value = p_text, updated_by = auth.uid() where key = p_key;
    insert into public.change_log (param_key, field, old_value, new_value, reason, changed_by, actor_email)
    values (p_key, 'text_value', old_row.text_value, p_text, p_reason, auth.uid(), auth.jwt() ->> 'email');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- SEED YOUR LEADS — edit the e-mail list, then run. Each person must have signed
-- in at least once (so they exist in auth.users). Until one row exists here,
-- every signed-in member counts as a lead.
-- ---------------------------------------------------------------------------
-- Option A (recommended): sign in, open Gates → Members and set yourself to
-- "lead" while the bootstrap is still active. Option B, in SQL:
-- insert into public.members (user_id, email, full_name, team, role)
-- select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', ''), 'VD', 'lead'
--   from auth.users u
--  where u.email in ('lead1@example.com', 'lead2@example.com')
--    on conflict (user_id) do update set role = 'lead', team = excluded.team;
