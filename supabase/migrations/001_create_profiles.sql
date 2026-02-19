-- ─── Profiles table ──────────────────────────────────────────────────────────
-- Stores extended user information (role, name, avatar, business).
-- Automatically created when a user signs up via a trigger.

create table if not exists public.profiles (
  id             uuid references auth.users on delete cascade primary key,
  email          text not null,
  full_name      text not null default '',
  avatar_url     text,
  role           text not null default 'cashier'
                 check (role in ('admin', 'manager', 'cashier')),
  business_mode  text not null default 'restaurant'
                 check (business_mode in ('restaurant', 'retail')),
  business_name  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- ─── RLS Policies ────────────────────────────────────────────────────────────

-- Users can read their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile (name, avatar)
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admins can read all profiles
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admins can update any profile (e.g. change roles)
create policy "Admins can update any profile"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─── Auto-create profile on signup ──────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, business_mode)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'cashier'),
    coalesce(new.raw_user_meta_data ->> 'business_mode', 'restaurant')
  );
  return new;
end;
$$;

-- Drop trigger if exists (idempotent)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Updated_at trigger ─────────────────────────────────────────────────────

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();
