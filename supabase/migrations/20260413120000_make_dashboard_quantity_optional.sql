alter table public.dashboard_items
  alter column quantity drop not null;

alter table public.dashboard_items
  drop constraint if exists dashboard_items_quantity_check;

alter table public.dashboard_items
  add constraint dashboard_items_quantity_check
  check (quantity is null or quantity > 0);