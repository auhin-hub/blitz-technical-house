-- ============================================================================
-- MIST Blitz FS Workspace — 0002  Private storage for member-only downloads
--
-- The workbooks (and later the tyre toolset) are NOT served from the public
-- Pages site. They live in a PRIVATE Supabase storage bucket and are handed out
-- only as short-lived signed URLs to signed-in members (BRIEF §F/§G; Tahmid's
-- instruction: everything downloadable sits behind login).
--
-- HOW TO RUN: SQL Editor → paste → Run (after 0001). Then upload the files:
--   Dashboard → Storage → workbooks bucket → upload the 8 .xlsx with their
--   EXACT filenames (the download buttons reference them by name).
-- ============================================================================

-- Private bucket (public = false ⇒ no world-reachable object URLs).
insert into storage.buckets (id, name, public)
values ('workbooks', 'workbooks', false)
on conflict (id) do update set public = false;

-- Members may read workbook objects (this is what lets createSignedUrl succeed
-- for a signed-in user). Uploads/edits happen from the dashboard (service role,
-- which bypasses RLS) — no member write policy on purpose.
drop policy if exists "workbooks read (members)" on storage.objects;
create policy "workbooks read (members)"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'workbooks');
