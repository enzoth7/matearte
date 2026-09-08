alter table if exists public.order_lines
  add column if not exists order_type text not null default 'normal';

alter table if exists public.order_lines
  drop constraint if exists order_lines_order_type_check;

alter table if exists public.order_lines
  add constraint order_lines_order_type_check
  check (order_type in ('normal', 'no_cost'));

comment on column public.order_lines.order_type is
  'normal bills the order; no_cost tracks a replacement/already-paid order without adding revenue.';
