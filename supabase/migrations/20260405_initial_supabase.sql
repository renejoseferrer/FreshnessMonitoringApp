create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null default 'operator' check (role in ('developer', 'operator')),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists profiles_email_lower_idx on public.profiles ((lower(email)));

create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null unique,
  plu text,
  barcode text,
  photo_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists product_catalog_barcode_idx on public.product_catalog (barcode);
create index if not exists product_catalog_plu_idx on public.product_catalog (plu);

create table if not exists public.dashboard_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null,
  plu text,
  barcode text,
  photo_path text,
  quantity integer not null check (quantity > 0),
  expiration date not null,
  updated_by_user_id uuid references public.profiles(id) on delete set null,
  updated_by_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists dashboard_items_expiration_idx on public.dashboard_items (expiration);
create index if not exists dashboard_items_name_key_idx on public.dashboard_items (name_key);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor text not null,
  actor_role text not null,
  action text not null,
  product_name text,
  details text not null,
  timestamp timestamptz not null default timezone('utc', now())
);

create index if not exists activity_log_timestamp_idx on public.activity_log (timestamp desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_product_catalog_updated_at on public.product_catalog;
create trigger set_product_catalog_updated_at
before update on public.product_catalog
for each row
execute function public.set_updated_at();

drop trigger if exists set_dashboard_items_updated_at on public.dashboard_items;
create trigger set_dashboard_items_updated_at
before update on public.dashboard_items
for each row
execute function public.set_updated_at();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, active)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(lower(coalesce(new.email, '')), '@', 1), ''),
      'user'
    ),
    'operator',
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();

alter table public.profiles enable row level security;
alter table public.product_catalog enable row level security;
alter table public.dashboard_items enable row level security;
alter table public.activity_log enable row level security;

drop policy if exists "profiles_select_self_or_developer" on public.profiles;
create policy "profiles_select_self_or_developer"
on public.profiles
for select
to authenticated
using (
  public.current_user_active()
  and (id = auth.uid() or public.current_user_role() = 'developer')
);

drop policy if exists "profiles_update_developer" on public.profiles;
create policy "profiles_update_developer"
on public.profiles
for update
to authenticated
using (public.current_user_active() and public.current_user_role() = 'developer')
with check (public.current_user_active() and public.current_user_role() = 'developer');

drop policy if exists "catalog_select_active_users" on public.product_catalog;
create policy "catalog_select_active_users"
on public.product_catalog
for select
to authenticated
using (public.current_user_active());

drop policy if exists "catalog_insert_active_users" on public.product_catalog;
create policy "catalog_insert_active_users"
on public.product_catalog
for insert
to authenticated
with check (public.current_user_active());

drop policy if exists "catalog_update_active_users" on public.product_catalog;
create policy "catalog_update_active_users"
on public.product_catalog
for update
to authenticated
using (public.current_user_active())
with check (public.current_user_active());

drop policy if exists "catalog_delete_developers" on public.product_catalog;
create policy "catalog_delete_developers"
on public.product_catalog
for delete
to authenticated
using (public.current_user_active() and public.current_user_role() = 'developer');

drop policy if exists "dashboard_select_active_users" on public.dashboard_items;
create policy "dashboard_select_active_users"
on public.dashboard_items
for select
to authenticated
using (public.current_user_active());

drop policy if exists "dashboard_insert_active_users" on public.dashboard_items;
create policy "dashboard_insert_active_users"
on public.dashboard_items
for insert
to authenticated
with check (public.current_user_active());

drop policy if exists "dashboard_update_active_users" on public.dashboard_items;
create policy "dashboard_update_active_users"
on public.dashboard_items
for update
to authenticated
using (public.current_user_active())
with check (public.current_user_active());

drop policy if exists "dashboard_delete_active_users" on public.dashboard_items;
create policy "dashboard_delete_active_users"
on public.dashboard_items
for delete
to authenticated
using (public.current_user_active());

drop policy if exists "activity_insert_active_users" on public.activity_log;
create policy "activity_insert_active_users"
on public.activity_log
for insert
to authenticated
with check (public.current_user_active());

drop policy if exists "activity_select_developers" on public.activity_log;
create policy "activity_select_developers"
on public.activity_log
for select
to authenticated
using (public.current_user_active() and public.current_user_role() = 'developer');

insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

drop policy if exists "product_photos_select_active_users" on storage.objects;
create policy "product_photos_select_active_users"
on storage.objects
for select
to authenticated
using (bucket_id = 'product-photos' and public.current_user_active());

drop policy if exists "product_photos_insert_active_users" on storage.objects;
create policy "product_photos_insert_active_users"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'product-photos' and public.current_user_active());