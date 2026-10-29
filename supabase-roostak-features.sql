-- Roostak feature migration: dynamic categories and public seller bio.
-- Review current policies before applying in production.

alter table public.profiles add column if not exists bio text;

create table if not exists public.roostak_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 2 and 60),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.roostak_categories enable row level security;

drop policy if exists "Public can read active Roostak categories" on public.roostak_categories;
create policy "Public can read active Roostak categories"
on public.roostak_categories for select to anon, authenticated using (is_active = true or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
drop policy if exists "Admins manage Roostak categories" on public.roostak_categories;
create policy "Admins manage Roostak categories"
on public.roostak_categories for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

insert into public.roostak_categories(name,sort_order) values
 ('خوراکی محلی',1),('عرقیجات و سرکه',2),('محصولات کشاورزی',3),('خدمات حضوری',4),('صنایع دستی',5)
on conflict (name) do nothing;

-- The starter schema's hard-coded CHECK blocks new category names; replace it
-- with a foreign key to the dynamic category table.
alter table public.products drop constraint if exists products_category_check;
alter table public.products drop constraint if exists products_category_fkey;
update public.products p set category = 'خوراکی محلی'
where not exists (select 1 from public.roostak_categories c where c.name=p.category);
alter table public.products add constraint products_category_fkey
foreign key (category) references public.roostak_categories(name) on update cascade on delete restrict;

-- Admin password reset must run in a trusted Edge Function, never in browser JS.
