-- Mensajes de la barra negra fija sobre el encabezado de la web. Se editan en Gestión, Marketing, Avisos.
-- El mensaje del descuento general no vive acá: aparece solo mientras ese descuento está vigente.

create table public.site_top_bar_messages (
  id uuid primary key default gen_random_uuid(),
  text_es text not null check (char_length(btrim(text_es)) between 1 and 160),
  text_en text check (text_en is null or char_length(text_en) <= 160),
  text_pt text check (text_pt is null or char_length(text_pt) <= 160),
  action text not null default 'none' check (action in ('none', 'subscribe', 'link')),
  action_label text check (action_label is null or char_length(action_label) <= 40),
  link_url text check (link_url is null or link_url ~ '^(/|https://)'),
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_top_bar_messages_link_needs_url check (action <> 'link' or link_url is not null)
);

create trigger site_top_bar_messages_updated_at
before update on public.site_top_bar_messages
for each row execute function private.set_updated_at();

alter table public.site_top_bar_messages enable row level security;

grant select on public.site_top_bar_messages to anon, authenticated;
grant insert, update, delete on public.site_top_bar_messages to authenticated;

create policy site_top_bar_messages_anon_read
on public.site_top_bar_messages
for select
to anon
using (enabled);

create policy site_top_bar_messages_authenticated_read
on public.site_top_bar_messages
for select
to authenticated
using (enabled or (select private.is_commerce_admin()));

create policy site_top_bar_messages_admin_insert
on public.site_top_bar_messages
for insert
to authenticated
with check ((select private.is_commerce_admin()));

create policy site_top_bar_messages_admin_update
on public.site_top_bar_messages
for update
to authenticated
using ((select private.is_commerce_admin()))
with check ((select private.is_commerce_admin()));

create policy site_top_bar_messages_admin_delete
on public.site_top_bar_messages
for delete
to authenticated
using ((select private.is_commerce_admin()));

insert into public.site_top_bar_messages (text_es, text_en, text_pt, action, action_label, sort_order) values
  ('¡Suscribite y recibí 10% de descuento!', 'Subscribe and get 10% off!', 'Inscreva-se e ganhe 10% de desconto!', 'subscribe', 'Click aquí', 10),
  ('Pago por transferencia 10% de descuento.', '10% off when you pay by bank transfer.', 'Pagamento por transferência com 10% de desconto.', 'none', null, 20),
  ('Se aceptan todas las tarjetas. Pago seguro por Mercado Pago y PayPal. Envíos nacionales e internacionales.',
   'All cards accepted. Secure payment with Mercado Pago and PayPal. National and international shipping.',
   'Aceitamos todos os cartões. Pagamento seguro com Mercado Pago e PayPal. Envios nacionais e internacionais.', 'none', null, 30);
