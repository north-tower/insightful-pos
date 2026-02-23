-- Add full_name and tagline columns to business_settings
-- full_name = the full trading name shown on receipts / customer pages
-- tagline  = short phrase shown on the login page footer

alter table public.business_settings
  add column if not exists full_name text not null default '',
  add column if not exists tagline   text not null default '';
