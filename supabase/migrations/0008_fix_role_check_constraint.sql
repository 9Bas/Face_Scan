-- Fix role check constraint to allow 'user'
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
    check (role in ('photographer','admin','user'));

alter table public.profiles
  alter column role set default 'user';
