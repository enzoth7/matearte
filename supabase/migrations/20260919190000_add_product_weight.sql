-- Migration: 20260919190000_add_product_weight.sql
-- Add approximate weight (in grams) to products, defaulting to 0

alter table public.commerce_products
add column if not exists peso integer not null default 0;

comment on column public.commerce_products.peso is 'Peso aproximado del producto en gramos';

-- Also add peso column to orders table for snapshot / direct recording
alter table public.orders
add column if not exists peso integer not null default 0;

comment on column public.orders.peso is 'Peso total aproximado del pedido en gramos';

-- Update existing records to ensure not null guarantee
update public.commerce_products set peso = 0 where peso is null;
update public.orders set peso = 0 where peso is null;
