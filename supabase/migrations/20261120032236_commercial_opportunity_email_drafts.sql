alter table public.commercial_opportunities add column apertura_correo text
  check (apertura_correo is null or char_length(btrim(apertura_correo)) between 1 and 600);

grant select (apertura_correo) on public.commercial_opportunities to authenticated;

notify pgrst, 'reload schema';
