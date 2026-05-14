-- PropAgent Supabase Schema
-- Supabase Dashboard > SQL Editor'da çalıştır

-- Properties tablosu
create table if not exists properties (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  property_type text not null default 'daire',
  listing_type  text not null default 'kiralık',
  city        text default 'İstanbul',
  district    text not null default '',
  neighborhood text default '',
  gross_m2    numeric default 0,
  net_m2      numeric default 0,
  room_count  text default '3+1',
  floor       integer default 0,
  total_floors integer default 0,
  building_age integer default 0,
  sale_price  numeric default 0,
  monthly_rent numeric default 0,
  currency    text default 'TRY',
  tenant_name text default '',
  tenant_status text default 'vacant',
  lease_start date,
  lease_end   date,
  notes       text default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Giderler tablosu (property ile 1-N ilişki)
create table if not exists property_expenses (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade not null,
  type        text not null default 'aidat',
  amount      numeric not null default 0,
  frequency   text not null default 'monthly'
);

-- Pazar ilanları tablosu (MarketCompare için)
create table if not exists market_listings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  source      text default 'sahibinden',
  title       text default '',
  district    text not null default '',
  city        text default 'İstanbul',
  property_type text default 'daire',
  room_count  text default '3+1',
  net_m2      numeric default 0,
  sale_price  numeric not null default 0,
  monthly_rent numeric default 0,
  floor       integer default 0,
  building_age integer default 0,
  notes       text default '',
  created_at  timestamptz default now()
);

-- Row Level Security (her kullanıcı sadece kendi verilerini görür)
alter table properties enable row level security;
alter table property_expenses enable row level security;
alter table market_listings enable row level security;

-- RLS Policies
create policy "properties_own" on properties
  for all using (auth.uid() = user_id);

create policy "expenses_own" on property_expenses
  for all using (
    property_id in (select id from properties where user_id = auth.uid())
  );

create policy "market_listings_own" on market_listings
  for all using (auth.uid() = user_id);

-- updated_at otomatik güncelleme trigger'ı
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger properties_updated_at
  before update on properties
  for each row execute function set_updated_at();
