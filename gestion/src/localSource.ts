export type LocalCustomer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  birth_date: string | null;
  first_purchase_date: string | null;
  last_purchase_date: string | null;
  source_user_id: string | null;
  notes: string;
};

export type LocalSaleItem = {
  id: string;
  variant_id: string | null;
  sku: string;
  product_name: string;
  variant_name: string;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
};

export type LocalSale = {
  id: string;
  sale_number: number;
  reference_code?: string | null;
  channel?: "Local" | "Instagram" | "Facebook" | "WhatsApp";
  customer_id: string | null;
  customer_name: string;
  sold_on: string;
  payment_method: string;
  total_minor: number;
  currency: string;
  created_at: string;
  local_sale_items: LocalSaleItem[];
};
