import { defaultAccess } from "./access";
import { paths } from "./navigation";

export type Channel = "Local" | "Web" | "Mayorista";
export type SalesChannel = "Local" | "Web" | "Feria" | "Instagram" | "Facebook" | "WhatsApp";
export type OrderChannel = SalesChannel | "Mayorista";
export type CustomerSourceChannel = SalesChannel | "Agenda" | "Sorteo" | "Suscripción" | "Suscripción con desc.";
export type Product = {
  id: string;
  sourceProductId?: string;
  searchText?: string;
  wholesaleProductId?: string;
  priceArg?: number;
  basePrice?: number;
  imageUrl?: string;
  imageCrop?: { x: number; y: number; zoom: number };
  weightGrams?: number;
  active?: boolean;
  availableChannels?: Channel[];
  wholesaleThreshold?: number;
  name: string;
  sku: string;
  categoryCode?: string;
  personalizationType?: "mate" | "matera";
  catalogType?: string;
  family: string;
  variant: string;
  options?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  rim: string;
  leather: string;
  cost: number;
  prices: Record<Channel, number>;
  stock: number;
  min: number;
  published: boolean;
};
export type Customer = {
  id: string;
  localCustomerId?: string;
  wholesaleName?: string;
  companyName?: string;
  address?: string;
  department?: string;
  postalCode?: string;
  firstPurchaseDate?: string;
  lastPurchaseDate?: string;
  notes?: string;
  sourceChannels?: CustomerSourceChannel[];
  originChannel?: CustomerSourceChannel;
  createdAt?: string;
  webLeadKind?: "account" | "newsletter";
  webLeadId?: string;
  agendaInferredCategory?: string;
  agendaAdditionalPhones?: string[];
  raffleEntryId?: string;
  raffleProductInterest?: string;
  name: string;
  email: string;
  phone: string;
  birthDate?: string;
  city: string;
  country?: string;
  segment: string;
};
export type OrderLine = {
  id: string; productId: string; title: string; sku: string; quantity: number;
  productName?: string; options?: Record<string, unknown>;
  weightGrams?: number;
  personalization?: Record<string, unknown>;
  productionNotes?: string;
  unitPrice: number; amount: number; family: string; variant: string; rim: string; leather: string;
  productionStatus: string; reviewStatus: string | null;
  wholesaleLineId?: string; orderType?: string; priceArg?: number;
  createdAt?: string | null; completedAt?: string | null;
};
export type Order = {
  id: string;
  source?: "local" | "wholesale";
  customerName?: string;
  localItemsAmount?: number;
  paymentMethod?: string;
  number?: number;
  referenceCode?: string | null;
  status?: string;
  paidAt?: string | null;
  totalAmount?: number;
  paymentAmountUsd?: number;
  shippingAmount?: number;
  discountAmount?: number;
  feeAmount?: number;
  items?: OrderLine[];
  customerId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  channel: OrderChannel;
  date: string;
  due: string;
  production: "Pendiente" | "En producción" | "Terminado" | "No aplica";
  delivery: "Pendiente" | "Enviado" | "Entregado" | "No aplica";
  method: "Envío" | "Retiro" | "No aplica";
  design: boolean;
  approved: boolean;
  carrier?: string;
  tracking?: string;
};
export type Payment = {
  id: string;
  orderId: string;
  /** Historical equivalent in UYU; null means it still needs reconciliation. */
  amount: number | null;
  sourceCurrency?: string;
  sourceAmount?: number;
  reconciliationRequired?: boolean;
  date: string;
  method: string;
  derived?: boolean;
};
export type Expense = {
  id: string;
  name: string;
  amount: number;
  date: string;
  paid: boolean;
  category: string;
};
export type Employee = {
  id: string;
  name: string;
  role: string;
  manager: string;
};
export type Row = Record<string, string | number | boolean> & { id: string };
export type State = {
  source?: "commerce";
  version: 1;
  orgSeeded?: boolean;
  accessSeeded?: boolean;
  accessPolicyVersion?: number;
  historySeeded?: boolean;
  expenseHistorySeeded?: boolean;
  user: string;
  activeUserId?: string;
  access?: Record<string, string[]>;
  products: Product[];
  customers: Customer[];
  orders: Order[];
  payments: Payment[];
  expenses: Expense[];
  /** true cuando los egresos salen de Compras y Gastos fijos y el usuario tiene permiso para leerlos. */
  expensesConnected?: boolean;
  expensesSkipped?: number;
  employees: Employee[];
  hours: Row[];
  records: Record<string, Row[]>;
  draft: Record<string, number>;
  published: Record<string, number>;
  activity: Row[];
};
export const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const money = (n: number) =>
  new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
export const usdMoney = (n: number) => `USD ${n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const paymentMoney = (p: Payment) => {
  const original = p.sourceCurrency && p.sourceCurrency !== "UYU" ? `${p.sourceCurrency} ${(p.sourceAmount ?? 0).toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ` : "";
  return `${original}${p.amount == null ? "Equivalente UYU pendiente de conciliación" : `${money(p.amount)} UYU`}${p.reconciliationRequired && p.amount != null ? " · Revisar conciliación" : ""}`;
};
export const id = () => crypto.randomUUID();
export const total = (o: Order) => o.totalAmount ?? o.quantity * o.unitPrice;
export const orderName = (o: Order) => o.referenceCode ||
  (o.source === "wholesale" ? `Línea ${o.items?.[0]?.wholesaleLineId || o.id}` :
  (o.source === "local" ? `Local #${String(o.number ?? "").padStart(5, "0")}` : o.number ? `#${o.number}` : o.id));
export const isSale = (o: Order) => !o.status || !["pending_payment", "payment_verification_pending", "payment_failed", "cancelled", "refunded"].includes(o.status);
export const orgEmployees: Employee[] = [
  { id: "t1", name: "Richard Ortiz", role: "Director General · CEO", manager: "" },
  { id: "t2", name: "Florencia Costa", role: "Comercial · Local y ventas", manager: "t1" },
  { id: "t3", name: "Florencia Pizzorno", role: "Coordinadora de Operaciones", manager: "t1" },
  { id: "t4", name: "Nicolás", role: "Encargado de Producción", manager: "t1" },
  { id: "t5", name: "Betiana", role: "Marketing", manager: "t1" },
  { id: "t6", name: "Rovert", role: "Armado de mates", manager: "t4" },
  { id: "t7", name: "Julio", role: "Armado de bocas personalizadas", manager: "t4" },
];
export const paid = (s: State, o: Order) =>
  s.payments
    .filter((p) => p.orderId === o.id)
    .reduce((a, p) => a + (p.amount ?? 0), 0);
export const balance = (s: State, o: Order) =>
  o.paidAt || ["cancelled", "refunded", "payment_failed"].includes(o.status || "") ? 0 : Math.max(0, total(o) - paid(s, o));
export function seed(): State {
  return {
    version: 1, source: "commerce", user: "Richard Ortiz", activeUserId: "t1",
    access: defaultAccess(), products: [], customers: [], orders: [], payments: [],
    expenses: [], employees: orgEmployees.map((employee) => ({ ...employee })),
    hours: [], records: {}, draft: {}, published: {}, activity: [],
  };
}
export function addOrder(
  s: State,
  input: Omit<Order, "id">,
  initialPayment: number,
): State {
  if (
    !s.customers.some((c) => c.id === input.customerId) ||
    !s.products.some((p) => p.id === input.productId) ||
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    !Number.isFinite(input.unitPrice) ||
    input.unitPrice <= 0
  )
    throw Error("Revisá cliente, producto, cantidad y precio.");
  const o = {
    ...input,
    id: `MA-${Math.max(1052, ...s.orders.map((o) => Number(o.id.replace("MA-", "")) || 0)) + 1}`,
  };
  if (
    !Number.isFinite(initialPayment) ||
    initialPayment < 0 ||
    initialPayment > total(o)
  )
    throw Error("El cobro debe estar entre cero y el total.");
  return {
    ...s,
    orders: [o, ...s.orders],
    payments: initialPayment
      ? [
          {
            id: id(),
            orderId: o.id,
            amount: initialPayment,
            date: input.date,
            method: "Transferencia",
          },
          ...s.payments,
        ]
      : s.payments,
  };
}
export function publishPrices(s: State): State {
  if (
    Object.values(s.draft).some((v) => !Number.isFinite(v) || v < 0) ||
    s.draft["Comisión (%)"] > 100
  )
    throw Error("Revisá los precios y el porcentaje.");
  return { ...s, published: { ...s.draft } };
}
export const storageKey = "matearte-gestion-preferences-v2";
export function loadState(): State {
  // Retirar únicamente datos del prototipo. La sesión de comercio se conserva.
  try {
    for (const key of ["matearte-gestion-demo-v1", "matearte-finance-opening-v1"]) localStorage.removeItem(key);
    const preferences = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const stored = preferences.access as Record<string, unknown> | undefined;
    const access = Object.fromEntries(Object.entries(defaultAccess()).map(([userId, defaults]) => {
      const saved = stored?.[userId];
      if (!Array.isArray(saved)) return [userId, defaults];
      const updated = saved.flatMap((path) => path === "/comercial/registrar"
        ? userId === "t3" ? ["/comercial/registrar-may"] : ["/comercial/registrar-min"]
        : [path === "/productos/precios" ? "/productos/ajustes" : path === "/produccion/configurador-visualizador" ? "/productos/personalizador" : path])
        .filter((path): path is string => typeof path === "string" && paths.some((item) => item === path));
      return [userId, [...new Set(updated)]];
    }));
    return { ...seed(), access };
  } catch { return seed(); }
}
