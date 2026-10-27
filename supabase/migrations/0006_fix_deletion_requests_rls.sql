-- Fix RLS for photo_deletion_requests to allow authenticated users to insert
drop policy if exists "deletion_requests_insert" on public.photo_deletion_requests;
create policy "deletion_requests_insert"
  on public.photo_deletion_requests for insert
  to authenticated
  with check (auth.uid() = requester_id);

drop policy if exists "deletion_requests_read" on public.photo_deletion_requests;
create policy "deletion_requests_read"
  on public.photo_deletion_requests for select
  to authenticated
  using (
    auth.uid() = requester_id OR
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('photographer','admin')
    )
  );

drop policy if exists "deletion_requests_update" on public.photo_deletion_requests;
create policy "deletion_requests_update"
  on public.photo_deletion_requests for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('photographer','admin')
    )
  );

grant all on table public.photo_deletion_requests to authenticated;
grant usage, select on all sequences in schema public to authenticated;
