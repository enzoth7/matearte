-- Add variant_id to product images to allow linking photos to specific colors or variants
alter table public.commerce_product_images
  add column if not exists variant_id uuid references public.commerce_variants(id) on delete set null;

comment on column public.commerce_product_images.variant_id is
  'Optional linked variant. If set, this image is associated specifically with that variant (e.g. a specific color).';
