-- "Todos los talles/tamaños" es solo el valor comodín del atributo; no debe formar parte del nombre visible de la variante.
update public.commerce_variants
set name = btrim(regexp_replace(name, '\s*·\s*(Talle|Tamaño)\s+Todos los (talles|tamaños)\s*', '', 'gi'))
where name ~* 'todos los (talles|tamaños)';
