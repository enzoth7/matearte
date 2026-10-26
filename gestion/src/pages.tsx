import { paymentMoney, usdMoney } from "./data";
import { CustomerContactEditor } from "./commerce/CustomerContactEditor";
import { LocalCustomerEditor } from "./LocalCustomerEditor";
import { RuralRaffleCustomerEditor } from "./RuralRaffleCustomerEditor";
import { LocalSaleRegister } from "./LocalSaleRegister";
import { WholesaleRegister, WholesaleCustomerEditor, WholesaleProduction, WholesaleSummary } from "./WholesaleScreens";
import { exportWholesalePdf } from "./wholesaleExports";
import { exportWholesaleOrderPdf, type WholesaleOrderPdfKind } from "./wholesaleOrderPdf";
import { summarizeWholesaleCustomer } from "./wholesaleAdapter";
import { customerPurchaseDates, latestCustomerPurchase } from "./customerPurchase";
import { callMarketing } from "./marketingApi";
import { topRetailProducts, topViewedProducts, type ProductView, type RankingItem } from "./overviewRankings";
import { customerDisplayChannel, customerOriginLabel, customerOriginOptions } from "./customerChannel";
import { joinCustomerPhone, splitCustomerPhone } from "./customerPhone";
import { OrderContactPhone } from "./OrderContactPhone";
import { exportCustomersXlsx } from "./customerExports";
import { compactOrderItemName, orderItemColor, orderItemDetailRows } from "./orderItemPresentation";
import { orderCategoryLabels, orderShippingStatus } from "./orderListPresentation";
import type { OrderDetailRow } from "./OrderDetailItems";
import { OrderDetailContent, type OrderDetailView } from "./OrderDetailContent";
import { PersonalizedOrders } from "./commerce/PersonalizedOrdersView";
import { naturalCaseName, workshopOrderRows } from "./productionPresentation";
import type { Session } from "@supabase/supabase-js";
import { Orders as CommerceOrderDetails, formatWeight } from "./commerce/Operations";
import type { CommerceSnapshot } from "./commerceAdapter";
import { ChartTooltip } from "./ui";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Package, Plus, PencilSimple, CaretDown, FileXls, FunnelX, MagnifyingGlass, Trash } from "@phosphor-icons/react";
import { LocalSaleEditor, canEditLocalSale, deleteLocalSale } from "./LocalSaleEditor";
import { LocalSaleReceiptForm } from "./LocalSaleReceiptForm";
import {
  type State,
  type Order,
  type OrderLine,
  type Product,
  type Row,
  type Customer,
  type OrderChannel,
  orderName,
  isSale,
  money,
  total,
  paid,
  balance,
  id,
  addOrder,
  publishPrices,
} from "./data";
import { areas } from "./navigation";
import { collections, type Field } from "./collections";
import { overviewPeriods, overviewScope, salesByCustomerType, type OverviewPeriod } from "./overview";
import { accessUserId, allowedSalesChannels, canAccess, firstRegistrationPath, visibleCustomers, visibleOrders } from "./access";
import { countryDisplayName, countryForCity, countryOptions, LocationLabel } from "./location";
import {
  Card,
  Stats,
  Table,
  Badge,
  Modal,
  Form,
  AddButton,
  Export,
} from "./ui";
import { formatDate, formatDateTime } from "./dateFormat";
export type PageProps = {
  session?: Session | null;
  refresh?: (forceFullCustomers?: boolean) => Promise<void>;
  commerce?: CommerceSnapshot | null;
  s: State;
  update: (recipe: (s: State) => State, message: string) => void;
  go: (path: string) => void;
  notify: (message: string) => void;
};
const customer = (s: State, o: Order) =>
  s.customers.find((c) => c.id === o.customerId) ?? { name: o.customerName || "Cliente sin nombre" };
const product = (s: State, o: Order) =>
  s.products.find((p) => p.id === o.productId) ?? { name: o.items?.[0]?.title || "Artículo sin nombre", family: o.items?.[0]?.family || "Sin categoría", variant: "", rim: "Sin especificar", leather: "Sin especificar" };
const orderDate = (date: string) => formatDate(date);
const customerSearchText = (customer: Customer) => `${customer.name} ${customer.companyName || ""} ${customer.email} ${customer.phone} ${(customer.agendaAdditionalPhones || []).join(" ")} ${customer.birthDate || ""} ${customer.city} ${customer.country || countryForCity(customer.city)}`;
const paymentStatus = (s: State, o: Order) =>
  o.status === "cancelled" ? "Cancelado" : o.status === "refunded" ? "Reembolsado" : o.status === "payment_failed" ? "Pago fallido" : o.status === "payment_verification_pending" ? "Comprobante por verificar" : balance(s, o) === 0
    ? "Pagado"
    : paid(s, o) > 0
      ? "Pago parcial"
      : "Pendiente";
function OverviewRanking({ rows, empty }: { rows: RankingItem[]; empty: string }) {
  const max = rows[0]?.count || 1;
  return rows.length ? <ol className="overview-ranking">
    {rows.map(({ name, count }) => <li key={name} title={name}>
      <div className="overview-ranking-heading"><span>{name}</span><strong>{count.toLocaleString("es-UY")}</strong></div>
      <div className="overview-ranking-track" aria-hidden="true"><span style={{ width: `${count / max * 100}%` }} /></div>
    </li>)}
  </ol> : <p className="overview-ranking-empty">{empty}</p>;
}
export function Overview({ s, go }: PageProps) {
  const registrationPath = firstRegistrationPath(s);
  const [period, setPeriod] = useState<OverviewPeriod>(() => {
    try {
      const saved = localStorage.getItem("matearte-overview-period");
      return overviewPeriods.some(([value]) => value === saved) ? saved as OverviewPeriod : "14d";
    } catch {
      return "14d";
    }
  });
  const canSeeFinance = canAccess(s, "/finanzas/resumen");
  const hasExpenses = s.source !== "commerce" || Boolean(s.expensesConnected);
  const canSeeProduction = canAccess(s, "/produccion/resumen");
  const canSeeAnalytics = canAccess(s, "/marketing/analytics");
  const [productViews, setProductViews] = useState<ProductView[] | null>(null);
  const [productViewsError, setProductViewsError] = useState("");
  const { orders, expenses, trend, start, end } = overviewScope({
    ...s,
    orders: visibleOrders(s),
    expenses: canSeeFinance ? s.expenses : [],
  }, period);
  const periodLabel = overviewPeriods.find(([value]) => value === period)?.[1] || "Período seleccionado";
  useEffect(() => {
    if (!canSeeAnalytics) return;
    let active = true;
    setProductViews(null);
    setProductViewsError("");
    void callMarketing<{ products: ProductView[] }>("analytics", { site: "tienda", startDate: start, endDate: end, productsOnly: true })
      .then(result => { if (active) setProductViews(result.products || []); })
      .catch(reason => { if (active) setProductViewsError((reason as Error).message); });
    return () => { active = false; };
  }, [canSeeAnalytics, start, end]);
  const sales = orders.reduce((a, o) => a + total(o), 0);
  const expensesPaid = expenses
    .filter((expense) => expense.paid)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const productionOrders = canSeeProduction
    ? visibleOrders(s, true).filter((order) => order.source !== "local" && isSale(order) && order.date >= start && order.date <= end)
    : [];
  const pending = productionOrders.filter((o) => o.production !== "Terminado");
  const customerTypeData = salesByCustomerType(s, orders);
  const customerTypeTotal = customerTypeData.reduce((sum, item) => sum + item.total, 0);
  const channelData = (canSeeFinance ? (["Web", "Mayorista", "Local", "Feria", "Instagram", "Facebook", "WhatsApp"] as OrderChannel[]) : allowedSalesChannels(s)).map(
    (name) => ({
      name,
      total: orders
        .filter((o) => o.channel === name)
        .reduce((a, o) => a + total(o), 0),
    }),
  );
  const channelColors: Record<OrderChannel, string> = { Web: "#236b91", Mayorista: "#4d7a57", Local: "#794c32", Feria: "#936735", Instagram: "#d83280", Facebook: "#2459a6", WhatsApp: "#28b765" };
  const channelMax = Math.max(1, ...channelData.map(channel => channel.total));
  const retailRanking = topRetailProducts(orders, s.customers, s.products);
  const viewedRanking = topViewedProducts(productViews || []);
  return (
    <>
      <div className="welcome">
        <div>
          
          <h1>Buen día, {s.user.split(" ")[0]}.</h1>
          
        </div>
        <div className="welcome-actions">
          <select
            className="period-filter"
            aria-label="Período del resumen"
            value={period}
            onChange={(event) => {
              const next = event.target.value as OverviewPeriod;
              setPeriod(next);
              setProductViews(null);
              setProductViewsError("");
              try { localStorage.setItem("matearte-overview-period", next); } catch {}
            }}
          >
            {overviewPeriods.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {registrationPath && <button
            className="secondary"
            onClick={() => go(registrationPath)}
          >
            <Plus />
            Registrar venta
          </button>}
        </div>
      </div>
      <Stats
        layout="hero"
        items={[
          {
            label: "Ventas del per\u00EDodo",
            value: money(sales),
            tone: "green",
            solid: true,
            note: `${orders.length} pedidos en el período`,
            go: () => go("/comercial/pedidos"),
          },
          ...(canSeeFinance ? [{
            label: "Egresos pagados",
            value: hasExpenses ? money(expensesPaid) : "—",
            tone: "red" as const,
            solid: true,
            go: () => go("/finanzas/egresos"),
          }, {
            label: "Ganancia",
            value: hasExpenses ? money(sales - expensesPaid) : "—",
            tone: "yellow" as const,
            note: "Ventas registradas menos egresos pagados en el período",
            go: () => go("/finanzas/resumen"),
          }] : []),
          {
            label: "Artículos vendidos",
            value: orders.reduce((count, order) => count + order.quantity, 0),
            tone: "brown",
            note: "Cantidad de unidades vendidas en el período",
            go: () => go("/comercial/pedidos"),
          },
        ]}
      />
      {s.source === "commerce" && <small className="data-note">Ventas web, mayoristas y del local. Egresos pendientes de conectar.</small>}
      <div className="overview-grid">
        <Card
          title={canSeeFinance && hasExpenses ? "Ventas y egresos" : "Ventas"}
          action={
            <div className="chart-legend">
              <div>Ventas</div>
              {canSeeFinance && hasExpenses && <div>Egresos</div>}
            </div>
          }
        >
          <div
            className="chart"
            role="img"
            aria-label={canSeeFinance && hasExpenses ? `Ventas ${money(sales)} y egresos pagados ${money(expensesPaid)}` : `Ventas ${money(sales)}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trend}
                margin={{ top: 15, right: 15, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f7d55" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#2f7d55" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="#171412"
                  strokeOpacity={0.08}
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  interval={period === "7d" || period === "6m" ? 0 : period === "14d" || period === "3m" ? 1 : 4}
                />
                <YAxis
                  tickFormatter={(v) => `${v / 1000}k`}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  isAnimationActive={false}
                  name="Ventas"
                  dataKey="ventas"
                  stroke="#2f7d55"
                  fill="url(#sales)"
                  strokeWidth={2.5}
                />
                {canSeeFinance && hasExpenses && <Area
                  isAnimationActive={false}
                  name="Egresos"
                  dataKey="egresos"
                  stroke="#b34136"
                  fill="transparent"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Ventas por canal">
          <div className="channel-summary" aria-label="Importes por canal">
            {channelData.map(channel => <div className="channel-summary-row" key={channel.name}>
              <div className="channel-summary-heading"><span style={{ color: channelColors[channel.name] }}>{channel.name}</span><strong>{money(channel.total)}</strong></div>
              <div className="channel-summary-track" aria-hidden="true"><span style={{ width: `${channel.total / channelMax * 100}%`, backgroundColor: channelColors[channel.name] }} /></div>
            </div>)}
          </div>
        </Card>
      </div>
      <div className="overview-rankings-grid">
        <Card title="Productos más vendidos minorista">
          <small className="overview-ranking-note">Unidades vendidas en el período seleccionado</small>
          <OverviewRanking rows={retailRanking} empty="Sin ventas minoristas en este período." />
        </Card>
        <Card title="Productos más vistos">
          <small className="overview-ranking-note">Visitantes de la tienda web · {periodLabel.toLocaleLowerCase("es-UY")}</small>
          {canSeeAnalytics ? productViewsError
            ? <p className="overview-ranking-empty" role="alert">{productViewsError}</p>
            : productViews === null ? <p className="overview-ranking-empty" role="status">Cargando Analytics…</p>
              : <OverviewRanking rows={viewedRanking} empty="Sin vistas de productos en el período seleccionado." />
            : <p className="overview-ranking-empty">Sin acceso a Analytics.</p>}
        </Card>
      </div>
      <div className={`overview-bottom ${canSeeProduction ? "" : "overview-bottom-single"}`}>
        <Card
          title="Ventas por tipo de cliente"
          action={canAccess(s, "/comercial/pedidos") ? <button className="text-button" onClick={() => go("/comercial/pedidos")}>Ver ventas</button> : undefined}
        >
          <div className="customer-type-sales" aria-label="Comparación de ventas minoristas y mayoristas">
            {customerTypeData.map(item => {
              const share = customerTypeTotal > 0 ? Math.round(item.total / customerTypeTotal * 100) : 0;
              return <div className={`customer-type-sale customer-type-${item.type.toLowerCase()}`} key={item.type}>
                <div className="customer-type-sale-heading">
                  <div><strong>{item.type}</strong><small>{item.orders} {item.orders === 1 ? "venta" : "ventas"} · {share}% del total</small></div>
                  <b>{money(item.total)}</b>
                </div>
                <div className="customer-type-track" aria-hidden="true"><span style={{ width: `${share}%` }} /></div>
              </div>;
            })}
          </div>
        </Card>
        {canSeeProduction && <section className="dark-card workshop-card">
          <div className="workshop-heading">
            <h2>El taller</h2>
            <Package size={24} />
          </div>
          <div className="workshop-total">
            {pending.reduce((a, o) => a + o.quantity, 0)}
            <small>unidades pendientes</small>
          </div>
          {["Pendiente", "En producción", "Terminado"].map((status) => {
            const units = productionOrders
              .filter((o) => o.production === status)
              .reduce((a, o) => a + o.quantity, 0);
            return (
              <div className="workshop-line" key={status}>
                <div>{status}</div>
                <strong>{units}</strong>
                <progress
                  aria-label={status}
                  max={Math.max(
                    1,
                    productionOrders.reduce((a, o) => a + o.quantity, 0),
                  )}
                  value={units}
                />
              </div>
            );
          })}
          <button onClick={() => go("/produccion/resumen")}>
            Ver producción
          </button>
        </section>}
      </div>
      <OrderTable
        s={s}
        orders={[...orders]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 5)}
        go={go}
        title="Últimos pedidos"
      />
    </>
  );
}
function OrderTable({
  s,
  orders,
  go,
  title,
  open,
  mode = "pedidos",
  showAmounts = true,
  searchQuery,
  onSearchQueryChange,
  onCustomer,
}: {
  s: State;
  orders: Order[];
  go: PageProps["go"];
  title?: string;
  open?: (o: Order) => void;
  mode?: string;
  showAmounts?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onCustomer?: (order: Order) => void;
}) {
  const productionMode = ["mayorista", "mayorista-web", "minorista", "historico", "resumen-produccion"].includes(mode);
  const originByOrder = useMemo(() => {
    if (mode !== "pedidos") return new Map<string, string>();
    const ordersByCustomer = new Map<string, Order[]>();
    for (const order of s.orders) ordersByCustomer.set(order.customerId, [...(ordersByCustomer.get(order.customerId) || []), order]);
    const customerById = new Map(s.customers.map((entry) => [entry.id, entry]));
    return new Map(orders.map((order) => {
      const entry = customerById.get(order.customerId);
      return [order.id, entry ? customerDisplayChannel(entry, ordersByCustomer.get(entry.id) || []) || "" : ""];
    }));
  }, [mode, orders, s.orders, s.customers]);
  const itemSearchText = (item: OrderLine) => [
    compactOrderItemName(item),
    item.title,
    ...orderItemDetailRows(item).flatMap((detail) => [detail.label, detail.value]),
  ].join(" ");
  return (
    <Table
      className={mode === "pedidos" ? "sales-orders-table" : productionMode || ["pendientes", "envios"].includes(mode) ? `workshop-orders-table${productionMode ? " workshop-orders-table--company" : ""}${showAmounts ? "" : " workshop-orders-table--no-amounts"}${["pendientes", "envios"].includes(mode) ? " logistics-orders-table" : ""}` : undefined}
      showSearch={searchQuery === undefined}
      searchQuery={searchQuery}
      onSearchQueryChange={onSearchQueryChange}
      title={title}
      rows={orders}
      searchText={(o) =>
        `${orderName(o)} ${customer(s, o).name} ${customerOriginLabel(originByOrder.get(o.id) || "")} ${o.items?.map(itemSearchText).join(" ") || product(s, o).name} ${o.channel}`
      }
      columns={[
        { label: "Pedido", render: (o) => mode === "pedidos" ? orderName(o) : <strong>{orderName(o)}</strong> },
        { label: "Fecha", render: (o) => orderDate(o.date) },
        {
          label: "Cliente",
          render: (o) => mode === "pedidos"
            ? onCustomer ? <button type="button" className="text-button" aria-label={`Ver ficha de ${customer(s, o).name}`} onClick={() => onCustomer(o)}>{customer(s, o).name}</button> : customer(s, o).name
            : <strong>{productionMode ? naturalCaseName(customer(s, o).name) : customer(s, o).name}</strong>,
        },
        ...(productionMode ? [{ label: "Empresa", render: (o: Order) => { const c = customer(s, o); return ("companyName" in c && c.companyName?.trim()) || "—"; } }] : []),
        { label: "Productos", render: (o) => orderCategoryLabels(o, s.products) },
        ...(mode === "pedidos" ? [{ label: "Origen", render: (o: Order) => { const origin = originByOrder.get(o.id); return origin ? <Badge>{customerOriginLabel(origin)}</Badge> : "—"; } }] : []),
        { label: "Canal", render: (o) => <Badge>{o.channel}</Badge> },
        ...(showAmounts ? [
          { label: "Importe", render: (o: Order) => <strong>{money(o.source === "local" && o.depositAmount != null ? paid(s, o) : total(o))}{o.paymentAmountUsd != null && <small> · {usdMoney(o.paymentAmountUsd)}</small>}</strong> },
          { label: "Pago", render: (o: Order) => <Badge>{paymentStatus(s, o)}</Badge> },
        ] : []),
        {
          label: "Producci\u00F3n",
          render: (o) => <Badge>{o.production}</Badge>,
        },
        {
          label: "Envío",
          render: (o) => o.source === "local" ? "—" : <Badge>{orderShippingStatus(o)}</Badge>,
        },
        ...(["pendientes", "retiros", "envios"].includes(mode)
          ? [
              {
                label: "Modalidad / seguimiento",
                render: (o: Order) => (
                  <div>
                    {o.method}
                    <small>
                      {o.carrier || "Sin transportista"} ·{" "}
                      {o.tracking || "Sin c\u00F3digo"}
                    </small>
                  </div>
                ),
              },
            ]
          : mode === "por-cobrar"
            ? [
                {
                  label: "Saldo por cobrar",
                  render: (o: Order) => <strong>{money(balance(s, o))}</strong>,
                },
              ]
          : []),
        {
          label: "Detalles",
          render: (o) => (
            <button
              type="button"
              className="secondary order-details-button"
              aria-label={`Ver detalle del pedido ${orderName(o)}`}
              title="Ver detalle"
              onClick={() => open ? open(o) : go(`/comercial/pedidos?pedido=${o.id}`)}
            >
              <Plus size={18} weight="bold" aria-hidden="true" />
            </button>
          ),
        },
      ]}
    />
  );
}

function UnifiedOrderDetailModal({ order, props, showAmounts, onClose }: { order: Order; props: PageProps; showAmounts: boolean; onClose: () => void }) {
  const { s, go } = props;
  const [editingSale, setEditingSale] = useState(false);
  const [recordingReceipt, setRecordingReceipt] = useState(false);
  const [saleBusy, setSaleBusy] = useState(false);
  const [saleError, setSaleError] = useState("");
  const items = order.items || [];
  const localDeposit = order.source === "local" && order.depositAmount != null;
  const orderPayments = s.payments.filter((payment) => payment.orderId === order.id);
  const localPaymentMethods = [...new Set([order.paymentMethod, ...orderPayments.map((payment) => payment.method)]
    .filter((method): method is string => Boolean(method && method !== "Seña")))].join(" · ") || "No registrado";
  const shipping = orderShippingStatus(order);
  const contact = s.customers.find((entry) => entry.id === order.customerId);
  const phone = contact?.phone?.trim() || "";
  const country = contact?.country || (contact?.city ? countryForCity(contact.city) : "") || (/^0?9\d{7}$/.test(phone.replace(/\D/g, "")) ? "Uruguay" : "");
  const phoneParts = splitCustomerPhone(phone, country);
  const whatsappDigits = phoneParts.prefix ? joinCustomerPhone(phoneParts.prefix, phoneParts.number).replace(/\D/g, "") : "";
  const wholesaleLines = order.source === "wholesale"
    ? props.commerce?.wholesale?.lines.filter((line) => items.some((item) => item.wholesaleLineId === line.line_id)) || []
    : [];
  const downloadWholesalePdf = (kind: WholesaleOrderPdfKind) => {
    const snapshot = props.commerce?.wholesale;
    if (!snapshot) return;
    void exportWholesaleOrderPdf(kind, {
      reference: orderName(order), date: order.date,
      customerName: contact?.name || order.customerName || wholesaleLines[0]?.customer || "Cliente sin nombre",
      customer: contact, items, lines: wholesaleLines, snapshot, currency: "ARS",
    }).catch((failure) => props.notify?.(failure instanceof Error ? failure.message : "No se pudo generar el PDF."));
  };
  const detailRows: OrderDetailRow[] = items.length ? items.map((item) => {
    const details = orderItemDetailRows(item);
    const size = details.find((detail) => ["tamaño", "tamano", "talle"].includes(detail.label.toLocaleLowerCase("es")))?.value;
    const extra = details.filter((detail) => !["sku", "color", "variante", "tamaño", "tamano", "talle"].includes(detail.label.toLocaleLowerCase("es")));
    const catalogProduct = s.products.find((entry) => entry.id === item.productId && !entry.wholesaleProductId);
    const wholesaleItem = order.source === "wholesale";
    return {
      id: item.id,
      name: compactOrderItemName(item), sku: item.sku, color: orderItemColor(item) || (wholesaleItem ? item.variant : undefined), size,
      onOpen: catalogProduct ? () => go(`/productos/catalogo?producto=${encodeURIComponent(catalogProduct.sourceProductId || catalogProduct.id)}&variante=${encodeURIComponent(catalogProduct.id)}`) : undefined,
      weight: item.weightGrams && item.weightGrams > 0 ? formatWeight(item.weightGrams) : undefined,
      quantity: item.quantity, amount: showAmounts ? money(item.amount) : undefined,
      extra: wholesaleItem ? "" : extra.map((detail) => `${detail.label}: ${detail.value}`).join(" · "), notes: item.productionNotes,
    };
  }) : [{ id: order.id, name: product(s, order).name, quantity: order.quantity, amount: showAmounts ? money(total(order)) : undefined }];
  const detail: OrderDetailView = {
    reference: orderName(order), date: orderDate(order.date), channel: order.channel, shipping,
    customer: naturalCaseName(customer(s, order).name), products: orderCategoryLabels(order, s.products),
    payment: showAmounts ? paymentStatus(s, order) : undefined,
    paymentNote: showAmounts ? `${localDeposit ? "Saldo de la seña" : "Saldo pendiente"}: ${money(balance(s, order))}` : undefined,
    production: order.production, rows: detailRows,
    delivery: {
      method: order.method === "Envío" ? "Envío" : order.method === "Retiro" ? "Retiro en el local" : "Venta en el local",
      paymentMethod: localPaymentMethods,
      customer: naturalCaseName(contact?.name || order.customerName || "Cliente sin nombre"),
      phone: phone ? <OrderContactPhone prefix={phoneParts.prefix} number={phoneParts.number} country={country} whatsappDigits={whatsappDigits} /> : undefined,
      email: contact?.email,
      address: contact?.address,
      locality: [contact?.city, contact?.department].filter(Boolean).join(", "),
      country, pickup: order.method !== "Envío",
    },
    totals: showAmounts ? <>
      {(!!order.discountAmount || !!order.shippingAmount || !!order.feeAmount) && <div className="line-item"><div>Subtotal</div><strong>{money(items.length ? items.reduce((sum, item) => sum + item.amount, 0) : total(order))}</strong></div>}
      {!!order.discountAmount && <div className="line-item"><div>Descuento</div><strong>{money(-order.discountAmount)}</strong></div>}
      {!!order.shippingAmount && <div className="line-item"><div>Envío</div><strong>{money(order.shippingAmount)}</strong></div>}
      {!!order.feeAmount && <div className="line-item"><div>Cargo por pago</div><strong>{money(order.feeAmount)}</strong></div>}
      {localDeposit ? <>
        <div className="line-item"><div>Valor de artículos</div><strong>{money(total(order))}</strong></div>
        {orderPayments.map((payment, index) => <div className="line-item" key={payment.id}><div>{index === 0 ? "Seña" : "Cobro"} · {payment.method} · {orderDate(payment.date)}</div><strong>{money(payment.amount || 0)}</strong></div>)}
        <div className="line-item"><div>Saldo pendiente</div><strong>{money(balance(s, order))}</strong></div>
        <div className="line-item"><div>Cobrado hasta ahora</div><strong>{money(paid(s, order))}</strong></div>
      </> : <>
        <div className="line-item"><div>Total</div><strong>{money(total(order))}</strong></div>
        {orderPayments.filter((payment) => payment.sourceCurrency === "USD").map((payment) => <div className="line-item" key={payment.id}><div>Cobro PayPal</div><strong>{paymentMoney(payment)}</strong></div>)}
      </>}
    </> : undefined,
    tracking: order.method === "Envío" && (order.carrier || order.tracking) ? { carrier: order.carrier || "", code: order.tracking || "" } : undefined,
  };
  return <Modal title="Detalle del pedido" className="order-detail-modal unified-order-modal" onClose={onClose}>
    <OrderDetailContent detail={detail} />
    {saleError && <div className="error" role="alert">{saleError}</div>}
    <div className="form-actions unified-order-actions">
      {canEditLocalSale(order) && <div className="unified-order-sale-tools">
        <button type="button" className="unified-order-icon-action" aria-label="Editar esta venta" title="Editar venta" disabled={saleBusy} onClick={() => setEditingSale(true)}><PencilSimple size={20} aria-hidden="true" /></button>
        <button type="button" className="unified-order-icon-action unified-order-icon-action--danger" aria-label="Eliminar esta venta" title="Eliminar venta" disabled={saleBusy} onClick={() => void (async () => {
          setSaleBusy(true); setSaleError("");
          const result = await deleteLocalSale(order);
          if (result === null) { setSaleBusy(false); return; }
          if (result) { setSaleError(result); setSaleBusy(false); return; }
          await props.refresh?.(true); props.notify?.("Venta eliminada"); setSaleBusy(false); onClose();
        })()}><Trash size={20} aria-hidden="true" /></button>
      </div>}
      {canEditLocalSale(order) && balance(s, order) > 0 && <button type="button" className="unified-order-action unified-order-action--primary" onClick={() => setRecordingReceipt(true)}>Registrar cobro</button>}
      <button className="unified-order-action" onClick={onClose}>Cerrar</button>
      {s.customers.some((entry) => entry.id === order.customerId) && <button className="unified-order-action" onClick={() => go(`/clientes/base?cliente=${order.customerId}`)}>Ver ficha del cliente</button>}
      {order.source === "wholesale" && wholesaleLines.length > 0 && props.commerce?.wholesale && <><button className="unified-order-action" onClick={() => downloadWholesalePdf("workshop")}>Descargar PDF Taller</button><button className="unified-order-action" onClick={() => downloadWholesalePdf("customer")}>Descargar PDF Cliente</button></>}
      {order.source === "wholesale" && <button className="unified-order-action unified-order-action--primary" onClick={() => go("/produccion/mayorista")}>Gestionar producción</button>}
    </div>
    {editingSale && <LocalSaleEditor order={order} customers={s.customers} products={s.products} depositAmount={s.payments.find((payment) => payment.orderId === order.id)?.amount ?? undefined} onClose={() => setEditingSale(false)} onChanged={async (message) => { await props.refresh?.(true); props.notify?.(message); setEditingSale(false); onClose(); }} />}
    {recordingReceipt && <LocalSaleReceiptForm order={order} remaining={balance(s, order)} onClose={() => setRecordingReceipt(false)} onChanged={async () => { await props.refresh?.(true); props.notify?.("Cobro registrado en el mismo pedido"); setRecordingReceipt(false); }} />}
  </Modal>;
}

export function Orders(
  props: PageProps & {
    mode?: string;
  },
) {
  const { s, go, mode = "pedidos" } = props;
  const registrationPath = firstRegistrationPath(s);
  const [selected, setSelected] = useState<string | null>(
    new URLSearchParams(location.search).get("pedido"),
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [channel, setChannel] = useState("Todos");
  const [orderSearch, setOrderSearch] = useState("");
  const [group, setGroup] = useState("Pedidos");
  if (mode === "mayorista") return <><WholesaleProduction props={props} /><section className="wholesale-web-orders"><h2>Pedidos mayoristas de la web</h2><Orders {...props} mode="mayorista-web" /></section></>;
  if (mode === "personalizados") return <div className="commerce-tools"><PersonalizedOrders onNotice={props.notify} state={s} /></div>;
  const productionView = ["mayorista-web", "minorista", "historico", "resumen-produccion"].includes(mode);
  const showAmounts = !productionView || canAccess(s, "/finanzas/resumen");
  const visible = visibleOrders(s, productionView);
  const salesFilterChannels: OrderChannel[] = (() => {
    const base = allowedSalesChannels(s) as OrderChannel[];
    return visible.some((o) => o.channel === "Mayorista") ? [base[0], "Mayorista", ...base.slice(1)] : base;
  })();
  const availableOrders = productionView ? workshopOrderRows(visible, s.products) : visible;
  const o = availableOrders.find((x) => x.id === selected);
  let rows = availableOrders.filter(
    (o) => channel === "Todos" || o.channel === channel,
  );
  if (mode === "mayorista")
    rows = rows.filter((o) => o.source === "wholesale" && o.production !== "Terminado");
  if (mode === "mayorista-web")
    rows = rows.filter((o) => o.source !== "wholesale" && o.source !== "local" && s.customers.some((customer) => customer.id === o.customerId && customer.segment === "Mayorista") && o.production !== "Terminado");
  if (mode === "minorista")
    rows = rows.filter(
      (o) => o.source !== "wholesale" && (o.source === "local" || !s.customers.some((customer) => customer.id === o.customerId && customer.segment === "Mayorista")) && o.production !== "Terminado",
    );
  if (mode === "historico")
    rows = rows.filter((o) => o.source !== "wholesale" && o.production === "Terminado");
  if (mode === "resumen-produccion")
    rows = rows.filter((o) => o.production !== "Terminado").map((order) => {
      if (order.source !== "wholesale") return order;
      const active = (order.items || []).filter((item) => item.productionStatus !== "Completado");
      return { ...order, items: active, quantity: active.reduce((sum, item) => sum + item.quantity, 0), totalAmount: active.reduce((sum, item) => sum + item.amount, 0) };
    });
  if (mode === "pendientes")
    rows = rows.filter((o) => o.source !== "local" && isSale(o) && o.delivery === "Pendiente");
  if (mode === "retiros") rows = rows.filter((o) => o.source !== "local" && isSale(o) && o.method === "Retiro");
  if (mode === "envios") rows = rows.filter((o) => o.source !== "local" && isSale(o) && o.method === "Env\u00EDo");
  if (mode === "por-cobrar") rows = rows.filter((o) => balance(s, o) > 0);
  const groupedItems = rows.flatMap<Order & { item: OrderLine | null }>((order) => order.items?.map((item) => ({ ...order, productId: item.productId, quantity: item.quantity, item })) || [{ ...order, item: null }]);
  const groups = Object.entries(
    groupedItems.reduce(
      (acc, o) => {
        const p = o.item || product(s, o);
        const key =
          group === "Modelo"
            ? p.family
            : group === "Variante"
              ? `${p.family} · ${p.variant}`
              : group === "Virola"
                ? p.rim
                : p.leather;
        acc[key] = (acc[key] || 0) + o.quantity;
        return acc;
      },
      {} as Record<string, number>,
    ),
  ).map(([name, quantity]) => ({ id: name, name, quantity }));
  return (
    <>
      {mode === "resumen-produccion" && <WholesaleSummary props={props} />}
      <Stats
        items={[
          { label: "Pedidos en esta vista", value: rows.length },
          {
            label: "Unidades",
            value: rows.reduce((a, o) => a + o.quantity, 0),
          },
          ...(showAmounts ? [{
            label:
              mode === "por-cobrar" ? "Saldo pendiente" : "Valor de pedidos",
            value: money(
              rows.reduce(
                (a, o) =>
                  a + (mode === "por-cobrar" ? balance(s, o) : total(o)),
                0,
              ),
            ),
          }] : []),
        ]}
      />
      <div className={`toolbar${mode === "pedidos" ? " orders-page-toolbar" : ""}`}>
        <div className="tabs">
          {["Todos", ...(productionView ? ["Web", "Mayorista", "Local", "WhatsApp", "Instagram", "Facebook", "Feria"] : salesFilterChannels)].map((c) => (
            <button
              key={c}
              className={`${channel === c ? "active" : ""} ${c === "Web" ? "channel-web" : c === "Mayorista" ? "channel-mayorista" : c === "Local" ? "channel-local" : c === "Instagram" ? "channel-instagram" : c === "Facebook" ? "channel-facebook" : c === "WhatsApp" ? "channel-whatsapp" : ""}`}
              onClick={() => setChannel(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="table-actions">
          {mode === "pedidos" && <label className="search order-toolbar-search">
            <MagnifyingGlass size={18} aria-hidden="true" />
            <input type="search" aria-label="Buscar pedidos" placeholder="Buscar pedidos…" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} />
          </label>}
          <Export
            rows={rows.map((o) => ({
              pedido: orderName(o),
              fecha: orderDate(o.date),
              cliente: customer(s, o).name,
              productos: orderCategoryLabels(o, s.products),
              cantidad: o.quantity,
              ...(showAmounts ? { total: total(o), cobrado: paid(s, o), saldo: balance(s, o) } : {}),
              produccion: o.source === "local" ? "" : o.production,
              envio: o.source === "local" ? "" : orderShippingStatus(o),
            }))}
          />
          {registrationPath && <AddButton onClick={() => go(registrationPath)}>
            Nuevo pedido
          </AddButton>}
        </div>
      </div>
      {mode === "mayorista" && (
        <div className="tabs inner-tabs">
          {["Pedidos", "Modelo", "Variante", "Virola", "Cuero"].map((g) => (
            <button
              key={g}
              className={g === group ? "active" : ""}
              onClick={() => setGroup(g)}
            >
              {g}
            </button>
          ))}
        </div>
      )}
      {mode === "mayorista" && group !== "Pedidos" ? (
        <Table
          rows={groups}
          searchText={(r) => r.name}
          columns={[
            { label: group, render: (r) => r.name },
            { label: "Unidades por producir", render: (r) => r.quantity },
          ]}
        />
      ) : (
        <OrderTable
          s={s}
          orders={rows}
          go={go}
          mode={mode}
          showAmounts={showAmounts}
          searchQuery={mode === "pedidos" ? orderSearch : undefined}
          onSearchQueryChange={mode === "pedidos" ? setOrderSearch : undefined}
          title={
            mode === "pedidos"
              ? undefined
              : mode === "por-cobrar"
                  ? "Pedidos con saldo"
                  : mode === "historico"
                    ? "Trabajos terminados"
                    : ["pendientes", "retiros", "envios"].includes(mode)
                      ? "Envíos"
                      : "Trabajo del taller"
          }
          open={(o) => setSelected(o.id)}
          onCustomer={mode === "pedidos" ? (order) => {
            const entry = s.customers.find((item) => item.id === order.customerId);
            setSelectedCustomer(entry || { id: order.customerId, name: order.customerName || "Cliente sin nombre", email: "", phone: "", city: "", segment: "Minorista" });
          } : undefined}
        />
      )}
      {selectedCustomer && <CustomerDetailModal customer={selectedCustomer} s={s} go={go} commerce={props.commerce} onClose={() => setSelectedCustomer(null)} />}
      {mode === "historico" && <WholesaleProduction props={props} history />}
      {o && (o.source === "local" || o.source === "wholesale" || !props.session) && <UnifiedOrderDetailModal order={o} props={props} showAmounts={showAmounts} onClose={() => setSelected(null)} />}
      {o && o.source !== "local" && o.source !== "wholesale" && props.session && <div className="commerce-tools order-tools"><CommerceOrderDetails key={o.id} session={props.session} onNotice={props.notify} orderId={o.id} catalogProducts={s.products} paymentProvider={s.payments.find((payment) => payment.orderId === o.id)?.method} onProduct={(productId, variantId) => go(`/productos/catalogo?producto=${encodeURIComponent(productId)}&variante=${encodeURIComponent(variantId)}`)} onCustomer={() => go(`/clientes/base?cliente=${o.customerId}`)} onClose={() => { setSelected(null); void props.refresh?.(); }} /></div>}
    </>
  );
}
export function CustomerDetailModal({ customer: c, s, go, commerce, onClose }: { customer: Customer; s: State; go: PageProps["go"]; commerce?: CommerceSnapshot | null; onClose: () => void }) {
  const [historyView, setHistoryView] = useState<"products" | "orders">("products");
  const orders = visibleOrders(s);
  const customerOrders = orders.filter((order) => order.customerId === c.id);
  const wholesaleHistory = c.wholesaleName ? summarizeWholesaleCustomer(orders, c.id) : undefined;
  const purchaseDates = customerPurchaseDates(c, customerOrders);
  const birthDate = c.birthDate ? /^\d{4}$/.test(c.birthDate) ? c.birthDate : formatDate(c.birthDate) : "";
  const country = countryDisplayName(c.country || countryForCity(c.city));
  return <Modal title={c.name} className="customer-detail-modal" onClose={onClose}>
    <section className="customer-identity" aria-label="Datos del cliente">
      <h3>Datos del cliente</h3>
      <div className="customer-identity-grid">
        {([
          ["Nombre", c.name], ["Fecha de alta", formatDateTime(c.createdAt, "Sin datos")], ["Fecha de nacimiento", birthDate], ["País", country],
          ["Ciudad", c.city], ["Dirección", [c.address, c.department, c.postalCode].filter(Boolean).join(", ")],
          ["Teléfono", c.phone], ["Correo", c.email],
          ["Otros celulares", c.agendaAdditionalPhones?.join(" · ")], ["Notas", c.notes],
        ] as [string, string | undefined][]).map(([label, value]) => <div className={label === "Notas" ? "customer-identity-note" : undefined} key={label}><small>{label}</small><strong>{value?.trim() || "Sin datos"}</strong></div>)}
      </div>
    </section>
    <div className="customer-purchase-facts">
      <div><small>Primera compra</small><strong>{formatDate(purchaseDates.first, "Sin datos")}</strong></div>
      <div><small>Última compra</small><strong>{formatDate(purchaseDates.last, "Sin datos")}</strong></div>
    </div>
    <Stats items={[
      { label: "Compras", value: money(customerOrders.filter(isSale).reduce((sum, order) => sum + total(order), 0)) },
      { label: "Saldo", value: money(customerOrders.reduce((sum, order) => sum + balance(s, order), 0)) },
    ]} />
    {c.wholesaleName && wholesaleHistory && <div className="tabs inner-tabs customer-history-tabs" role="tablist" aria-label="Vista del histórico mayorista"><button role="tab" aria-selected={historyView === "products"} className={historyView === "products" ? "active" : ""} onClick={() => setHistoryView("products")}>Por tipo de mate</button><button role="tab" aria-selected={historyView === "orders"} className={historyView === "orders" ? "active" : ""} onClick={() => setHistoryView("orders")}>Por pedido</button></div>}
    {c.wholesaleName && wholesaleHistory && historyView === "products" ? <Table title="Histórico por tipo de mate" rows={wholesaleHistory.rows} searchText={(row) => row.model} columns={[
      { label: "Tipo de mate", render: (row) => row.model },
      { label: "Pedidos", render: (row) => row.orders },
      { label: "Unidades", render: (row) => row.units },
    ]} /> : <OrderTable s={s} orders={customerOrders} go={go} title="Historial compartido" />}
    {c.wholesaleName && commerce?.wholesale && <div className="form-actions"><button className="secondary" onClick={() => void exportWholesalePdf(`Historial · ${c.name}`, commerce.wholesale!.lines.filter((line) => line.customer === c.wholesaleName), commerce.wholesale!)}>PDF historial</button><button className="secondary" onClick={() => void exportWholesalePdf(`Pendientes · ${c.name}`, commerce.wholesale!.lines.filter((line) => line.customer === c.wholesaleName && line.status !== "Completado"), commerce.wholesale!)}>PDF pendientes</button></div>}
  </Modal>;
}
export function Register(props: PageProps & { kind: "minorista" | "mayorista" }) {
  return props.kind === "minorista" ? <LocalSaleRegister {...props} /> : <WholesaleRegister {...props} />;
}
export function Customers({
  refresh, notify, commerce,
  s,
  update,
  go,
  mode,
}: PageProps & {
  mode: string;
}) {
  const [edit, setEdit] = useState<Customer | "new" | null>(null);
  const requestedEditId = new URLSearchParams(location.search).get("editar");
  const handledEditId = useRef<string | null>(null);
  const [newKind, setNewKind] = useState<"local" | "wholesale">("local");
  const [selected, setSelected] = useState<string | null>(
    new URLSearchParams(location.search).get("cliente"),
  );
  const [customerSort, setCustomerSort] = useState<"latestPurchase" | "createdAt" | "name">("latestPurchase");
  const [customerSortDirection, setCustomerSortDirection] = useState<"desc" | "asc">("desc");
  const [channelFilter, setChannelFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [customerKpiFilter, setCustomerKpiFilter] = useState<"orders" | "balance" | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const customers = visibleCustomers(s);
  useEffect(() => {
    if (!requestedEditId || handledEditId.current === requestedEditId) return;
    const customer = customers.find((entry) => entry.id === requestedEditId);
    if (customer) { handledEditId.current = requestedEditId; setEdit(customer); }
  }, [requestedEditId, customers]);
  const availableCountries = useMemo(() => [...new Set(customers.map((customer) => countryDisplayName(customer.country || "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })), [customers]);
  const orders = visibleOrders(s);
  const ordersByCustomer = useMemo(() => {
    const grouped = new Map<string, Order[]>();
    for (const order of orders) grouped.set(order.customerId, [...(grouped.get(order.customerId) || []), order]);
    return grouped;
  }, [orders]);
  const purchaseByCustomer = useMemo(() => new Map(customers.map((entry) => [entry.id, latestCustomerPurchase(entry, ordersByCustomer.get(entry.id) || [], s.products)])), [customers, ordersByCustomer, s.products]);
  const availablePurchaseCategories = useMemo(() => [...new Set(customers.flatMap((entry) => {
    const purchase = purchaseByCustomer.get(entry.id);
    return purchase?.date ? purchase.category.split(",").map((category) => category.trim()).filter(Boolean) : [];
  }))].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })), [customers, purchaseByCustomer]);
  const customerTableSearchText = (entry: Customer) => `${customerSearchText(entry)} ${purchaseByCustomer.get(entry.id)?.category || ""}`;
  const channelByCustomer = useMemo(() => new Map(customers.map((customer) => [
    customer.id, customerDisplayChannel(customer, ordersByCustomer.get(customer.id) || []),
  ])), [customers, ordersByCustomer]);
  const c = customers.find((c) => c.id === selected);
  const customerMetrics = useMemo(() => new Map<string, ReturnType<typeof summarizeWholesaleCustomer>>(customers.map((entry) => {
    if (entry.wholesaleName) return [entry.id, summarizeWholesaleCustomer(orders, entry.id)];
    const customerOrders = ordersByCustomer.get(entry.id) || [];
    return [entry.id, {
      rows: [],
      currentOrders: customerOrders.filter((order) => order.production !== "Terminado").length,
      totalOrders: customerOrders.length,
      totalUnits: customerOrders.reduce((sum, order) => sum + order.quantity, 0),
      latestPurchase: purchaseByCustomer.get(entry.id)?.date || null,
    }];
  })), [customers, orders, ordersByCustomer, purchaseByCustomer]);
  const sortedCustomers = useMemo(() => [...customers].sort((a, b) => {
    const aDate = customerSort === "createdAt" ? a.createdAt || "" : customerMetrics.get(a.id)?.latestPurchase || "";
    const bDate = customerSort === "createdAt" ? b.createdAt || "" : customerMetrics.get(b.id)?.latestPurchase || "";
    if (customerSort !== "name" && !!aDate !== !!bDate) return aDate ? -1 : 1;
    let comparison = customerSort === "name"
      ? a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      : aDate.localeCompare(bDate);
    if (!comparison) comparison = a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    return customerSortDirection === "desc" ? -comparison : comparison;
  }), [customerMetrics, customerSort, customerSortDirection, customers]);
  const selectedFilterCustomers = useMemo(() => sortedCustomers.filter((entry) => {
    if (channelFilter && channelByCustomer.get(entry.id) !== channelFilter) return false;
    if (typeFilter && (entry.segment === "Mayorista" ? "Mayorista" : "Minorista") !== typeFilter) return false;
    if (countryFilter && countryDisplayName(entry.country || "") !== countryFilter) return false;
    if (categoryFilter) {
      const purchase = purchaseByCustomer.get(entry.id);
      if (!purchase?.date || !purchase.category.split(",").some((category) => category.trim() === categoryFilter)) return false;
    }
    return true;
  }), [sortedCustomers, channelFilter, channelByCustomer, typeFilter, countryFilter, categoryFilter, purchaseByCustomer]);
  const queryFilteredCustomers = useMemo(() => {
    const normalizedQuery = customerQuery.trim().toLocaleLowerCase("es");
    return normalizedQuery
      ? selectedFilterCustomers.filter((entry) => customerTableSearchText(entry).toLocaleLowerCase("es").includes(normalizedQuery))
      : selectedFilterCustomers;
  }, [customerQuery, purchaseByCustomer, selectedFilterCustomers]);
  const customersWithOrders = useMemo(() => new Set(orders.map((order) => order.customerId)), [orders]);
  const customersWithBalance = useMemo(() => new Set(orders.filter((order) => balance(s, order) > 0).map((order) => order.customerId)), [orders, s]);
  const filteredCustomers = useMemo(() => queryFilteredCustomers.filter((entry) =>
    customerKpiFilter === "orders" ? customersWithOrders.has(entry.id)
      : customerKpiFilter === "balance" ? customersWithBalance.has(entry.id) : true,
  ), [queryFilteredCustomers, customerKpiFilter, customersWithOrders, customersWithBalance]);
  const customersWithOrdersInView = queryFilteredCustomers.filter((entry) => customersWithOrders.has(entry.id)).length;
  const customersWithBalanceInView = queryFilteredCustomers.filter((entry) => customersWithBalance.has(entry.id)).length;
  const customerExportRows = useMemo(() => filteredCustomers.map((entry) => {
    const phone = splitCustomerPhone(entry.phone, entry.country);
    const latestPurchase = purchaseByCustomer.get(entry.id);
    return {
      Nombre: entry.name,
      Empresa: entry.companyName || "",
      Mail: entry.email || "",
      Prefijo: phone.prefix || "",
      Celular: phone.number || "",
      "Otros celulares": (entry.agendaAdditionalPhones || []).join(" · "),
      "Fecha de nacimiento": entry.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(entry.birthDate) ? `${entry.birthDate.slice(8, 10)}/${entry.birthDate.slice(5, 7)}/${entry.birthDate.slice(0, 4)}` : "",
      Ciudad: entry.city || "",
      País: countryDisplayName(entry.country || countryForCity(entry.city)),
      Origen: customerOriginLabel(channelByCustomer.get(entry.id) || ""),
      Tipo: entry.segment === "Mayorista" ? "Mayorista" : "Minorista",
      "Última compra": customerMetrics.get(entry.id)?.latestPurchase ? orderDate(customerMetrics.get(entry.id)?.latestPurchase || "") : "",
      "Última categoría comprada": latestPurchase?.date ? latestPurchase.category : "",
      "Fecha de alta": entry.createdAt ? formatDate(entry.createdAt) : "",
    };
  }), [channelByCustomer, customerMetrics, filteredCustomers, purchaseByCustomer]);
  const hasCustomerFilters = Boolean(channelFilter || typeFilter || countryFilter || categoryFilter || customerKpiFilter || customerQuery.trim());
  const clearCustomerFilters = () => {
    setChannelFilter("");
    setTypeFilter("");
    setCountryFilter("");
    setCategoryFilter("");
    setCustomerKpiFilter(null);
    setCustomerQuery("");
  };
  const sortHeader = (label: string, field: typeof customerSort, ascending: string, descending: string) => (
    <span className="customer-sort-heading">
      <span>{label}</span>
      <span className="customer-sort-arrows">
        <button type="button" aria-label={ascending} title={ascending} aria-pressed={customerSort === field && customerSortDirection === "asc"} onClick={() => { setCustomerSort(field); setCustomerSortDirection("asc"); }}>↑</button>
        <button type="button" aria-label={descending} title={descending} aria-pressed={customerSort === field && customerSortDirection === "desc"} onClick={() => { setCustomerSort(field); setCustomerSortDirection("desc"); }}>↓</button>
      </span>
    </span>
  );
  const channelHeader = <span className="customer-filter-heading"><select aria-label="Filtrar por canal de origen" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}><option value="">Origen</option>{customerOriginOptions.map((channel) => <option key={channel} value={channel}>{customerOriginLabel(channel)}</option>)}</select><CaretDown size={12} aria-hidden="true" /></span>;
  const typeHeader = <span className="customer-filter-heading"><select aria-label="Filtrar por tipo de cliente" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Tipo</option><option value="Minorista">Minorista</option><option value="Mayorista">Mayorista</option></select><CaretDown size={12} aria-hidden="true" /></span>;
  const countryHeader = <span className="customer-filter-heading"><select aria-label="Filtrar por país" title={countryFilter || "Filtrar por país"} value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}><option value="">País</option>{availableCountries.map((country) => <option key={country} value={country}>{country}</option>)}</select><CaretDown size={12} aria-hidden="true" /></span>;
  const categoryHeader = <span className="customer-filter-heading customer-category-filter-heading"><select aria-label="Filtrar por última categoría comprada" title={categoryFilter || "Filtrar por última categoría comprada"} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">Última categoría comprada</option>{availablePurchaseCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select><CaretDown size={12} aria-hidden="true" /></span>;
  const userId = accessUserId(s);
  const fields: Field[] = [
    { key: "name", label: "Nombre" },
    { key: "email", label: "Correo", type: "email" },
    { key: "phone", label: "Celular" },
    { key: "city", label: "Ciudad" },
    { key: "country", label: "País", options: countryOptions },
    {
      key: "segment",
      label: "Tipo de cliente",
      options: userId === "t3" ? ["Mayorista"] : userId === "t2" ? ["Minorista"] : ["Minorista", "Mayorista"],
    },
  ];
  return (
    <>
      <Stats
        items={[
          { label: "Clientes en esta vista", value: filteredCustomers.length },
          { label: "Con pedidos", value: customersWithOrdersInView, go: () => setCustomerKpiFilter((current) => current === "orders" ? null : "orders"), pressed: customerKpiFilter === "orders" },
          { label: "Clientes con saldo", value: customersWithBalanceInView, go: () => setCustomerKpiFilter((current) => current === "balance" ? null : "balance"), pressed: customerKpiFilter === "balance" },
        ]}
      />
      <div className="customers-mobile-filters">
        {sortHeader("Cliente", "name", "Ordenar clientes de A a Z", "Ordenar clientes de Z a A")}
        {sortHeader("Última compra", "latestPurchase", "Ordenar última compra de más antigua a más nueva", "Ordenar última compra de más nueva a más antigua")}
        {sortHeader("Fecha de alta", "createdAt", "Ordenar fecha de alta de más antigua a más nueva", "Ordenar fecha de alta de más nueva a más antigua")}
        {countryHeader}
        {categoryHeader}
        {channelHeader}
        {typeHeader}
      </div>
      <div className="customers-table"><Table
        rows={filteredCustomers}
        pageSize={75}
        searchText={customerTableSearchText}
        searchQuery={customerQuery}
        onSearchQueryChange={setCustomerQuery}
        action={<div className="table-actions customers-table-actions">
          <button type="button" className="secondary customers-export-button" disabled={!filteredCustomers.length} onClick={() => void exportCustomersXlsx(customerExportRows).catch((error) => notify(error instanceof Error ? `No se pudo exportar: ${error.message}` : "No se pudo exportar el Excel."))}><FileXls size={19} aria-hidden="true" />Exportar Excel</button>
          <button type="button" className="secondary customers-clear-filters" aria-label="Quitar filtros" title="Quitar filtros" disabled={!hasCustomerFilters} onClick={clearCustomerFilters}><FunnelX size={19} aria-hidden="true" /></button>
          <AddButton onClick={() => { setNewKind(userId === "t3" ? "wholesale" : "local"); setEdit("new"); }}>Nuevo cliente</AddButton>
        </div>}
        columns={[
          {
            label: "Cliente",
            header: sortHeader("Cliente", "name", "Ordenar clientes de A a Z", "Ordenar clientes de Z a A"),
            render: (c) => (
              <button className="text-button" aria-label={`Ver ficha de ${c.name}`} onClick={() => setSelected(c.id)}>
                {c.companyName && c.companyName.localeCompare(c.name, "es", { sensitivity: "base" }) === 0 ? "—" : c.name}
                
              </button>
            ),
          },
          { label: "Empresa", render: (c) => c.companyName ? <span title={c.companyName}>{c.companyName}</span> : "—" },
          { label: "Mail", render: (c) => c.email ? <a href={`mailto:${c.email}`} className="customer-contact-link">{c.email}</a> : "—" },
          { label: "Prefijo", render: (c) => splitCustomerPhone(c.phone, c.country).prefix || "—" },
          { label: "Celular", render: (c) => c.phone ? <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="customer-contact-link">{splitCustomerPhone(c.phone, c.country).number}</a> : "—" },
          { label: "Fecha de nacimiento", render: (c) => formatDate(c.birthDate) },
          { label: "Ciudad", render: (c) => c.city || "—" },
          { label: "País", header: countryHeader, render: (c) => c.country ? <LocationLabel place={c.country} /> : "—" },
          { label: "Origen", header: channelHeader, render: (c) => { const channel = channelByCustomer.get(c.id); return channel ? <Badge>{customerOriginLabel(channel)}</Badge> : "—"; } },
          { label: "Tipo", header: typeHeader, render: (c) => c.segment === "Mayorista" ? "Mayorista" : "Minorista" },
          { label: "Última compra", header: sortHeader("Última compra", "latestPurchase", "Ordenar última compra de más antigua a más nueva", "Ordenar última compra de más nueva a más antigua"), render: (c) => orderDate(customerMetrics.get(c.id)?.latestPurchase || "") },
          { label: "Última categoría comprada", header: categoryHeader, render: (c) => { const purchase = purchaseByCustomer.get(c.id); return purchase?.date ? purchase.category || "—" : "—"; } },
          { label: "Fecha de alta", header: sortHeader("Fecha de alta", "createdAt", "Ordenar fecha de alta de más antigua a más nueva", "Ordenar fecha de alta de más nueva a más antigua"), render: (c) => formatDate(c.createdAt) },
          ... ([{
            label: "Acciones",
            render: (c: Customer) => (
              <button type="button" className="secondary customer-edit-button" aria-label={`Editar ${c.name}`} title={`Editar ${c.name}`} onClick={() => setEdit(c)}>
                <PencilSimple size={18} aria-hidden="true" />
              </button>
            ),
          }]),
        ]}
      /></div>
      {edit && (
        <Modal
          title={edit === "new" ? "Nuevo cliente" : "Editar cliente"}
          onClose={() => setEdit(null)}
        >
          {edit === "new" && userId !== "t2" && userId !== "t3" && <div className="tabs new-customer-kind" role="group" aria-label="Tipo de cliente">{(["local", "wholesale"] as const).map((kind) => <button key={kind} type="button" className={newKind === kind ? "active" : ""} onClick={() => setNewKind(kind)}>{kind === "local" ? "Minorista" : "Mayorista"}</button>)}</div>}
          {(edit === "new" && newKind === "wholesale") || (edit !== "new" && !!edit.wholesaleName) ? <WholesaleCustomerEditor customer={edit === "new" ? undefined : edit} onSaved={() => { setEdit(null); setSelected(null); notify(edit === "new" ? "Cliente mayorista creado" : "Cliente mayorista actualizado"); void refresh?.(); }} onDeleted={() => { setEdit(null); setSelected(null); notify("Cliente mayorista eliminado"); void refresh?.(true); }} /> : s.source === "commerce" && edit !== "new" && edit.raffleEntryId && edit.id === `sorteo:${edit.raffleEntryId}` ? <RuralRaffleCustomerEditor customer={edit} orderCount={orders.filter(order => order.customerId === edit.id).length} onSaved={() => { setEdit(null); setSelected(null); notify("Participante actualizado"); void refresh?.(); }} onDeleted={() => { setEdit(null); setSelected(null); notify("Participante eliminado"); void refresh?.(true); }} /> : s.source === "commerce" && (edit === "new" || edit.localCustomerId) ? <LocalCustomerEditor customer={edit === "new" ? undefined : edit} orderCount={edit === "new" ? 0 : orders.filter(order => order.customerId === edit.id).length} webOrderIds={edit === "new" ? [] : orders.filter(order => order.customerId === edit.id && order.source !== "local" && order.source !== "wholesale").map(order => order.id)} onSaved={() => { setEdit(null); setSelected(null); notify(edit === "new" ? "Cliente creado" : "Cliente actualizado"); void refresh?.(); }} onDeleted={() => { setEdit(null); setSelected(null); notify("Cliente eliminado"); void refresh?.(true); }} /> : s.source === "commerce" && edit !== "new" ? <CustomerContactEditor customer={edit} orderIds={orders.filter(order => order.customerId === edit.id && order.source !== "local").map(order => order.id)} onSaved={() => { setEdit(null); setSelected(null); notify("Contacto actualizado"); void refresh?.(); }} onDeleted={() => { setEdit(null); setSelected(null); notify("Contacto eliminado"); void refresh?.(true); }} /> : <Form
            fields={fields}
            initial={edit === "new" ? { country: "Uruguay", segment: userId === "t3" ? "Mayorista" : "Minorista" } : { ...edit, country: edit.country || countryForCity(edit.city) }}
            onSave={(v) => {
              update(
                (s) => ({
                  ...s,
                  customers:
                    edit === "new"
                      ? [...s.customers, { ...v, id: id() } as Customer]
                      : s.customers.map((c) =>
                          c.id === edit.id ? { ...c, ...v } : c,
                        ),
                }),
                "Cliente guardado",
              );
              setEdit(null);
            }}
          />}
        </Modal>
      )}
      {c && <CustomerDetailModal customer={c} s={s} go={go} commerce={commerce} onClose={() => setSelected(null)} />}
    </>
  );
}
