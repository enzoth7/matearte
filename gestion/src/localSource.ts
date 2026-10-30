export type LocalCustomer = {
  id: string;
  full_name: string;
  company_name?: string | null;
  address?: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  department?: string | null;
  postal_code?: string | null;
  product_interest?: string | null;
  birth_date: string | null;
  first_purchase_date: string | null;
  last_purchase_date: string | null;
  source_user_id: string | null;
  linked_customer_id?: string | null;
  notes: string;
  agenda_import_key?: string | null;
  agenda_additional_phones?: string[];
  agenda_inferred_category?: string | null;
  updated_at?: string;
  created_at?: string;
  origin_channel?: "Local" | "Web" | "WhatsApp" | "Instagram" | "Facebook" | "Feria" | "Agenda" | "Sorteo";
  customer_type?: "Minorista" | "Mayorista";
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
  customization?: Record<string, unknown> | null;
  production_notes?: string | null;
  production_status?: string | null;
};

export type LocalSale = {
  id: string;
  sale_number: number;
  reference_code?: string | null;
  channel?: "Local" | "Feria" | "Instagram" | "Facebook" | "WhatsApp";
  customer_id: string | null;
  customer_name: string;
  sold_on: string;
  payment_method: string;
  total_minor: number;
  deposit_minor?: number | null;
  currency: string;
  created_at: string;
  local_sale_items: LocalSaleItem[];
};

export type LocalSaleReceipt = {
  id: string;
  sale_id: string;
  amount_minor: number;
  payment_method: string;
  paid_on: string;
  created_at: string;
};
