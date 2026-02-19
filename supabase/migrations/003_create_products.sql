-- ─── Categories table ────────────────────────────────────────────────────────
-- Shared by both restaurant (menu categories) and retail (product categories).

create table if not exists public.categories (
  id             uuid default gen_random_uuid() primary key,
  name           text not null,
  icon           text,                                        -- emoji icon
  business_mode  text not null default 'restaurant'
                 check (business_mode in ('restaurant', 'retail')),
  sort_order     int not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ─── Products table ──────────────────────────────────────────────────────────
-- Unified table for both restaurant menu items and retail products.
-- Restaurant-only fields: is_veg, prep_time_mins
-- Retail-only fields: sku, barcode, cost, stock, low_stock_threshold, unit, brand

create table if not exists public.products (
  id                   uuid default gen_random_uuid() primary key,
  name                 text not null,
  description          text,
  price                numeric(10,2) not null default 0,
  category_id          uuid references public.categories(id) on delete set null,
  image_url            text,
  business_mode        text not null default 'restaurant'
                       check (business_mode in ('restaurant', 'retail')),
  is_active            boolean not null default true,
  discount             numeric(5,2) default 0,           -- percentage discount

  -- Restaurant-specific
  is_veg               boolean default false,
  prep_time_mins       int,                               -- estimated prep time

  -- Retail-specific
  sku                  text,
  barcode              text,
  cost                 numeric(10,2) default 0,           -- wholesale / cost price
  stock                int default 0,
  low_stock_threshold  int default 10,
  unit                 text default 'pcs',                -- pcs, kg, ltr, set, etc.
  brand                text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Index for fast lookups
create index if not exists idx_products_business_mode on public.products(business_mode);
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_sku on public.products(sku) where sku is not null;
create index if not exists idx_products_barcode on public.products(barcode) where barcode is not null;

-- ─── Product variants (retail) ───────────────────────────────────────────────
-- e.g. T-Shirt sizes, phone colors, bottle volumes

create table if not exists public.product_variants (
  id           uuid default gen_random_uuid() primary key,
  product_id   uuid references public.products(id) on delete cascade not null,
  name         text not null,                              -- "Large", "Red", "500ml"
  sku          text,
  barcode      text,
  price        numeric(10,2) not null default 0,
  cost         numeric(10,2) default 0,
  stock        int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ─── Stock adjustments (retail) ──────────────────────────────────────────────

create table if not exists public.stock_adjustments (
  id             uuid default gen_random_uuid() primary key,
  product_id     uuid references public.products(id) on delete cascade not null,
  variant_id     uuid references public.product_variants(id) on delete set null,
  type           text not null
                 check (type in ('restock', 'damaged', 'returned', 'sold', 'adjustment')),
  quantity       int not null,                             -- positive = in, negative = out
  previous_stock int not null,
  new_stock      int not null,
  note           text,
  staff_id       uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.stock_adjustments enable row level security;

-- All authenticated users can read categories and products
create policy "Authenticated users can read categories"
  on public.categories for select
  to authenticated
  using (true);

create policy "Authenticated users can read products"
  on public.products for select
  to authenticated
  using (true);

create policy "Authenticated users can read variants"
  on public.product_variants for select
  to authenticated
  using (true);

create policy "Authenticated users can read stock adjustments"
  on public.stock_adjustments for select
  to authenticated
  using (true);

-- Admin and manager can insert/update/delete
create policy "Admin/Manager can insert categories"
  on public.categories for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

create policy "Admin/Manager can update categories"
  on public.categories for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

create policy "Admin/Manager can delete categories"
  on public.categories for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

create policy "Admin/Manager can insert products"
  on public.products for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

create policy "Admin/Manager can update products"
  on public.products for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

create policy "Admin/Manager can delete products"
  on public.products for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

create policy "Admin/Manager can insert variants"
  on public.product_variants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

create policy "Admin/Manager can update variants"
  on public.product_variants for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

create policy "Admin/Manager can delete variants"
  on public.product_variants for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

create policy "Admin/Manager can insert stock adjustments"
  on public.stock_adjustments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

-- ─── Updated_at triggers ─────────────────────────────────────────────────────

create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.update_updated_at();

create trigger products_updated_at
  before update on public.products
  for each row execute function public.update_updated_at();
