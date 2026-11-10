-- Keep wholesale personal names consistently cased at the data source.
-- Only words written entirely in capitals are changed. Existing particles,
-- accents, mixed-case names, and company abbreviations remain untouched.
create or replace function private.normalize_wholesale_person_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name is null or btrim(p_name) = '' then p_name
    else array_to_string(
      array(
        select case
          when word = upper(word)
            and word ~ '[[:upper:]]{2}'
            and word !~ '^[[:upper:]](\.[[:upper:]])+\.?$'
          then initcap(lower(word))
          else word
        end
        from regexp_split_to_table(btrim(p_name), '[[:space:]]+') as words(word)
      ),
      ' '
    )
  end;
$$;

create or replace function private.normalize_wholesale_contact_names()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.wholesale_name is not null
    or new.customer_type = 'Mayorista'
    or new.linked_customer_id like 'wholesale:%'
  then
    new.wholesale_name := private.normalize_wholesale_person_name(new.wholesale_name);
    new.full_name := private.normalize_wholesale_person_name(new.full_name);
    new.first_name := private.normalize_wholesale_person_name(new.first_name);
    new.last_name := private.normalize_wholesale_person_name(new.last_name);
    if new.linked_customer_id like 'wholesale:%' then
      new.linked_customer_id := 'wholesale:' || private.normalize_wholesale_person_name(substr(new.linked_customer_id, 11));
    end if;
  end if;
  return new;
end;
$$;

create trigger contacts_normalize_wholesale_names
before insert or update on public.contacts
for each row execute function private.normalize_wholesale_contact_names();

create or replace function private.normalize_wholesale_order_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.channel = 'Mayorista' then
    new.customer_name := private.normalize_wholesale_person_name(new.customer_name);
  end if;
  return new;
end;
$$;

create trigger orders_normalize_wholesale_name
before insert or update of customer_name, channel on public.orders
for each row execute function private.normalize_wholesale_order_name();

update public.contacts
set wholesale_name = wholesale_name
where (wholesale_name is not null
    or customer_type = 'Mayorista'
    or linked_customer_id like 'wholesale:%')
  and (
    wholesale_name is distinct from private.normalize_wholesale_person_name(wholesale_name)
    or full_name is distinct from private.normalize_wholesale_person_name(full_name)
    or first_name is distinct from private.normalize_wholesale_person_name(first_name)
    or last_name is distinct from private.normalize_wholesale_person_name(last_name)
    or (linked_customer_id like 'wholesale:%' and linked_customer_id is distinct from
      'wholesale:' || private.normalize_wholesale_person_name(substr(linked_customer_id, 11)))
  );

update public.orders o
set customer_name = c.wholesale_name
from public.contacts c
where o.channel = 'Mayorista'
  and o.contact_id = c.id
  and c.wholesale_name is not null
  and o.customer_name is distinct from c.wholesale_name;

update public.orders
set customer_name = customer_name
where channel = 'Mayorista'
  and customer_name is distinct from private.normalize_wholesale_person_name(customer_name);
