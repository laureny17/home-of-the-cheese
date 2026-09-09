-- Items are listed one per unit now, so quantity has nothing left to say.
--
-- Three rows still carry one: a baguette at 2, a bag fee at 3, ravioli at 2,
-- $6.18 between them. Dropping the column without unpacking them first would
-- quietly take that off the house's totals, so each becomes that many rows,
-- keeping who was checked off and where it sits on the receipt.

insert into public.expenses
  (id, receipt_id, name, cost, quantity, elephant, labubu, alpaca, sort_order)
select
  gen_random_uuid(), e.receipt_id, e.name, e.cost, 1,
  e.elephant, e.labubu, e.alpaca, e.sort_order
from public.expenses e
cross join lateral generate_series(2, e.quantity) as copy
where e.quantity is not null and e.quantity > 1;

alter table public.expenses drop column quantity;
