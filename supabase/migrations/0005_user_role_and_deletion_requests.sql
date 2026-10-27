-- =============================================================================
-- Face Scan · Add 'user' role and photo deletion requests
-- =============================================================================

-- 1) Allow 'user' role in profiles
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
    check (role in ('photographer','admin','user'));

-- Ensure default remains reasonable (photographers created by admin flow still fine)
alter table public.profiles
  alter column role set default 'user';

-- 2) Create photo_deletion_requests table
create table if not exists public.photo_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_email text,
  reason text,
  status text not null default 'pending'
         check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.photo_deletion_requests enable row level security;

-- Public/authenticated can read? Only photographers/admin need to see; requests visible to owner? 
-- Allow photographers/admin to see all, requesters can see their own
drop policy if exists "deletion_requests_read" on public.photo_deletion_requests;
create policy "deletion_requests_read"
  on public.photo_deletion_requests for select
  using (
    auth.uid() = requester_id OR
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('photographer','admin')
    )
  );

drop policy if exists "deletion_requests_insert" on public.photo_deletion_requests;
create policy "deletion_requests_insert"
  on public.photo_deletion_requests for insert
  with check (auth.uid() = requester_id);

drop policy if exists "deletion_requests_update" on public.photo_deletion_requests;
create policy "deletion_requests_update"
  on public.photo_deletion_requests for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('photographer','admin')
    )
  );

-- updated_at trigger
drop trigger if exists photo_deletion_requests_touch on public.photo_deletion_requests;
create trigger photo_deletion_requests_touch before update on public.photo_deletion_requests
  for each row execute function public.touch_updated_at();

-- Grants
grant all on table public.photo_deletion_requests to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on function public.touch_updated_at() to anon, authenticated, service_role;
