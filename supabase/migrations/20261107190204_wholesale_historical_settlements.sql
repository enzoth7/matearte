-- Permite registrar la confirmación de pago de pedidos históricos cuyo precio
-- original ARS no quedó guardado. El importe sigue desconocido y no se estima.
alter table public.wholesale_order_payment_openings
  add column paid_in_full_without_price boolean not null default false;

comment on column public.wholesale_order_payment_openings.paid_in_full_without_price is
  'Pago total confirmado por el equipo para un pedido histórico sin precio ARS original. No genera un ingreso ni inventa el importe del pedido.';
