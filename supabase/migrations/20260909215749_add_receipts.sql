-- Items now belong to a receipt: a shop, with a name, a date, and the person
-- who fronted the money. Everyone else on the receipt owes that person their
-- share of it.

create table if not exists public.receipts (
  id uuid primary key,
  name text not null default '',
  purchased_on date not null default current_date,
  -- Null until someone says who paid; the summary skips a receipt without one.
  payer text check (payer in ('Elephant', 'Labubu', 'Alpaca')),
  created_at timestamptz not null default now()
);

create index if not exists receipts_recent_idx
  on public.receipts (purchased_on desc, created_at desc);

alter table public.expenses
  add column if not exists receipt_id uuid references public.receipts (id) on delete cascade;

-- Everything that existed before receipts did is real shopping, so it is kept
-- and gathered under one receipt rather than dropped.
do $$
declare
  legacy_id uuid;
begin
  if exists (select 1 from public.expenses where receipt_id is null) then
    legacy_id := gen_random_uuid();
    insert into public.receipts (id, name, purchased_on)
    values (legacy_id, 'Earlier items', current_date);
    update public.expenses set receipt_id = legacy_id where receipt_id is null;
  end if;
end $$;

alter table public.expenses alter column receipt_id set not null;

create index if not exists expenses_receipt_idx on public.expenses (receipt_id, sort_order);

-- One row per person who has settled up for a receipt. Marking a debt paid is
-- deliberately one-way, so this table is only ever inserted into.
create table if not exists public.settlements (
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  debtor text not null check (debtor in ('Elephant', 'Labubu', 'Alpaca')),
  settled_at timestamptz not null default now(),
  primary key (receipt_id, debtor)
);

-- Same access model as expenses: no accounts, so every request is `anon`.
alter table public.receipts enable row level security;
alter table public.settlements enable row level security;

drop policy if exists receipts_anon_select on public.receipts;
drop policy if exists receipts_anon_insert on public.receipts;
drop policy if exists receipts_anon_update on public.receipts;
drop policy if exists receipts_anon_delete on public.receipts;

create policy receipts_anon_select on public.receipts for select to anon using (true);
create policy receipts_anon_insert on public.receipts for insert to anon with check (true);
create policy receipts_anon_update on public.receipts for update to anon using (true) with check (true);
create policy receipts_anon_delete on public.receipts for delete to anon using (true);

drop policy if exists settlements_anon_select on public.settlements;
drop policy if exists settlements_anon_insert on public.settlements;

-- No update or delete policy: settling up cannot be taken back from the app.
create policy settlements_anon_select on public.settlements for select to anon using (true);
create policy settlements_anon_insert on public.settlements for insert to anon with check (true);

grant select, insert, update, delete on public.receipts to anon;
grant select, insert on public.settlements to anon;
