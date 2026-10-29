-- Apply this migration to an existing Roostak Supabase database.
-- It adds product availability, lets owners edit and resubmit their own listings,
-- and adds a safe RPC for availability toggles without allowing self-approval.

alter table public.products
  add column if not exists is_available boolean not null default true;

drop policy if exists "users update own pending products" on public.products;
drop policy if exists "users update own products and resubmit for review" on public.products;
create policy "users update own products and resubmit for review" on public.products
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id and status = 'pending' and is_featured = false);

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
