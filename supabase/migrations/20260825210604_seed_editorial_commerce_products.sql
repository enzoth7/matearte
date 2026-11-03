insert into public.commerce_products (editorial_slug, name, category, description, sale_mode, published)
values
  ('mate-imperial', 'Mate Imperial', 'mates', 'Una silueta emblemática con metal trabajado y cuero de tono profundo.', 'standard', false),
  ('mate-imperial-animal-print', 'Imperial animal print', 'mates', 'El formato imperial en una terminación expresiva y contemporánea.', 'standard', false),
  ('mate-criollo-con-posa-mate', 'Criollo con posa mate', 'mates', 'Mate criollo acompañado por una base de cuero.', 'standard', false),
  ('mate-camionero-acero-liso', 'Camionero con acero liso', 'mates', 'Silueta camionera con una virola sobria de acero inoxidable.', 'standard', false),
  ('mate-torpedo', 'Mate Torpedo', 'mates', 'Una forma reconocible, envuelta en cuero y lista para personalizar.', 'standard', false),
  ('bombilla-acero-desarmable', 'Bombilla de acero desarmable', 'bombillas', 'Una bombilla práctica y desmontable para facilitar su cuidado.', 'standard', false),
  ('bombilla-alpaca-pico-loro', 'Bombilla de alpaca pico de loro', 'bombillas', 'Perfil clásico de pico de loro en una pieza de alpaca.', 'standard', false),
  ('limpia-bombillas', 'Limpia bombillas', 'bombillas', 'Accesorio simple para el mantenimiento habitual de la bombilla.', 'standard', false),
  ('matera-de-colgar-cuero', 'Matera de colgar de cuero', 'materas', 'Una matera compacta con correa para acompañar el movimiento.', 'standard', false),
  ('matera-cuadrada-cuero', 'Matera cuadrada de cuero', 'materas', 'Formato estructurado para organizar mate, termo y accesorios.', 'standard', false),
  ('matera-ovalada-cuero', 'Matera ovalada de cuero', 'materas', 'Un formato envolvente para transportar el equipo matero.', 'standard', false),
  ('termo-stanley-800-ml', 'Termo Stanley 800 ml', 'termos', 'Formato compacto para acompañar el mate fuera de casa.', 'standard', false),
  ('termo-stanley-12-l', 'Termo Stanley 1,2 l', 'termos', 'Termo de mayor volumen para reuniones, viajes y jornadas largas.', 'standard', false),
  ('termo-termolar-1l', 'Termo Termolar 1 l', 'termos', 'Un termo de un litro pensado para el uso diario.', 'standard', false),
  ('set-premium', 'Set premium', 'regalos', 'Una composición de piezas MateArte en tonos naturales.', 'standard', false),
  ('box-matero', 'Box matero', 'regalos', 'Una selección matera presentada como inspiración para un obsequio.', 'standard', false)
on conflict (editorial_slug) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description;
