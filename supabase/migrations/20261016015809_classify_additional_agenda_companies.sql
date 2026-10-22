-- Segunda pasada de instituciones y comercios identificados sin ambigüedad.
with mapping(old_name, new_name, company_name) as (values
  ('Almacén De Algodón', 'Almacén De Algodón', 'Almacén de Algodón'),
  ('Andrea Garmendia Canal 9 Arg', 'Andrea Garmendia', 'Canal 9'),
  ('Andrea Inmobiliaria', 'Andrea', 'Inmobiliaria'),
  ('Bodega Vinoterra', 'Bodega Vinoterra', 'Bodega Vinoterra'),
  ('Boutique', 'Boutique', 'Boutique'),
  ('Carpinteria', 'Carpinteria', 'Carpintería'),
  ('Cecilia Vidart Dirección Nacional De Artesanías Pequeñas Y Medianas Empresas Referente Territorial', 'Cecilia Vidart', 'Dirección Nacional de Artesanías, Pequeñas y Medianas Empresas'),
  ('Consulado Colon Migraciones', 'Consulado Colon Migraciones', 'Consulado Colón Migraciones'),
  ('Deymonaz Inmobiliria', 'Deymonaz Inmobiliria', 'Inmobiliaria Deymonaz'),
  ('Inmobiliaria Cochera Auto', 'Inmobiliaria Cochera Auto', 'Inmobiliaria Cochera Auto'),
  ('Inmobiliaria Dessimoz', 'Inmobiliaria Dessimoz', 'Inmobiliaria Dessimoz'),
  ('Inmobiliaria Deymonaz', 'Inmobiliaria Deymonaz', 'Inmobiliaria Deymonaz'),
  ('Moncho Almacen', 'Moncho', 'Almacén'),
  ('Office Shopping', 'Office Shopping', 'Office Shopping'),
  ('Taller Eurorepar', 'Taller Eurorepar', 'Taller Eurorepar'),
  ('Taller Tossi', 'Taller Tossi', 'Taller Tossi'),
  ('Transporte Marcelito Colon', 'Transporte Marcelito Colon', 'Transporte Marcelito Colón'),
  ('Transporte Piloni', 'Transporte Piloni', 'Transporte Piloni'),
  ('Transportes Arzuaga', 'Transportes Arzuaga', 'Transportes Arzuaga')
)
update public.local_sales_customers c
set full_name = m.new_name, company_name = m.company_name
from mapping m
where c.agenda_import_key is not null
  and c.company_name is null
  and c.full_name = m.old_name;
