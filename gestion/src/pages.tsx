import { CustomerContactEditor } from "./commerce/CustomerContactEditor";
import { LocalCustomerEditor } from "./LocalCustomerEditor";
import { LocalSaleRegister } from "./LocalSaleRegister";
import { WholesaleRegister, WholesaleCustomerEditor, WholesaleOrderModal, WholesaleProduction } from "./WholesaleScreens";
import { exportWholesalePdf } from "./wholesaleExports";
import { PersonalizedOrders } from "./commerce/PersonalizedOrdersView";
import type { Session } from "@supabase/supabase-js";
import { Orders as CommerceOrderDetails } from "./commerce/Operations";
import type { CommerceSnapshot } from "./commerceAdapter";
import { ChartTooltip } from "./ui";
import { useState, type ReactNode } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Check, Package, Warning, Leaf, Plus } from "@phosphor-icons/react";
import {
  type State,
  type Order,
  type OrderLine,
  type Product,
  type Row,
  type Customer,
  type SalesChannel,
  orderName,
  isSale,
  money,
  total,
  paid,
  balance,
  id,
  today,
  addOrder,
  publishPrices,
} from "./data";
import { areas } from "./navigation";
import { collections, type Field } from "./collections";
import { overviewPeriods, overviewScope, type OverviewPeriod } from "./overview";
import { accessUserId, allowedSalesChannels, canAccess, visibleCustomers, visibleOrders } from "./access";
import { countryForCity, countryOptions, LocationLabel } from "./location";
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
export type PageProps = {
  session?: Session | null;
  refresh?: () => Promise<void>;
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
const orderDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
    : "—";
const paymentStatus = (s: State, o: Order) =>
  o.status === "cancelled" ? "Cancelado" : o.status === "refunded" ? "Reembolsado" : o.status === "payment_failed" ? "Pago fallido" : o.status === "payment_verification_pending" ? "Comprobante por verificar" : balance(s, o) === 0
    ? "Pagado"
    : paid(s, o) > 0
      ? "Pago parcial"
      : "Pendiente";
export function Overview({ s, go }: PageProps) {
  const [period, setPeriod] = useState<OverviewPeriod>(() => {
    try {
      const saved = localStorage.getItem("matearte-overview-period");
      return overviewPeriods.some(([value]) => value === saved) ? saved as OverviewPeriod : "14d";
    } catch {
      return "14d";
    }
  });
  const canSeeFinance = canAccess(s, "/finanzas/resumen");
  const hasExpenses = s.source !== "commerce";
  const canSeeProduction = canAccess(s, "/produccion/resumen");
  const { orders, expenses, trend, start, end } = overviewScope({
    ...s,
    orders: visibleOrders(s),
    expenses: canSeeFinance ? s.expenses : [],
  }, period);
  const sales = orders.reduce((a, o) => a + total(o), 0);
  const expensesPaid = expenses
    .filter((expense) => expense.paid)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const productionOrders = canSeeProduction
    ? visibleOrders(s, true).filter((order) => order.source !== "local" && isSale(order) && order.date >= start && order.date <= end)
    : [];
  const pending = productionOrders.filter((o) => o.production !== "Terminado");
  const channelData = (canSeeFinance ? (["Web", "Local", "Mayorista", "Instagram", "Facebook", "WhatsApp"] as SalesChannel[]) : allowedSalesChannels(s)).map(
    (name) => ({
      name,
      total: orders
        .filter((o) => o.channel === name)
        .reduce((a, o) => a + total(o), 0),
    }),
  );
  const channelColors: Record<SalesChannel, string> = { Web: "#236b91", Mayorista: "#245f3f", Local: "#794c32", Instagram: "#d83280", Facebook: "#2459a6", WhatsApp: "#28b765", Sorteo: "#a87800" };
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
              try { localStorage.setItem("matearte-overview-period", next); } catch {}
            }}
          >
            {overviewPeriods.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {canAccess(s, "/comercial/registrar") && <button
            className="secondary"
            onClick={() => go("/comercial/registrar")}
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
            value: s.source === "commerce" ? "—" : money(expensesPaid),
            tone: "red" as const,
            solid: true,
            go: () => go("/finanzas/egresos"),
          }, {
            label: "Ganancia",
            value: s.source === "commerce" ? "—" : money(sales - expensesPaid),
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
          <div className="channel-chart">
            <ResponsiveContainer width="100%" height={165}>
              <BarChart
                data={channelData}
                layout="vertical"
                margin={{ left: 0, right: 20 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  width={95}
                  tick={({ x, y, payload }) => <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill={channelColors[payload.value as SalesChannel]}>{payload.value}</text>}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  isAnimationActive={false}
                  dataKey="total"
                  name="Ventas"
                  radius={[0, 5, 5, 0]}
                  barSize={21}
                >
                  {channelData.map((c) => (
                    <Cell
                      key={c.name}
                      fill={channelColors[c.name]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {channelData.map((c) => (
            <div className="line-item" key={c.name}>
              <Badge>{c.name}</Badge>
              <strong>{money(c.total)}</strong>
            </div>
          ))}
        </Card>
      </div>
      {(canAccess(s, "/inicio/alertas") || canSeeProduction) && <div className="overview-bottom">
        {canAccess(s, "/inicio/alertas") && <Card
          title="Pendientes"
          action={
            <button
              className="text-button"
              onClick={() => go("/inicio/alertas")}
            >
              Ver todo 
            </button>
          }
        >
          <AlertList s={s} orders={orders} expenses={expenses} go={go} />
        </Card>}
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
      </div>}
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
function AlertList({ s, orders, expenses, go }: { s: State; orders: Order[]; expenses: State["expenses"]; go: PageProps["go"] }) {
  const productIds = new Set(orders.map((order) => order.productId));
  const items = [
    {
      label: "Stock bajo mínimo en productos del período",
      value: s.products.filter((p) => productIds.has(p.id) && p.stock < p.min).length,
      tone: "red",
      desc: "Revisar necesidades de reposici\u00F3n",
      path: "/inventario/reposicion",
    },
    {
      label: "Dise\u00F1os para revisar",
      value: orders.filter((o) => o.design && !o.approved).length,
      tone: "yellow",
      desc: "Aprobaciones antes de producir",
      path: "/produccion/resumen",
    },
    {
      label: "Cobros pendientes",
      value: orders.filter((o) => balance(s, o) > 0).length,
      tone: "yellow",
      desc:
        money(orders.reduce((a, o) => a + balance(s, o), 0)) + " por cobrar",
      path: "/finanzas/por-cobrar",
    },
    {
      label: "Pagos pendientes",
      value: expenses.filter((e) => !e.paid).length,
      tone: "yellow",
      desc: "Compromisos registrados",
      path: "/finanzas/por-pagar",
    },
  ];
  return (
    <div className="alert-list">
      {items.filter((item) => item.value > 0 && canAccess(s, item.path)).map((i) => (
        <button className={`tone-${i.tone}`} key={i.path} onClick={() => go(i.path)}>
          <div className="alert-icon">
            <Warning size={20} />
          </div>
          <div>
            <strong>{i.label}</strong>
          </div>
          <b>{i.value}</b>
          
        </button>
      ))}
      {items.every((item) => item.value === 0 || !canAccess(s, item.path)) && <div className="empty">Sin pendientes en este período</div>}
    </div>
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
}: {
  s: State;
  orders: Order[];
  go: PageProps["go"];
  title?: string;
  open?: (o: Order) => void;
  mode?: string;
  showAmounts?: boolean;
}) {
  return (
    <Table
      title={title}
      rows={orders}
      searchText={(o) =>
        `${orderName(o)} ${customer(s, o).name} ${o.items?.map((item) => item.title).join(" ") || product(s, o).name} ${o.channel}`
      }
      columns={[
        {
          label: "Pedido",
          render: (o) => (
            <button
              className="text-button"
              onClick={() =>
                open ? open(o) : go(`/comercial/pedidos?pedido=${o.id}`)
              }
            >
              {orderName(o)}
              
            </button>
          ),
        },
        { label: "Fecha", render: (o) => orderDate(o.date) },
        {
          label: "Cliente",
          render: (o) => (
            <div className="person">
              <div>
                <strong>{customer(s, o).name}</strong>
                <small>
                  {o.items ? o.items.map((item) => `${item.title} × ${item.quantity}`).join(" · ") : `${product(s, o).name} · ${o.quantity} u.`}
                </small>
              </div>
            </div>
          ),
        },
        { label: "Canal", render: (o) => <Badge>{o.channel}</Badge> },
        ...(showAmounts ? [
          { label: "Total", render: (o: Order) => <strong>{money(total(o))}</strong> },
          { label: "Pago", render: (o: Order) => <Badge>{paymentStatus(s, o)}</Badge> },
        ] : []),
        {
          label: "Producci\u00F3n",
          render: (o) => o.source === "local" ? "—" : <Badge>{o.production}</Badge>,
        },
        ...(["pendientes", "retiros", "envios"].includes(mode)
          ? [
              {
                label: "Entrega",
                render: (o: Order) => <Badge>{o.delivery}</Badge>,
              },
              { label: "Fecha prevista", render: (o: Order) => o.due || "Sin fecha" },
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
          : ["mayorista", "minorista", "resumen-produccion"].includes(mode)
                ? [{ label: "Fecha objetivo", render: (o: Order) => o.due || "Sin fecha" }]
                : []),
      ]}
    />
  );
}
export function Orders(
  props: PageProps & {
    mode?: string;
  },
) {
  const { s, update, go, mode = "pedidos" } = props;
  const [selected, setSelected] = useState<string | null>(
    new URLSearchParams(location.search).get("pedido"),
  );
  const [channel, setChannel] = useState("Todos");
  const [group, setGroup] = useState("Pedidos");
  const [personalized, setPersonalized] = useState(false);
  if (mode === "mayorista") return <><WholesaleProduction props={props} /><section className="wholesale-web-orders"><h2>Pedidos mayoristas de la web</h2><Orders {...props} mode="mayorista-web" /></section></>;
  const productionView = ["mayorista-web", "minorista", "historico", "resumen-produccion"].includes(mode);
  const showAmounts = !productionView || canAccess(s, "/finanzas/resumen");
  const availableOrders = visibleOrders(s, productionView).filter((order) => !productionView || (order.source !== "local" && isSale(order)));
  const o = availableOrders.find((x) => x.id === selected);
  let rows = availableOrders.filter(
    (o) => channel === "Todos" || o.channel === channel,
  );
  if (mode === "mayorista")
    rows = rows.filter(
      (o) => o.channel === "Mayorista" && o.production !== "Terminado",
    );
  if (mode === "mayorista-web")
    rows = rows.filter((o) => o.channel === "Mayorista" && o.source !== "wholesale" && o.production !== "Terminado");
  if (mode === "minorista")
    rows = rows.filter(
      (o) => o.channel !== "Mayorista" && o.production !== "Terminado",
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
  const change = (patch: Partial<Order>) => {
    if (o)
      update(
        (s) => ({
          ...s,
          orders: s.orders.map((x) => (x.id === o.id ? { ...x, ...patch } : x)),
        }),
        "Pedido actualizado",
      );
  };
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
  if (personalized) return <><div className="toolbar"><button className="secondary" onClick={() => setPersonalized(false)}>Volver a pedidos</button></div><div className="commerce-tools"><PersonalizedOrders onNotice={props.notify} /></div></>;
  return (
    <>
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
      <div className="toolbar">
        {productionView && <button className="secondary" onClick={() => setPersonalized(true)}>Personalizaciones y archivos</button>}
        <div className="tabs">
          {["Todos", ...(productionView ? ["Web", "Local", "Mayorista"] : allowedSalesChannels(s))].map((c) => (
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
          <Export
            rows={rows.map((o) => ({
              pedido: orderName(o),
              fecha: orderDate(o.date),
              cliente: customer(s, o).name,
              producto: o.items?.map((item) => item.title).join(" · ") || product(s, o).name,
              cantidad: o.quantity,
              ...(showAmounts ? { total: total(o), saldo: balance(s, o) } : {}),
              produccion: o.source === "local" ? "" : o.production,
              entrega: o.source === "local" ? "" : o.delivery,
            }))}
          />
          {canAccess(s, "/comercial/registrar") && <AddButton onClick={() => go("/comercial/registrar")}>
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
          title={
            mode === "pedidos"
              ? undefined
              : mode === "por-cobrar"
                  ? "Pedidos con saldo"
                  : mode === "historico"
                    ? "Trabajos terminados"
                    : ["pendientes", "retiros", "envios"].includes(mode)
                      ? "Log\u00EDstica y entregas"
                      : "Trabajo del taller"
          }
          open={(o) => setSelected(o.id)}
        />
      )}
      {mode === "historico" && <WholesaleProduction props={props} history />}
      {o?.source === "local" && <Modal title={orderName(o)} onClose={() => setSelected(null)}>
        <div className="detail-banner"><div><small>{o.date} · {o.paymentMethod}</small><h3>{customer(s, o).name}</h3></div><strong>{money(total(o))}</strong></div>
        <Table rows={o.items || []} searchText={(item) => `${item.title} ${item.sku} ${item.variant}`} columns={[
          { label: "SKU", render: (item) => item.sku },
          { label: "Artículo", render: (item) => item.title },
          { label: "Variante", render: (item) => item.variant },
          { label: "Cantidad", render: (item) => item.quantity },
          { label: "Unitario", render: (item) => money(item.unitPrice) },
          { label: "Importe", render: (item) => money(item.amount) },
        ]} />
        <div className="order-breakdown">
          {o.localItemsAmount !== total(o) && <div className="line-item"><div>Valor de artículos</div><strong>{money(o.localItemsAmount || 0)}</strong></div>}
          <div className="line-item"><div>Cobrado</div><strong>{money(paid(s, o))}</strong></div>
          {o.paymentMethod === "Seña" && balance(s, o) > 0 && <div className="line-item"><div>Saldo de la seña</div><strong>{money(balance(s, o))}</strong></div>}
          {o.paymentMethod !== "Seña" && o.localItemsAmount !== total(o) && <div className="data-note">El valor de los artículos difiere del total registrado.</div>}
        </div>
        {s.customers.some((entry) => entry.id === o.customerId) && <div className="form-actions"><button className="text-button" onClick={() => go(`/clientes/base?cliente=${o.customerId}`)}>Ver cliente</button></div>}
      </Modal>}
      {o?.source === "wholesale" ? <WholesaleOrderModal order={o} props={props} onClose={() => setSelected(null)} /> : o && o.source !== "local" && props.session ? <div className="commerce-tools order-tools"><CommerceOrderDetails key={o.id} session={props.session} onNotice={props.notify} orderId={o.id} onCustomer={() => go(`/clientes/base?cliente=${o.customerId}`)} onClose={() => { setSelected(null); void props.refresh?.(); }} /></div> : o && o.source !== "local" && (
        <Modal title={`Pedido ${orderName(o)}`} onClose={() => setSelected(null)}>
          <div className="detail-banner">
            <div>
              <small>
                {product(s, o).name} · {o.quantity} unidades
              </small>
              <h3>{customer(s, o).name}</h3>
              
            </div>
            {showAmounts && <strong>{money(total(o))}</strong>}
          </div>
          <div className="detail-grid">
            {showAmounts && <div>
              <small>Pago</small>
              <Badge>{paymentStatus(s, o)}</Badge>
              <div className="balance">Saldo {money(balance(s, o))}</div>
              {s.source !== "commerce" && balance(s, o) > 0 && (
                <button
                  className="secondary"
                  onClick={() =>
                    update(
                      (s) => ({
                        ...s,
                        payments: [
                          ...s.payments,
                          {
                            id: id(),
                            orderId: o.id,
                            amount: balance(s, o),
                            date: today,
                            method: "Transferencia",
                          },
                        ],
                      }),
                      "Cobro registrado",
                    )
                  }
                >
                  Registrar cobro del saldo
                </button>
              )}
            </div>}
            <label>
              Producción
              <select
                disabled={s.source === "commerce"}
                value={o.production}
                onChange={(e) =>
                  change({ production: e.target.value as Order["production"] })
                }
              >
                {["Pendiente", "En producci\u00F3n", "Terminado"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Entrega · {o.method}
              <select
                disabled={s.source === "commerce"}
                value={o.delivery}
                onChange={(e) =>
                  change({ delivery: e.target.value as Order["delivery"] })
                }
              >
                {["Pendiente", "Enviado", "Entregado"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {o.method === "Env\u00EDo" && (
              <>
                <label>
                  Transportista
                  <input
                    readOnly={s.source === "commerce"}
                    defaultValue={o.carrier || ""}
                    placeholder="Ej.: DAC"
                    onBlur={(e) => {
                      if (e.target.value !== (o.carrier || ""))
                        change({ carrier: e.target.value });
                    }}
                  />
                </label>
                <label>
                  Código de seguimiento
                  <input
                    readOnly={s.source === "commerce"}
                    defaultValue={o.tracking || ""}
                    placeholder="Código del envío"
                    onBlur={(e) => {
                      if (e.target.value !== (o.tracking || ""))
                        change({ tracking: e.target.value });
                    }}
                  />
                </label>
              </>
            )}
            <div>
              <small>Fecha de entrega</small>
              <strong>{o.due || "Sin fecha"}</strong>
            </div>
          </div>
          {o.items && <Table rows={o.items} searchText={(item) => `${item.title} ${item.sku}`} columns={[
            { label: "Artículo", render: (item) => <div>{item.title}<small>{item.sku}</small></div> },
            { label: "Cantidad", render: (item) => item.quantity },
            ...(showAmounts ? [{ label: "Unitario", render: (item: NonNullable<Order["items"]>[number]) => money(item.unitPrice) }, { label: "Importe", render: (item: NonNullable<Order["items"]>[number]) => money(item.amount) }] : []),
            { label: "Revisión", render: (item) => item.reviewStatus === "approved" ? "Aprobado" : item.reviewStatus === "pending" ? "Pendiente" : item.reviewStatus === "rejected" ? "Rechazado" : "No requiere" },
          ]} />}
          {showAmounts && o.items && <div className="order-breakdown">
            <div className="line-item"><div>Artículos</div><strong>{money(o.items.reduce((sum, item) => sum + item.amount, 0))}</strong></div>
            <div className="line-item"><div>Descuento</div><strong>{money(-(o.discountAmount || 0))}</strong></div>
            <div className="line-item"><div>Envío</div><strong>{money(o.shippingAmount || 0)}</strong></div>
            <div className="line-item"><div>Cargo por pago</div><strong>{money(o.feeAmount || 0)}</strong></div>
            <div className="line-item"><div>Total del pedido</div><strong>{money(total(o))}</strong></div>
          </div>}
          <div className="form-actions">
            <button
              className="text-button"
              onClick={() => go(`/clientes/base?cliente=${o.customerId}`)}
            >
              Ver ficha del cliente 
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function Register(props: PageProps) {
  const channels = allowedSalesChannels(props.s);
  const [kind, setKind] = useState<"Local" | "Mayorista">(channels.includes("Local") ? "Local" : "Mayorista");
  return <>{channels.includes("Local") && channels.includes("Mayorista") && <div className="tabs inner-tabs"><button className={kind === "Local" ? "active" : ""} onClick={() => setKind("Local")}>Venta local</button><button className={kind === "Mayorista" ? "active" : ""} onClick={() => setKind("Mayorista")}>Pedido mayorista</button></div>}{kind === "Local" ? <LocalSaleRegister {...props} /> : <WholesaleRegister {...props} />}</>;
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
  const [newKind, setNewKind] = useState<"local" | "wholesale">("local");
  const [selected, setSelected] = useState<string | null>(
    new URLSearchParams(location.search).get("cliente"),
  );
  const customers = visibleCustomers(s);
  const orders = visibleOrders(s);
  const customerChannels = (customer: Customer) => [...new Set([
    ...orders.filter((order) => order.customerId === customer.id).map((order) => order.channel),
    ...(customer.sourceChannels || []),
  ])];
  const c = customers.find((c) => c.id === selected);
  const userId = accessUserId(s);
  const fields: Field[] = [
    { key: "name", label: "Nombre" },
    { key: "email", label: "Correo", type: "email" },
    { key: "phone", label: "Celular" },
    { key: "city", label: "Ciudad" },
    { key: "country", label: "País", options: countryOptions },
    {
      key: "segment",
      label: "Segmento",
      options: userId === "t3" ? ["Mayorista"] : userId === "t2" ? ["Minorista", "Empresas"] : ["Minorista", "Mayorista", "Empresas"],
    },
  ];
  if (mode === "segmentos")
    return (
      <div className="three-grid">
        {(userId === "t3" ? ["Mayorista"] : userId === "t2" ? ["Minorista", "Empresas"] : ["Minorista", "Mayorista", "Empresas"]).map((seg) => {
          const clients = customers.filter((c) => c.segment === seg);
          return (
            <Card key={seg} title={seg}>
              <div className="big-number">
                {money(
                  orders
                    .filter((o) => isSale(o) && clients.some((c) => c.id === o.customerId))
                    .reduce((a, o) => a + total(o), 0),
                )}
              </div>
              
              {clients.map((c) => (
                <button
                  key={c.id}
                  className="list-link"
                  onClick={() => go(`/clientes/base?cliente=${c.id}`)}
                >
                  {c.name}
                  
                </button>
              ))}
            </Card>
          );
        })}
      </div>
    );
  return (
    <>
      <Stats
        items={[
          { label: "Clientes en esta vista", value: customers.length },
          { label: "Con pedidos", value: new Set(orders.filter((order) => customers.some((entry) => entry.id === order.customerId)).map((order) => order.customerId)).size },
          {
            label: "Clientes con saldo",
            value: new Set(
              orders
                .filter((o) => balance(s, o) > 0 && customers.some((entry) => entry.id === o.customerId))
                .map((o) => o.customerId),
            ).size,
          },
        ]}
      />
      <div className="customers-table"><Table
        rows={customers}
        searchText={(c) => `${c.name} ${c.email} ${c.phone} ${c.birthDate || ""} ${c.city} ${c.country || countryForCity(c.city)}`}
        action={<div className="table-actions">{allowedSalesChannels(s).includes("Local") && <AddButton onClick={() => { setNewKind("local"); setEdit("new"); }}>Nuevo cliente</AddButton>}{allowedSalesChannels(s).includes("Mayorista") && <AddButton onClick={() => { setNewKind("wholesale"); setEdit("new"); }}>Nuevo mayorista</AddButton>}</div>}
        columns={[
          {
            label: "Cliente",
            render: (c) => (
              <button className="text-button" onClick={() => setSelected(c.id)}>
                {c.name}
                
              </button>
            ),
          },
          { label: "Mail", render: (c) => c.email ? <a href={`mailto:${c.email}`} className="customer-contact-link">{c.email}</a> : "—" },
          { label: "Celular", render: (c) => c.phone ? <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="customer-contact-link">{c.phone}</a> : "—" },
          { label: "Fecha de nacimiento", render: (c) => c.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(c.birthDate) ? `${c.birthDate.slice(8, 10)}/${c.birthDate.slice(5, 7)}/${c.birthDate.slice(0, 4)}` : "—" },
          { label: "Ciudad", render: (c) => c.city || "—" },
          { label: "País", render: (c) => c.country ? <LocationLabel place={c.country} /> : "—" },
          { label: "Canal", render: (c) => customerChannels(c).length ? <div className="customer-channels">{customerChannels(c).map((channel) => <Badge key={channel}>{channel}</Badge>)}</div> : "—" },
          {
            label: "Pedidos",
            render: (c) => orders.filter((o) => o.customerId === c.id).length,
          },
          ... ([{
            label: "Acciones",
            render: (c: Customer) => !c.raffleEntryId && (
              <button className="secondary compact" onClick={() => setEdit(c)}>
                Editar
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
          {(edit === "new" && newKind === "wholesale") || (edit !== "new" && !!edit.wholesaleName) ? <WholesaleCustomerEditor customer={edit === "new" ? undefined : edit} onSaved={() => { setEdit(null); setSelected(null); notify(edit === "new" ? "Cliente mayorista creado" : "Cliente mayorista actualizado"); void refresh?.(); }} /> : s.source === "commerce" && (edit === "new" || edit.localCustomerId) ? <LocalCustomerEditor customer={edit === "new" ? undefined : edit} onSaved={() => { setEdit(null); setSelected(null); notify(edit === "new" ? "Cliente creado" : "Cliente actualizado"); void refresh?.(); }} /> : s.source === "commerce" && edit !== "new" ? <CustomerContactEditor customer={edit} orderIds={orders.filter(order => order.customerId === edit.id && order.source !== "local").map(order => order.id)} onSaved={() => { setEdit(null); setSelected(null); notify("Contacto actualizado"); void refresh?.(); }} /> : <Form
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
      {c && (
        <Modal title={c.name} onClose={() => setSelected(null)}>
          {c.localCustomerId && <div className="customer-local-facts">
            {c.firstPurchaseDate && <div><small>Primera compra en el local</small><strong>{c.firstPurchaseDate}</strong></div>}
            {c.lastPurchaseDate && <div><small>Última compra en el local</small><strong>{c.lastPurchaseDate}</strong></div>}
            {c.notes && <div className="wide"><small>Notas</small><div>{c.notes}</div></div>}
          </div>}
          
          <Stats
            items={[
              {
                label: "Compras",
                value: money(
                  orders
                    .filter((o) => isSale(o) && o.customerId === c.id)
                    .reduce((a, o) => a + total(o), 0),
                ),
              },
              {
                label: "Saldo",
                value: money(
                  orders
                    .filter((o) => o.customerId === c.id)
                    .reduce((a, o) => a + balance(s, o), 0),
                ),
              },
            ]}
          />
          <OrderTable
            s={s}
            orders={orders.filter((o) => o.customerId === c.id)}
            go={go}
            title="Historial compartido"
          />
          {c.wholesaleName && commerce?.wholesale && <div className="form-actions"><button className="secondary" onClick={() => void exportWholesalePdf(`Historial · ${c.name}`, commerce.wholesale!.lines.filter((line) => line.customer === c.wholesaleName), commerce.wholesale!)}>PDF historial</button><button className="secondary" onClick={() => void exportWholesalePdf(`Pendientes · ${c.name}`, commerce.wholesale!.lines.filter((line) => line.customer === c.wholesaleName && line.status !== "Completado"), commerce.wholesale!)}>PDF pendientes</button></div>}
        </Modal>
      )}
    </>
  );
}
