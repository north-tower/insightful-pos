-- ─── Add business_mode column to existing profiles table ─────────────────────
-- Run this if you already ran 001_create_profiles.sql

-- 1. Add the column (with a default so existing rows get a value)
alter table public.profiles
  add column if not exists business_mode text not null default 'restaurant'
  check (business_mode in ('restaurant', 'retail'));

-- 2. Update the trigger function to include business_mode on new signups
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
