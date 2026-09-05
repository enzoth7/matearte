CREATE TABLE IF NOT EXISTS public.commerce_exchange_rates (
    currency_code text primary key,
    rate_to_uyu numeric not null default 1,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.commerce_exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exchange rates are viewable by everyone" ON public.commerce_exchange_rates
    FOR SELECT USING (true);

CREATE POLICY "Exchange rates can be updated by authenticated users" ON public.commerce_exchange_rates
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Exchange rates can be inserted by authenticated users" ON public.commerce_exchange_rates
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

INSERT INTO public.commerce_exchange_rates (currency_code, rate_to_uyu)
VALUES ('USD', 41.0), ('BRL', 7.5)
ON CONFLICT (currency_code) DO NOTHING;
