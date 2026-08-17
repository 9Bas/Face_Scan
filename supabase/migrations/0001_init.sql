-- =============================================================================
-- Face Scan · Step 2 — initial schema + RLS
-- File: supabase/migrations/0001_init.sql
-- Run: paste into Supabase SQL editor, or `supabase db push`.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  role         text not null default 'photographer'
               check (role in ('photographer','admin')),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Public: anyone may read a profile (display name on albums, etc.)
drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all"
  on public.profiles for select
  using (true);

-- A user can read/update their own profile.
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user signs up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- albums
-- ---------------------------------------------------------------------------
create table if not exists public.albums (
  id              uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.profiles(id) on delete cascade,
  name            text not null,
  description     text,
  event_date      date,
  location        text,
  category        text check (category in ('sports','academic','activities','culture')),
  cover_photo_id  uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.albums enable row level security;

-- Public: anyone can read albums (public gallery).
drop policy if exists "albums_read_all" on public.albums;
create policy "albums_read_all"
  on public.albums for select
  using (true);

-- Photographers manage their own albums only.
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

-- Add FK for cover photo once photos exist (added below, after photos).
-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------
create table if not exists public.photos (
  id             uuid primary key default gen_random_uuid(),
  album_id       uuid not null references public.albums(id) on delete cascade,
  filename        text not null,
  storage_path    text not null,
  thumbnail_path  text,
  file_size       bigint,
  mime_type       text,
  width           int,
  height          int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.photos enable row level security;

-- Public: anyone can read photos (public gallery).
drop policy if exists "photos_read_all" on public.photos;
create policy "photos_read_all"
  on public.photos for select
  using (true);

-- Insert / update / delete only if the photo's album belongs to the caller.
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

-- Cover photo FK (self-reference within album).
alter table public.albums
  drop constraint if exists albums_cover_photo_id_fkey;
alter table public.albums
  add constraint albums_cover_photo_id_fkey
  foreign key (cover_photo_id) references public.photos(id)
  on delete set null;

-- Keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists albums_touch on public.albums;
create trigger albums_touch before update on public.albums
  for each row execute function public.touch_updated_at();

drop trigger if exists photos_touch on public.photos;
create trigger photos_touch before update on public.photos
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Helpful views for the public gallery + dashboard.
-- ---------------------------------------------------------------------------
create or replace view public.albums_with_counts as
select
  a.*,
  coalesce(p.cnt, 0) as photo_count
from public.albums a
left join (
  select album_id, count(*)::int as cnt
  from public.photos
  group by album_id
) p on p.album_id = a.id;