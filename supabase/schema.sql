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
  parcel_no   text default '',
  zoning_status text default 'konut',
  deed_status text default 'tapulu',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Mevcut tabloya yeni arsa sütunları ekle (güvenle çalışır)
alter table properties add column if not exists parcel_no text default '';
alter table properties add column if not exists zoning_status text default 'konut';
alter table properties add column if not exists deed_status text default 'tapulu';

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

-- Kiracı ödemeleri tablosu
create table if not exists tenant_payments (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade not null,
  month       text not null,        -- 'YYYY-MM' formatı
  amount      numeric not null default 0,
  status      text not null default 'pending',  -- 'paid' | 'overdue' | 'pending'
  paid_at     timestamptz,
  notes       text default '',
  created_at  timestamptz default now(),
  unique(property_id, month)
);

-- Kullanıcı profilleri tablosu
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  first_name  text default '',
  last_name   text default '',
  phone       text default '',
  company     text default '',
  updated_at  timestamptz default now()
);

-- Row Level Security (her kullanıcı sadece kendi verilerini görür)
alter table properties enable row level security;
alter table property_expenses enable row level security;
alter table market_listings enable row level security;
alter table tenant_payments enable row level security;
alter table profiles enable row level security;

-- RLS Policies
do $$ begin
  if not exists (select 1 from pg_policies where tablename='properties' and policyname='properties_own') then
    create policy "properties_own" on properties for all using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='property_expenses' and policyname='expenses_own') then
    create policy "expenses_own" on property_expenses
      for all using (property_id in (select id from properties where user_id = auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='market_listings' and policyname='market_listings_own') then
    create policy "market_listings_own" on market_listings for all using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='tenant_payments' and policyname='tenant_payments_own') then
    create policy "tenant_payments_own" on tenant_payments
      for all using (property_id in (select id from properties where user_id = auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profiles_own') then
    create policy "profiles_own" on profiles for all using (auth.uid() = id);
  end if;
end $$;

-- updated_at otomatik güncelleme trigger'ı
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='properties_updated_at') then
    create trigger properties_updated_at
      before update on properties
      for each row execute function set_updated_at();
  end if;
end $$;
