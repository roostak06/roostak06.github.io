-- Roostak starter schema. Review before production.
-- Run in Supabase SQL Editor after creating a project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text not null default '',
  avatar_url text,
  phone text,
  phone_public boolean not null default false,
  address text,
  social text,
  social_public boolean not null default false,
  is_top_seller boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  category text not null check (category in ('خوراکی محلی','عرقیجات و سرکه','محصولات کشاورزی','خدمات حضوری','صنایع دستی')),
  description text not null default '',
  price text,
  images jsonb not null default '[]'::jsonb,
  cover_url text,
  product_phone text,
  show_phone boolean not null default false,
  product_address text,
  product_social text,
  show_social boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint max_three_images check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 3)
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  username text not null,
  message text not null check (char_length(message) between 1 and 1200),
  request_type text not null default 'general',
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.support_requests enable row level security;

-- Profiles: public profile data is readable, but only owner can modify own profile.
create policy "profiles are readable" on public.profiles for select using (true);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Public sees approved products only; users can see their own products.
create policy "approved products or own products readable" on public.products
for select using (status = 'approved' or auth.uid() = user_id);
create policy "users create own pending products" on public.products
for insert with check (auth.uid() = user_id and status = 'pending' and is_featured = false);
create policy "users delete own products" on public.products
for delete using (auth.uid() = user_id);
drop policy if exists "users update own pending products" on public.products;
create policy "users update own products and resubmit for review" on public.products
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id and status = 'pending' and is_featured = false);

-- Securely toggle availability without allowing sellers to approve their own products.
create or replace function public.set_product_availability(product_id uuid, make_available boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.products
  set is_available = make_available
  where id = product_id
    and user_id = auth.uid()
    and status = 'approved';
  if not found then
    raise exception 'Product not found or not approved';
  end if;
end;
$$;
revoke all on function public.set_product_availability(uuid, boolean) from public;
grant execute on function public.set_product_availability(uuid, boolean) to authenticated;

-- A logged-in user may submit a support request. Anonymous support requests are not enabled yet.
create policy "logged in users create support requests" on public.support_requests
for insert with check (auth.uid() = user_id);
create policy "users read own support requests" on public.support_requests
for select using (auth.uid() = user_id);

-- Storage bucket (create from Storage UI as a PUBLIC bucket named product-images).
-- Create storage policies in Storage > Policies:
-- 1) INSERT for authenticated users: bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text
-- 2) SELECT for everyone: bucket_id = 'product-images'
-- Keep the bucket public only if public product images are intended to be public.
-- Do NOT give normal users permission to update/delete other users' files.

-- IMPORTANT AUTH NOTE:
-- This starter maps username to a synthetic email in app.js for a simple prototype.
-- Do not use this approach for a production launch without review/rate-limiting.
-- Enable email confirmation OFF for this prototype in Supabase Auth settings, since
-- users do not provide real email addresses. Password reset is handled via support.
-- Admin approval / featured seller/product selection policies are intentionally deferred
-- until the admin panel is designed. Never expose the service_role key in frontend code.
