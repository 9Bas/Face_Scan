-- =============================================================================
-- Face Scan · Step 9 — Profile face enrollment (PDPA guard rails)
-- File: supabase/migrations/0009_profile_faces.sql
--
-- Adds:
--   1. profiles.avatar_path           — storage path of the member's avatar
--   2. profile_faces                  — 512-d ArcFace embedding per member
--                                       (biometric data: NEVER readable by anon
--                                        or authenticated clients)
--   3. has_profile_face()             — lets the app know if enrollment is done
--   4. profile_face_distance(...)     — compare a candidate face to the stored
--                                       profile face (service_role only)
--   5. search_faces_by_profile(...)   — search using the member's own profile
--                                       embedding (service_role only)
--
-- Run: paste into Supabase SQL editor. Idempotent — safe to re-run.
-- =============================================================================

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- 1) Avatar column (path only — no biometric data in a publicly readable table)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_path text;

-- ---------------------------------------------------------------------------
-- 2) Biometric face template table — deny-all for client roles.
--    Only the Python backend (service_role) reads/writes this table.
-- ---------------------------------------------------------------------------
create table if not exists public.profile_faces (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  embedding  vector(512) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_faces enable row level security;
-- FORCE makes even the table owner obey policies; service_role still bypasses
-- RLS by design, which is exactly what we want (backend only).
alter table public.profile_faces force row level security;

drop policy if exists "profile_faces_no_client_access" on public.profile_faces;

revoke all on table public.profile_faces from anon, authenticated;
grant all on table public.profile_faces to service_role;

drop trigger if exists profile_faces_touch on public.profile_faces;
create trigger profile_faces_touch before update on public.profile_faces
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2b) Guard client writes to profiles.
--     RLS policy `profiles_update_self` allows a member to update their own
--     row. Without this guard they could promote themselves to photographer
--     or point avatar_path at an arbitrary image, bypassing face enrollment.
--     Only service_role (backend / admin tooling) may change these columns.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profiles_client_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() in ('authenticated', 'anon') then
    if new.role is distinct from old.role then
      raise exception 'role can only be changed by an administrator';
    end if;
    if new.avatar_path is distinct from old.avatar_path then
      raise exception 'avatar_path is managed by the profile-face service';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_client_update on public.profiles;
create trigger profiles_guard_client_update
  before update on public.profiles
  for each row execute function public.guard_profiles_client_update();

-- ---------------------------------------------------------------------------
-- 3) has_profile_face() — enrollment flag for the signed-in member
-- ---------------------------------------------------------------------------
create or replace function public.has_profile_face()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profile_faces pf where pf.user_id = auth.uid()
  );
$$;

revoke all on function public.has_profile_face() from public;
grant execute on function public.has_profile_face() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) profile_face_distance(user_id, candidate) -> cosine distance
--    Lower = more similar. Returns null when the member has no profile face.
--    service_role only (never expose biometric comparisons to clients).
-- ---------------------------------------------------------------------------
create or replace function public.profile_face_distance(
  p_user_id uuid,
  q vector
)
returns double precision
language sql
security definer
set search_path = public
stable
as $$
  select (pf.embedding <=> q)::double precision
  from public.profile_faces pf
  where pf.user_id = p_user_id;
$$;

-- Default Postgres grants EXECUTE to PUBLIC — revoke that too, otherwise the
-- anon/authenticated revoke below would have no effect.
revoke all on function public.profile_face_distance(uuid, vector) from public;
revoke all on function public.profile_face_distance(uuid, vector) from anon, authenticated;
grant execute on function public.profile_face_distance(uuid, vector) to service_role;

-- ---------------------------------------------------------------------------
-- 5) search_faces_by_profile(user_id, ...) — search with the member's own
--    profile embedding. The client can never supply the query vector, so the
--    results can only ever be faces matching the enrolled profile.
-- ---------------------------------------------------------------------------
create or replace function public.search_faces_by_profile(
  p_user_id uuid,
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
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.profile_faces.embedding%type;
begin
  select pf.embedding into q
  from public.profile_faces pf
  where pf.user_id = p_user_id;

  if q is null then
    return;
  end if;

  return query
    select *
    from public.search_faces(q, match_count, max_distance, album_filter);
end;
$$;

revoke all on function public.search_faces_by_profile(uuid, integer, double precision, text)
  from public;
revoke all on function public.search_faces_by_profile(uuid, integer, double precision, text)
  from anon, authenticated;
grant execute on function public.search_faces_by_profile(uuid, integer, double precision, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 6) Ask PostgREST to refresh its schema cache immediately.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
