-- Money one person has sent another toward what they owe. Settling up used to
-- clear every receipt at once, so it could only be pressed after everyone had
-- paid. A payment is recorded by the person who made it, whenever they make it.
--
-- Payments are not tied to receipts: the settle-up plan nets debts across
-- receipts, so the money moving between people does too.

create table if not exists public.payments (
  id uuid primary key,
  from_person text not null check (from_person in ('Elephant', 'Labubu', 'Alpaca')),
  to_person text not null check (to_person in ('Elephant', 'Labubu', 'Alpaca')),
  amount numeric(10, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  -- Set once the house is square. The receipts the payment went towards are
  -- marked settled at the same moment, so it stops counting against them.
  cleared_at timestamptz,
  check (from_person <> to_person)
);

create index if not exists payments_recent_idx on public.payments (created_at desc);

-- Same access model as everything else: no accounts, so every request is
-- `anon`. Like settlements, a payment cannot be edited or taken back.
alter table public.payments enable row level security;

drop policy if exists payments_anon_select on public.payments;
drop policy if exists payments_anon_insert on public.payments;

create policy payments_anon_select on public.payments for select to anon using (true);
create policy payments_anon_insert on public.payments for insert to anon with check (true);

grant select, insert on public.payments to anon;

-- When the payments add up to everyone being square, the receipts they paid
-- for are marked settled and the payments cleared together, so the totals can
-- never count the same money twice. Only the payments the caller saw are
-- cleared: one recorded in the meantime still counts towards the next round.
create or replace function public.square_up(pairs jsonb, payment_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  insert into settlements (receipt_id, debtor)
  select (pair ->> 'receiptId')::uuid, pair ->> 'debtor'
  from jsonb_array_elements(pairs) as pair
  on conflict do nothing;

  update payments
  set cleared_at = now()
  where id = any (payment_ids) and cleared_at is null;
$$;

grant execute on function public.square_up(jsonb, uuid[]) to anon;
