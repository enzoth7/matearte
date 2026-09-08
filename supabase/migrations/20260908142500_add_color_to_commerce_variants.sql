-- Add color column to commerce_variants to allow explicit variant color assignment
alter table public.commerce_variants
  add column if not exists color text;

comment on column public.commerce_variants.color is
  'Normalized color identifier for the variant (e.g. marron, negro, natural, etc.).';
