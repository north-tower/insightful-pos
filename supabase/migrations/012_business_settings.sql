-- ─── Business Settings table ────────────────────────────────────────────────
-- Stores company-wide information (name, address, contact details) that
-- appears on receipts, invoices, the sidebar, and other UI surfaces.
-- Each authenticated user owns exactly one row (linked via user_id → auth.users).

create table if not exists public.business_settings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null unique,
  name        text not null default '',
  address     text not null default '',
  city        text not null default '',
  phone       text not null default '',
  email       text not null default '',
  website     text not null default '',
  tax_id      text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.business_settings enable row level security;

-- Anyone can read business settings (name, address, etc. is public info on receipts)
create policy "Anyone can view business settings"
  on public.business_settings for select
  using (true);

-- Users can insert their own settings
create policy "Users can insert own business settings"
  on public.business_settings for insert
  with check (auth.uid() = user_id);

-- Users can update their own settings
create policy "Users can update own business settings"
  on public.business_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Updated_at trigger
create trigger business_settings_updated_at
  before update on public.business_settings
  for each row execute function public.update_updated_at();
