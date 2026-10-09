-- ============================================================================
-- MIST Blitz FS Workspace — 0006  Resources: system folders + docs/links
--
-- Folders are named by system (Aero, Powertrain, …). Each holds entries that are
-- EITHER an uploaded document (private storage, behind login) OR just a link to a
-- book / external resource — links store no file, to save free-tier space (§E6).
--
-- HOW TO RUN: SQL Editor → paste → Run (after 0001–0005).
-- ============================================================================

create table if not exists public.resource_folders (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  created_by     uuid references auth.users (id) on delete set null default auth.uid(),
  created_email  text,
  created_at     timestamptz not null default now()
);
create unique index if not exists resource_folders_name_key on public.resource_folders (name);

create table if not exists public.resources (
  id             uuid primary key default gen_random_uuid(),
  folder_id      uuid references public.resource_folders (id) on delete cascade,
  title          text not null,
  kind           text not null check (kind in ('file', 'link')),
  path           text,            -- storage object path (kind = 'file')
  url            text,            -- external link (kind = 'link')
  notes          text,
  uploaded_by    uuid references auth.users (id) on delete set null default auth.uid(),
  uploaded_email text,
  created_at     timestamptz not null default now()
);

create index if not exists resources_folder_idx on public.resources (folder_id);

-- RLS — internal team tool: members read, add and tidy.
alter table public.resource_folders enable row level security;
alter table public.resources        enable row level security;

drop policy if exists folders_select on public.resource_folders;
create policy folders_select on public.resource_folders for select to authenticated using (true);
drop policy if exists folders_insert on public.resource_folders;
create policy folders_insert on public.resource_folders for insert to authenticated with check (true);
drop policy if exists folders_delete on public.resource_folders;
create policy folders_delete on public.resource_folders for delete to authenticated using (true);

drop policy if exists resources_select on public.resources;
create policy resources_select on public.resources for select to authenticated using (true);
drop policy if exists resources_insert on public.resources;
create policy resources_insert on public.resources for insert to authenticated with check (true);
drop policy if exists resources_delete on public.resources;
create policy resources_delete on public.resources for delete to authenticated using (true);

-- Private bucket for uploaded documents (≤50 MB/file enforced client-side).
insert into storage.buckets (id, name, public)
values ('resources', 'resources', false)
on conflict (id) do update set public = false;

drop policy if exists "resources read (members)" on storage.objects;
create policy "resources read (members)" on storage.objects
  for select to authenticated using (bucket_id = 'resources');
drop policy if exists "resources upload (members)" on storage.objects;
create policy "resources upload (members)" on storage.objects
  for insert to authenticated with check (bucket_id = 'resources');

-- Starter folders, one per system (editable/removable; add more from the UI).
insert into public.resource_folders (name) values
  ('Vehicle Dynamics'), ('Powertrain'), ('Electronics'),
  ('Chassis'), ('Aerodynamics'), ('Ergonomics'), ('General / Rules')
on conflict do nothing;
