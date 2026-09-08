-- Increase upload limit from 5MB to 10MB (10485760 bytes)
alter table public.commerce_product_images
  drop constraint if exists commerce_product_images_byte_size_check;
alter table public.commerce_product_images
  add constraint commerce_product_images_byte_size_check check (byte_size between 1 and 10485760);

alter table public.design_assets
  drop constraint if exists design_assets_byte_size_check;
alter table public.design_assets
  add constraint design_assets_byte_size_check check (byte_size between 1 and 10485760);

alter table public.design_previews
  drop constraint if exists design_previews_byte_size_check;
alter table public.design_previews
  add constraint design_previews_byte_size_check check (byte_size between 1 and 10485760);

update storage.buckets
set file_size_limit = 10485760
where id in ('product-images', 'design-assets', 'design-previews');
