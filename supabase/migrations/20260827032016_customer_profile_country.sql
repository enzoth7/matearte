-- Store the customer's country once for both the visualizer and the main shop.
-- Existing profiles were created by the Uruguay-only form, so they are safely
-- backfilled as Uruguay while new and edited profiles can select any ISO code.

alter table public.customer_profiles
  add column country_code text not null default 'UY';

alter table public.customer_profiles
  add constraint customer_profiles_country_code_check
    check (country_code ~ '^[A-Z]{2}$');

alter table public.customer_profiles
  drop constraint customer_profiles_completion_check;

alter table public.customer_profiles
  add constraint customer_profiles_completion_check
    check (
      profile_completed_at is null
      or (
        birth_date is not null
        and country_code ~ '^[A-Z]{2}$'
        and nullif(btrim(city), '') is not null
        and nullif(btrim(address_line1), '') is not null
        and (
          country_code <> 'UY'
          or nullif(btrim(department), '') is not null
        )
      )
    );

comment on column public.customer_profiles.country_code is
  'ISO 3166-1 alpha-2 country shared by the main shop and the visualizer.';
