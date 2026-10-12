-- ============================================================================
-- MIST Blitz FS Workspace — 0014  Lock down the Master-write RPCs (revision P0-1)
--
-- `edit_param` / `edit_param_text` are SECURITY DEFINER, so they bypass RLS by
-- design (that is how a frozen value gets its one sanctioned, change-logged
-- edit path). But PostgreSQL grants EXECUTE on a new function to PUBLIC by
-- default, and migrations 0004/0008/0011 only ADDED a grant to `authenticated`
-- without removing the implicit PUBLIC one. Result: an anonymous caller holding
-- the public anon key (which ships in the site's JS) could invoke them and
-- overwrite any NON-frozen Master value without signing in. Frozen values stayed
-- safe behind the lead check; non-frozen ones did not.
--
-- This migration closes that two ways (defence in depth):
--   1. REVOKE EXECUTE from PUBLIC and anon — only `authenticated` keeps it.
--   2. A sign-in guard at the top of each function, so even a leaked grant can
--      do nothing without a real user (auth.uid() is null for the anon role).
--
-- Nothing else changes: the lead check, the required reason, and the change_log
-- row are reproduced verbatim from 0011.
--
-- Note: these functions are the APP's path. A project admin editing the Master
-- from the SQL editor runs as a role with no auth.uid(), so call them with a
-- real session (the website) — or edit `vehicle_spec` directly in SQL, which
-- bypasses the function entirely.
--
-- HOW TO RUN: SQL Editor → paste → Run (after 0001–0013). Re-runnable.
--
-- RE-VERIFY (anonymous, with the public anon key):
--   POST /rest/v1/rpc/edit_param  {"p_key":"mass_total","p_value":1,"p_reason":"x"}
--   → expect HTTP 401/403 "permission denied for function edit_param"
--     (before this migration it returned 400 "unknown parameter …", i.e. it ran).
-- ============================================================================

-- 1. edit_param — sign-in guard added; body otherwise identical to 0011.
create or replace function public.edit_param(p_key text, p_value numeric, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare old_row public.vehicle_spec;
begin
  if auth.uid() is null then
    raise exception 'Sign in required to change the Master.';
  end if;

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

-- 2. edit_param_text — same guard; body otherwise identical to 0011.
create or replace function public.edit_param_text(p_key text, p_text text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare old_row public.vehicle_spec;
begin
  if auth.uid() is null then
    raise exception 'Sign in required to change the Master.';
  end if;

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

-- 3. Remove the implicit PUBLIC/anon EXECUTE; keep only authenticated.
--    `create or replace` above does not reset grants, so revoke explicitly.
revoke execute on function public.edit_param(text, numeric, text)   from public, anon;
revoke execute on function public.edit_param_text(text, text, text) from public, anon;

grant  execute on function public.edit_param(text, numeric, text)   to authenticated;
grant  execute on function public.edit_param_text(text, text, text) to authenticated;
