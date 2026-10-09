-- ============================================================================
-- MIST Blitz FS Workspace — 0004  Freeze-and-log enforcement (BRIEF §E5)
--
-- Makes the gate freeze real: once a parameter is frozen, its value cannot be
-- changed by an ordinary update — only through edit_param(), which REQUIRES a
-- reason and writes a change_log row (who / what / old→new / when). A guard
-- trigger blocks any other path, so this is enforced, not convention.
--
-- HOW TO RUN: SQL Editor → paste → Run (after 0001–0003).
-- ============================================================================

-- Capture a human actor on each log row / sign-off for display.
alter table public.change_log add column if not exists actor_email text;
alter table public.gates      add column if not exists signed_off_email text;

-- The sanctioned way to change a frozen parameter: requires a reason and logs.
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

  if old_row.frozen and (p_reason is null or length(btrim(p_reason)) = 0) then
    raise exception 'A change reason is required to edit the frozen parameter "%"', p_key;
  end if;

  if p_value is distinct from old_row.value then
    perform set_config('app.allow_frozen', 'true', true); -- let the guard pass, this txn only
    update public.vehicle_spec set value = p_value, updated_by = auth.uid() where key = p_key;
    insert into public.change_log (param_key, field, old_value, new_value, reason, changed_by, actor_email)
    values (p_key, 'value', old_row.value::text, p_value::text, p_reason, auth.uid(), auth.jwt() ->> 'email');
  end if;
end;
$$;

grant execute on function public.edit_param(text, numeric, text) to authenticated;

-- Guard: block a direct change to a frozen value unless it came via edit_param.
create or replace function public.guard_frozen()
returns trigger language plpgsql as $$
begin
  if OLD.frozen and NEW.value is distinct from OLD.value
     and coalesce(current_setting('app.allow_frozen', true), 'false') <> 'true' then
    raise exception 'Parameter "%" is frozen (gate %). Edit it via the change-logged path.',
      OLD.key, coalesce(OLD.frozen_gate, '?');
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_guard_frozen on public.vehicle_spec;
create trigger trg_guard_frozen
  before update on public.vehicle_spec
  for each row execute function public.guard_frozen();

-- Log freeze / unfreeze transitions (who froze what, at which gate).
create or replace function public.log_freeze_toggle()
returns trigger language plpgsql as $$
begin
  if NEW.frozen is distinct from OLD.frozen then
    insert into public.change_log (param_key, field, old_value, new_value, reason, changed_by, actor_email)
    values (NEW.key, 'frozen', OLD.frozen::text, NEW.frozen::text,
            case when NEW.frozen then 'Frozen at ' || coalesce(NEW.frozen_gate, '(gate)') else 'Unfrozen' end,
            auth.uid(), auth.jwt() ->> 'email');
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_log_freeze_toggle on public.vehicle_spec;
create trigger trg_log_freeze_toggle
  after update on public.vehicle_spec
  for each row execute function public.log_freeze_toggle();
