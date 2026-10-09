-- ============================================================================
-- MIST Blitz FS Workspace — 0005  Tyre: private storage + results metadata
--
-- The tyre toolset download and member-uploaded fit plots live in a PRIVATE
-- bucket behind login (BRIEF §F/§G, Tahmid's rule: nothing downloadable is
-- world-reachable). Raw .mat / full .tir coefficient sets never enter the repo;
-- the .tir is referenced as a link, plots as private objects.
--
-- HOW TO RUN: SQL Editor → paste → Run (after 0001–0004). Then upload the
-- toolset: Dashboard → Storage → tyre bucket → upload the toolset archive
-- (e.g. TTC_Tyre_Tool.rar) — the Tyre page's download button references it.
-- ============================================================================

-- Show who uploaded each result.
alter table public.tyre_results add column if not exists author_email text;

-- Private bucket for the toolset archive + fit plot images.
insert into storage.buckets (id, name, public)
values ('tyre', 'tyre', false)
on conflict (id) do update set public = false;

-- Members may read tyre objects (lets createSignedUrl work for the toolset + plots).
drop policy if exists "tyre read (members)" on storage.objects;
create policy "tyre read (members)"
  on storage.objects for select to authenticated
  using (bucket_id = 'tyre');

-- Members may upload their own fit plots (admin uploads the toolset via dashboard).
drop policy if exists "tyre upload (members)" on storage.objects;
create policy "tyre upload (members)"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tyre');
