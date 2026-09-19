-- Migración: Tabla de tarifas de envíos internacionales por rangos de peso y zonas geográficas
-- Fecha: 2026-09-19

CREATE TABLE IF NOT EXISTS public.commerce_international_shipping_rates (
    id serial primary key,
    row_order integer not null unique,
    weight_label text not null,
    weight_min_g integer not null,
    weight_max_g integer not null,
    argentina numeric(10,2) not null,
    suramerica numeric(10,2) not null, -- BOLIVIA - BRASIL - CHILE - PARAGUAY - VENEZUELA
    estados_unidos numeric(10,2) not null,
    resto_america numeric(10,2) not null,
    espana numeric(10,2) not null,
    resto_europa numeric(10,2) not null,
    resto_mundo numeric(10,2) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.commerce_international_shipping_rates ENABLE ROW LEVEL SECURITY;

-- Lectura pública para cotización en storefront y checkout
DROP POLICY IF EXISTS "International shipping rates viewable by everyone" ON public.commerce_international_shipping_rates;
CREATE POLICY "International shipping rates viewable by everyone"
    ON public.commerce_international_shipping_rates
    FOR SELECT USING (true);

-- Modificación permitida a usuarios autenticados (administración de comercio)
DROP POLICY IF EXISTS "International shipping rates editable by authenticated" ON public.commerce_international_shipping_rates;
CREATE POLICY "International shipping rates editable by authenticated"
    ON public.commerce_international_shipping_rates
    FOR ALL USING (auth.role() = 'authenticated');

-- Carga inicial de tarifas (25 rangos de peso x 7 zonas)
INSERT INTO public.commerce_international_shipping_rates (
    row_order, weight_label, weight_min_g, weight_max_g,
    argentina, suramerica, estados_unidos, resto_america, espana, resto_europa, resto_mundo
) VALUES
(1, '250 - 500', 250, 500, 2760.00, 2672.50, 2938.50, 3029.50, 3120.50, 3208.00, 3299.00),
(2, '500 - 1', 500, 1000, 2938.50, 2882.50, 3120.50, 3208.00, 3299.00, 3386.50, 3519.50),
(3, '1 - 1,5', 1000, 1500, 3029.50, 2991.00, 3386.50, 3481.00, 3568.50, 3656.00, 3733.00),
(4, '1,5 - 2', 1500, 2000, 3120.50, 3201.00, 3656.00, 3656.00, 3747.00, 3841.50, 3946.50),
(5, '2 - 2,5', 2000, 2500, 3299.00, 3386.50, 3929.00, 3929.00, 4016.50, 4107.50, 4195.00),
(6, '2,5 - 3', 2500, 3000, 3386.50, 3568.50, 4289.50, 4107.50, 4195.00, 4289.50, 4377.00),
(7, '3 - 3,5', 3000, 3500, 3568.50, 3967.50, 4555.50, 4289.50, 4377.00, 4468.00, 4555.50),
(8, '3,5 - 4', 3500, 4000, 3747.00, 4076.00, 4825.00, 4555.50, 4646.50, 4734.00, 4825.00),
(9, '4 - 4,5', 4000, 4500, 3929.00, 4233.50, 5094.50, 4734.00, 4825.00, 4916.00, 5003.50),
(10, '4,5 - 5', 4500, 5000, 4016.50, 4342.00, 5364.00, 4916.00, 5003.50, 5094.50, 5185.50),
(11, '5 - 6', 5000, 6000, 4195.00, 4604.50, 5903.00, 5455.00, 5542.50, 5637.00, 5724.50),
(12, '6 - 7', 6000, 7000, 4468.00, 4821.50, 6445.50, 5815.50, 5903.00, 5990.50, 6085.00),
(13, '7 - 8', 7000, 8000, 4646.50, 5031.50, 6984.50, 6351.00, 6445.50, 6533.00, 6624.00),
(14, '8 - 9', 8000, 9000, 4825.00, 5245.00, 7520.00, 6711.50, 6799.00, 6890.00, 6984.50),
(15, '9 - 10', 9000, 10000, 5094.50, 5882.00, 8059.00, 7159.50, 7250.50, 7338.00, 7667.00),
(16, '10 - 11', 10000, 11000, 5276.50, 6092.00, 8601.50, 7520.00, 7611.00, 7698.50, 8192.00),
(17, '11 - 12', 11000, 12000, 5455.00, 6445.50, 9137.00, 8059.00, 8146.50, 8241.00, 8941.00),
(18, '12 - 13', 12000, 13000, 5724.50, 6624.00, 9676.00, 8419.50, 8601.50, 8640.00, 9469.50),
(19, '13 - 14', 13000, 14000, 5815.50, 6890.00, 10215.00, 8867.50, 8958.50, 9000.50, 9889.50),
(20, '14 - 15', 14000, 15000, 5903.00, 7250.50, 10845.00, 9315.50, 9361.00, 9406.50, 10320.00),
(21, '15 - 16', 15000, 16000, 5990.50, 7520.00, 11384.00, 9676.00, 10036.50, 10082.00, 11275.50),
(22, '16 - 17', 16000, 17000, 6085.00, 7793.00, 11923.00, 10127.50, 10351.50, 10397.00, 11804.00),
(23, '17 - 18', 17000, 18000, 6263.50, 8146.50, 12458.50, 10936.00, 11111.00, 11023.50, 12336.00),
(24, '18 - 19', 18000, 19000, 6533.00, 8507.00, 13001.00, 11111.00, 11205.50, 11293.00, 12973.00),
(25, '19 - 20', 19000, 20000, 6890.00, 8689.00, 13540.00, 11352.50, 11636.00, 11328.00, 13718.50)
ON CONFLICT (row_order) DO UPDATE SET
    weight_label = EXCLUDED.weight_label,
    weight_min_g = EXCLUDED.weight_min_g,
    weight_max_g = EXCLUDED.weight_max_g,
    argentina = EXCLUDED.argentina,
    suramerica = EXCLUDED.suramerica,
    estados_unidos = EXCLUDED.estados_unidos,
    resto_america = EXCLUDED.resto_america,
    espana = EXCLUDED.espana,
    resto_europa = EXCLUDED.resto_europa,
    resto_mundo = EXCLUDED.resto_mundo,
    updated_at = now();
