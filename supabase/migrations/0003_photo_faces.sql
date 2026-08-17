-- =============================================================================
-- Face Scan · Step 3 v2 — ArcFace multi-face schema
-- File: supabase/migrations/0003_photo_faces.sql
--
-- Replaces the old single-embedding `photo_embeddings` (128-d face-api)
-- with `photo_faces` (512-d ArcFace, ONE row per detected face).
--
-- IMPORTANT:
--   * The old `photo_embeddings` table is RENAMED to
--     `photo_embeddings_legacy_faceapi` so no data is destroyed and the
--     old `search_faces` RPC is dropped in favour of a new one below.
--   * Old 128-d embeddings CANNOT be mixed with new 512-d ArcFace vectors.
--     Re-index all photos via scripts/reindex_faces.py.
-- =============================================================================

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- 1) Retire the old RPC + table (keep data as legacy backup).
-- ---------------------------------------------------------------------------
drop function if exists public.search_faces(text, int, float) cascade;

alter table if exists public.photo_embeddings
  rename to photo_embeddings_legacy_faceapi;

drop index if exists photo_embeddings_embedding_idx;
drop index if exists photo_embeddings_legacy_faceapi_embedding_idx;

-- ---------------------------------------------------------------------------
-- 2) New table: one row per detected face in a photo.
-- ---------------------------------------------------------------------------
create table if not exists public.photo_faces (
  id            uuid primary key default gen_random_uuid(),
  photo_id      uuid not null references public.photos(id) on delete cascade,
  face_index    int  not null default 0,
  embedding     vector(512) not null,
  bbox_x        double precision not null default 0,
  bbox_y        double precision not null default 0,
  bbox_width    double precision not null default 0,
  bbox_height   double precision not null default 0,
  det_score     double precision not null default 0,
  quality_score double precision not null default 0,
  detector      text    not null default 'arcface_r100_buffalo_l',
  created_at    timestamptz not null default now(),
  unique (photo_id, face_index)
);

alter table public.photo_faces enable row level security;
alter table public.photo_faces force row level security;

-- Public read: anyone may query face rows (needed for vector search via RPC).
drop policy if exists "photo_faces_read_all" on public.photo_faces;
create policy "photo_faces_read_all"
  on public.photo_faces for select
  to anon, authenticated
  using (true);

-- Writes are performed by the Python backend using the service_role key
-- (which bypasses RLS). We still add an owner-write policy so a logged-in
-- photographer could insert if needed.
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

-- ---------------------------------------------------------------------------
-- 3) Vector index (cosine). For very small datasets ivfflat needs few lists;
--    for large ones (>= 1k rows) use ~ lists = sqrt(rows). Tune later.
-- ---------------------------------------------------------------------------
drop index if exists photo_faces_embedding_idx;
create index photo_faces_embedding_idx
  on public.photo_faces
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Useful for cleanup / lookups.
drop index if exists photo_faces_photo_id_idx;
create index photo_faces_photo_id_idx on public.photo_faces (photo_id);

-- ---------------------------------------------------------------------------
-- 4) RPC: search_faces(q vector(512), match_count, max_distance)
--    Returns the BEST matching face per photo, ordered by distance asc.
--    distance = cosine distance (lower = more similar).
-- ---------------------------------------------------------------------------
create or replace function public.search_faces(
  q vector,
  match_count int default 30,
  max_distance double precision default 0.6,
  album_filter text default ''
)
returns table (
  photo_id uuid,
  album_id uuid,
  filename text,
  storage_path text,
  thumbnail_path text,
  face_id uuid,
  face_index int,
  bbox_x double precision,
  bbox_y double precision,
  bbox_width double precision,
  bbox_height double precision,
  det_score double precision,
  quality_score double precision,
  distance float
)
language sql
security definer set search_path = public
as $$
  with ranked as (
    select
      pf.photo_id,
      p.album_id,
      p.filename,
      p.storage_path,
      p.thumbnail_path,
      pf.id         as face_id,
      pf.face_index,
      pf.bbox_x,
      pf.bbox_y,
      pf.bbox_width,
      pf.bbox_height,
      pf.det_score,
      pf.quality_score,
      (pf.embedding <=> q)::float as distance,
      row_number() over (
        partition by pf.photo_id
        order by (pf.embedding <=> q) asc
      ) as rn
    from public.photo_faces pf
    join public.photos p on p.id = pf.photo_id
    where (pf.embedding <=> q) <= max_distance
      and (album_filter = '' or p.album_id = album_filter::uuid)  )
  select
    photo_id,
    album_id,
    filename,
    storage_path,
    thumbnail_path,
    face_id,
    face_index,
    bbox_x,
    bbox_y,
    bbox_width,
    bbox_height,
    det_score,
    quality_score,
    distance
  from ranked
  where rn = 1
  order by distance asc
  limit match_count;
$$;

grant execute on function public.search_faces(vector, integer, double precision, text) to anon, authenticated;