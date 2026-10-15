// Datos sintéticos exclusivos de pruebas; nunca se importan desde la aplicación.
import type { CommerceSnapshot } from "../commerceAdapter";
export function commerceFixture(): CommerceSnapshot {
  return {
    products: [{ id: "product-1", name: "Mate de catálogo", editorial_slug: "mate", category: "mates", published: true, sale_mode: "stock", peso: 250, updated_at: "2026-10-12T15:00:00Z", commerce_product_images: [], commerce_variants: [
      { id: "variant-1", sku: "SKU-1", name: "Cuero negro", price_minor: 100050, base_price_minor: 100050, active: true, weight_grams: 250, option_values: { cuero: "Negro", virola: "Alpaca" } },
      { id: "variant-2", sku: "SKU-2", name: "Cuero marrón", price_minor: 200000, base_price_minor: 200000, active: true, weight_grams: 260 },
    ] }],
    orders: [{ id: "order-1", order_number: 9001, user_id: "customer-1", paid_at: "2026-10-12T15:00:00Z", currency: "UYU", status: "ready_for_fulfillment", total_minor: 410100, shipping_minor: 20000, discount_minor: 15000, payment_fee_minor: 5000, shipping_method: "national_shipping", shipping_carrier: null, tracking_code: null, shipping_snapshot: {}, created_at: "2026-10-12T15:00:00Z", customer_snapshot: { fullName: "Cliente de prueba", email: "test@example.invalid", city: "Montevideo", phone: "099000000" }, commerce_bank_transfer_receipts: [], order_items: [
      { id: "item-1", item_type: "catalog", source_variant_id: "variant-1", title: "Mate negro", sku: "SKU-1", quantity: 2, unit_price_minor: 100050, total_minor: 200100, immutable_snapshot: {}, requires_review: false, review_status: null, production_status: "pending" },
      { id: "item-2", item_type: "catalog", source_variant_id: "variant-2", title: "Mate marrón", sku: "SKU-2", quantity: 1, unit_price_minor: 200000, total_minor: 200000, immutable_snapshot: {}, requires_review: true, review_status: "approved", production_status: "completed" },
    ] }],
    payments: [{ id: "payment-1", order_id: "order-1", provider: "mercadopago", status: "approved", currency: "UYU", amount_minor: 410100, approved_at: "2026-10-12T15:00:00Z", created_at: "2026-10-12T15:00:00Z" }],
    reference: { categories: [{ code: "mates", label_es: "Mates", active: true }], exchangeRates: [{ currency_code: "USD", rate_to_uyu: 40.25, updated_at: "2026-10-12" }], discounts: [{ id: "discount-1", code: "CODIGO", discount_type: "fixed", value: 15000, valid_from: "2026-10-01", valid_until: "2026-10-31", enabled: true }], shippingRates: [{ row_order: 1, weight_label: "Hasta 500g", weight_min_g: 0, weight_max_g: 500, argentina: 700, suramerica: 900, estados_unidos: 1100, resto_america: 1100, espana: 1200, resto_europa: 1400, resto_mundo: 1600 }], settings: { commerce_enabled: true, mercado_pago_enabled: true, paypal_enabled: true, catalog_price_adjustment_enabled: false, catalog_price_adjustment_percent: 0, wholesale_mate_discount_enabled: false, wholesale_mate_quantity_threshold: 10, wholesale_mate_discount_percent: 15 } },
    nationalRates: [{ id: "shipping-1", name: "Envío nacional", rate_minor: 20000, is_pickup: false, active: true, departments: [] }],
  };
}
