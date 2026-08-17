-- =============================================================================
-- Face Scan · Fix: missing table GRANTs for anon / authenticated / service_role
--
-- Symptom: R2 upload succeeds but the frontend's insert into public.photos
-- returns 401/42501 "permission denied for table photos" (even with the
-- service_role key) — so the photos table stays empty and auto-index 404s.
--
-- Run: paste into Supabase SQL editor, or `supabase db push`.
-- Idempotent — safe to re-run.
-- =============================================================================

-- 1) Make sure every role can use the public schema.
grant usage on schema public to anon, authenticated, service_role;

-- 2) Table privileges (RLS still enforces row-level access below).
grant all on table public.profiles  to anon, authenticated, service_role;
grant all on table public.albums    to anon, authenticated, service_role;
grant all on table public.photos    to anon, authenticated, service_role;
grant all on table public.photo_faces to anon, authenticated, service_role;

-- The legacy table only exists if migration 0003 renamed it — guard it.
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'photo_embeddings_legacy_faceapi'
  ) then
    execute 'grant all on table public.photo_embeddings_legacy_faceapi to anon, authenticated, service_role';
  end if;
end $$;

-- 3) Re-assert RLS policies (idempotent) so writes are still owner-gated
--    once privileges exist.
drop policy if exists "photos_read_all" on public.photos;
create policy "photos_read_all"
  on public.photos for select
  using (true);

drop policy if exists "photos_write_owner" on public.photos;
create policy "photos_write_owner"
  on public.photos for all
  using (
    exists (
      select 1 from public.albums a
      where a.id = photos.album_id
        and a.photographer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.albums a
      where a.id = photos.album_id
        and a.photographer_id = auth.uid()
    )
  );

drop policy if exists "albums_read_all" on public.albums;
create policy "albums_read_all"
  on public.albums for select
  using (true);

drop policy if exists "albums_insert_self" on public.albums;
create policy "albums_insert_self"
  on public.albums for insert
  with check (auth.uid() = photographer_id);

drop policy if exists "albums_update_self" on public.albums;
create policy "albums_update_self"
  on public.albums for update
  using (auth.uid() = photographer_id);

drop policy if exists "albums_delete_self" on public.albums;
create policy "albums_delete_self"
  on public.albums for delete
  using (auth.uid() = photographer_id);

drop policy if exists "photo_faces_read_all" on public.photo_faces;
create policy "photo_faces_read_all"
  on public.photo_faces for select
  to anon, authenticated
  using (true);

drop policy if exists "photo_faces_write_owner" on public.photo_faces;
create policy "photo_faces_write_owner"
  on public.photo_faces for all
  to authenticated
  using (
    exists (
      select 1 from public.photos p
      join public.albums a on a.id = p.album_id
      where p.id = photo_faces.photo_id
        and a.photographer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.photos p
      join public.albums a on a.id = p.album_id
      where p.id = photo_faces.photo_id
        and a.photographer_id = auth.uid()
    )
  );

-- 4) Function execute grants (frontend + backend RPCs).
do $$
begin
  if exists (select 1 from pg_proc where proname = 'get_my_profile') then
    execute 'grant execute on function public.get_my_profile() to anon, authenticated, service_role';
  end if;
end $$;

grant execute on function public.search_faces(vector, integer, double precision, text)
  to anon, authenticated;
