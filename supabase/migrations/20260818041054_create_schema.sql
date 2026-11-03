CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1,
  exchange_rate numeric NOT NULL,
  source text,
  generated_at timestamp with time zone,
  CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  model text NOT NULL,
  variant text NOT NULL,
  rim_type text,
  leather_type text,
  price_arg numeric NOT NULL,
  price_uyu numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  full_name text PRIMARY KEY,
  first_name text,
  last_name text,
  phone text,
  email text,
  address text,
  notes text
);

CREATE TABLE IF NOT EXISTS order_lines (
  line_id text PRIMARY KEY,
  order_id text,
  customer text REFERENCES customers(full_name) ON UPDATE CASCADE,
  model text,
  variant text,
  quantity integer NOT NULL DEFAULT 1,
  status text,
  created_at timestamp with time zone,
  completed_at timestamp with time zone
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for anon" ON settings FOR ALL USING (true);
CREATE POLICY "Enable all for anon" ON products FOR ALL USING (true);
CREATE POLICY "Enable all for anon" ON customers FOR ALL USING (true);
CREATE POLICY "Enable all for anon" ON order_lines FOR ALL USING (true);
