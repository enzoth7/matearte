import { commerceDate } from "./commerceAdapter";
import type { Customer, Order, OrderLine, Payment, Product, State } from "./data";
import type { WholesaleLine, WholesaleProduct, WholesaleSnapshot } from "./wholesaleSource";

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
const productKey = (model: string, variant: string) => `${normalized(model)}\u0000${normalized(variant)}`;
const number = (value: number | null | undefined) => value == null ? null : Number(value);

export function wholesaleLineValue(line: WholesaleLine, product: WholesaleProduct | undefined, rate: number) {
  if (line.order_type === "no_cost") return { arg: 0, uyu: 0, unitArg: 0, unitUyu: 0 };
  const quantity = Number(line.quantity) || 0;
  const unitArg = number(line.unit_price_arg) ?? Number(product?.price_arg || 0);
  const arg = number(line.total_arg) ?? unitArg * quantity;
  const unitUyu = number(line.unit_price_uyu) ?? Number(product?.price_uyu ?? unitArg * (number(line.exchange_rate) ?? rate));
  const uyu = number(line.total_uyu) ?? (line.unit_price_uyu != null ? unitUyu * quantity : line.total_arg != null ? arg * (number(line.exchange_rate) ?? rate) : unitUyu * quantity);
  return { arg, uyu, unitArg, unitUyu };
}

export function adaptWholesale(state: State, snapshot: WholesaleSnapshot): State {
  const byProduct = new Map(snapshot.products.map((product) => [productKey(product.model, product.variant), product]));
  const products: Product[] = snapshot.products.map((source) => ({
    id: `wholesale:${source.id}`, wholesaleProductId: source.id,
    name: source.model, sku: source.id, family: source.model, variant: source.variant,
    rim: source.rim_type || "", leather: source.leather_type || "", cost: 0,
    prices: { Local: 0, Web: 0, Mayorista: Number(source.price_uyu) }, priceArg: Number(source.price_arg),
    stock: 0, min: 0, published: false, active: true, availableChannels: ["Mayorista"],
  }));
  const customers: Customer[] = snapshot.customers.map((source) => ({
    id: `wholesale:${source.full_name}`, wholesaleName: source.full_name, name: source.full_name,
    email: source.email || "", phone: source.phone || "", address: source.address || "",
    notes: source.notes || "", city: "", country: "", segment: "Mayorista",
  }));
  const grouped = new Map<string, WholesaleLine[]>();
  for (const line of snapshot.lines) {
    const key = line.order_id?.trim() || `line:${line.line_id}`;
    grouped.set(key, [...(grouped.get(key) || []), line]);
  }
  const orders: Order[] = [];
  const payments: Payment[] = [];
  for (const [key, lines] of grouped) {
    const first = lines[0];
    const id = `wholesale:${key}`;
    const items: OrderLine[] = lines.map((line) => {
      const match = byProduct.get(productKey(line.model, line.variant));
      const value = wholesaleLineValue(line, match, snapshot.exchangeRate);
      return {
        id: line.line_id, wholesaleLineId: line.line_id, productId: match ? `wholesale:${match.id}` : `wholesale-missing:${line.line_id}`,
        title: line.model, sku: match?.id || "", quantity: Number(line.quantity),
        unitPrice: value.unitUyu, amount: value.uyu, family: line.model, variant: line.variant,
        rim: match?.rim_type || "", leather: match?.leather_type || "",
        productionStatus: line.status, reviewStatus: null, orderType: line.order_type || "normal",
        priceArg: value.arg, createdAt: line.created_at, completedAt: line.completed_at,
      };
    });
    const date = [...lines].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))[0]?.created_at || "";
    const production = lines.every((line) => line.status === "Completado") ? "Terminado" : lines.some((line) => line.status === "En producción") ? "En producción" : "Pendiente";
    const order: Order = {
      id, source: "wholesale", referenceCode: first.order_id || null,
      status: "wholesale_sale", customerId: `wholesale:${first.customer}`,
      customerName: first.customer, productId: items[0]?.productId || "",
      quantity: items.reduce((sum, item) => sum + item.quantity, 0), unitPrice: 0,
      items, totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
      channel: "Mayorista", date: date ? commerceDate(date) : "", due: "",
      production, delivery: "No aplica", method: "No aplica", design: false, approved: true,
    };
    orders.push(order);
    for (const line of lines) {
      const match = byProduct.get(productKey(line.model, line.variant));
      const amount = wholesaleLineValue(line, match, snapshot.exchangeRate).uyu;
      if (!amount) continue;
      const half = amount / 2;
      payments.push({ id: `wholesale:${line.line_id}:deposit`, orderId: id, amount: half, date: line.created_at ? commerceDate(line.created_at) : order.date, method: "Mayorista · seña", derived: true });
      if (line.status === "Completado") payments.push({ id: `wholesale:${line.line_id}:balance`, orderId: id, amount: amount - half, date: line.completed_at ? commerceDate(line.completed_at) : order.date, method: "Mayorista · saldo", derived: true });
    }
  }
  return {
    ...state,
    products: [...state.products, ...products],
    customers: [...state.customers, ...customers],
    orders: [...state.orders, ...orders].sort((a, b) => b.date.localeCompare(a.date)),
    payments: [...state.payments, ...payments],
    records: { ...state.records, monedas: [...(state.records.monedas || []), { id: "ARS", moneda: "ARS", valor: snapshot.exchangeRate }] },
  };
}
