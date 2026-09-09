-- One shared expense list for the house.
--
-- This app has no accounts. The publishable key ships in the browser bundle,
-- so every request arrives as the `anon` role and anyone with the site URL can
-- read and write this table. The policies below say that plainly rather than
-- implying an ownership model that does not exist.

create table if not exists public.expenses (
  id uuid primary key,
  name text not null default '',
  -- Null while a row is still being filled in; the UI shows an empty cell.
  cost numeric(10, 2),
  quantity integer,
  elephant boolean not null default false,
  labubu boolean not null default false,
  alpaca boolean not null default false,
  -- Client-assigned so scanned receipts keep the order they were read in.
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists expenses_order_idx on public.expenses (sort_order, created_at);

alter table public.expenses enable row level security;

drop policy if exists expenses_anon_select on public.expenses;
drop policy if exists expenses_anon_insert on public.expenses;
drop policy if exists expenses_anon_update on public.expenses;
drop policy if exists expenses_anon_delete on public.expenses;

create policy expenses_anon_select on public.expenses
  for select to anon using (true);

create policy expenses_anon_insert on public.expenses
  for insert to anon with check (true);

-- Update needs both USING and WITH CHECK: without WITH CHECK the row could be
-- rewritten into a shape the policy would not have accepted on insert.
create policy expenses_anon_update on public.expenses
  for update to anon using (true) with check (true);

create policy expenses_anon_delete on public.expenses
  for delete to anon using (true);

grant select, insert, update, delete on public.expenses to anon;
