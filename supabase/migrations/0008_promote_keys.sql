-- ============================================================================
-- MIST Blitz FS Workspace — 0008  Promote-to-Master keys (Handoff v2 Part 0.1)
--
-- Adds the procurement/rules "selected" Master keys the Component Readiness board
-- (P4) tracks. Some hold short TEXT state, so vehicle_spec gains a `text_value`
-- column and a freeze-aware, change-logged text edit path (edit_param_text),
-- mirroring edit_param() for numbers. The guard trigger now blocks a frozen
-- text_value change too, so text keys freeze exactly like numeric ones.
--
-- HOW TO RUN: SQL Editor → paste → Run (after 0001–0007).
-- ============================================================================

alter table public.vehicle_spec add column if not exists text_value text;

-- Sanctioned text edit (requires a reason when frozen; logs old→new).
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

grant execute on function public.edit_param_text(text, text, text) to authenticated;

-- Extend the freeze guard to cover text_value as well as value.
create or replace function public.guard_frozen()
returns trigger language plpgsql as $$
begin
  if OLD.frozen
     and (NEW.value is distinct from OLD.value or NEW.text_value is distinct from OLD.text_value)
     and coalesce(current_setting('app.allow_frozen', true), 'false') <> 'true' then
    raise exception 'Parameter "%" is frozen (gate %). Edit it via the change-logged path.',
      OLD.key, coalesce(OLD.frozen_gate, '?');
  end if;
  return NEW;
end;
$$;

-- Numeric promote keys.
insert into public.vehicle_spec (key, label, symbol, unit, value, source, display_order) values
  ('restrictor_dia', 'Intake restrictor Ø (rules)', '', 'mm', null, 'input', 60),
  ('rear_rc_height', 'Rear roll-centre height', '', 'mm', null, 'Geometry', 61)
on conflict (key) do update set
  label = excluded.label, unit = excluded.unit, source = excluded.source, display_order = excluded.display_order;

-- Text "selected" promote keys (store choice in text_value).
insert into public.vehicle_spec (key, label, symbol, unit, value, source, display_order) values
  ('engine_selected', 'Engine chosen (model)', '', '', null, 'input', 62),
  ('wheel_selected', 'Wheel / rim chosen (size, PCD)', '', '', null, 'input', 63),
  ('damper_selected', 'Damper chosen (eye-to-eye, travel)', '', '', null, 'input', 64),
  ('diff_selected', 'Differential chosen', '', '', null, 'input', 65)
on conflict (key) do update set
  label = excluded.label, source = excluded.source, display_order = excluded.display_order;
