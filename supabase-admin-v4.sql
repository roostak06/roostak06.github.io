-- Roostak admin bootstrap. Review your existing schema before running.
-- Run in Supabase SQL Editor. This script creates the admin allowlist table.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- A signed-in user can check only their own membership.
drop policy if exists "Users can read own admin membership" on public.admin_users;
create policy "Users can read own admin membership"
on public.admin_users for select to authenticated
using (user_id = auth.uid());
-- Only project owners/service role should manage admin_users from SQL/editor.
-- Do NOT add a client INSERT/UPDATE policy for this table.
-- The admin panel relies on server-side RLS policies on products/profiles/support_requests.
-- Important: this table alone does NOT grant permission to moderate those tables.
