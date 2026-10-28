import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PageProps } from "./pages";
import { visibleCustomers, visibleOrders } from "./access";
import { buildCustomerAnalytics, topWithOthers, UNSPECIFIED, type Slice } from "./customerAnalytics";
import { customerOriginLabel } from "./customerChannel";
import { CountryFlag } from "./location";
import { Card, Stats } from "./ui";

type Metric = "customers" | "orders";
const number = (value: number) => new Intl.NumberFormat("es-UY").format(value);
const percent = (part: number, whole: number) => whole ? `${Math.round(part / whole * 1000) / 10}%`.replace(".", ",") : "0%";
const regionWord = (country: string) => {
  if (country === "Uruguay") return { plural: "Departamentos", singular: "departamento" };
  if (country === "Argentina") return { plural: "Provincias", singular: "provincia" };
  if (["Brasil", "Estados Unidos", "México", "Venezuela", "Australia"].includes(country)) return { plural: "Estados", singular: "estado" };
  if (country === "Chile") return { plural: "Regiones", singular: "región" };
  return { plural: "Provincias o estados", singular: "provincia o estado" };
};

function MetricTabs({ metric, onChange, label }: { metric: Metric; onChange: (metric: Metric) => void; label: string }) {
  return <div className="tabs inner-tabs ca-metric-tabs" role="tablist" aria-label={label}>
    {([["customers", "Clientes"], ["orders", "Pedidos"]] as const).map(([value, text]) =>
      <button key={value} role="tab" aria-selected={metric === value} className={metric === value ? "active" : ""} onClick={() => onChange(value)}>{text}</button>)}
  </div>;
}

function RankBars({ rows, metric, flags = false, label, formatName = (name: string) => name }: { rows: Slice[]; metric: Metric; flags?: boolean; label: string; formatName?: (name: string) => string }) {
  const value = (row: Slice) => metric === "customers" ? row.customers : row.orders;
  const total = rows.reduce((sum, row) => sum + value(row), 0);
  const max = Math.max(1, ...rows.map(value));
  if (!rows.length || !total) return <div className="empty">Todavía no hay datos para mostrar.</div>;
  return <ol className="ca-bars" aria-label={label}>
    {rows.map((row) => <li key={row.name} className={row.name === UNSPECIFIED ? "is-unspecified" : row.name === "Otros" ? "is-others" : undefined}>
      <span className="ca-bar-label" title={formatName(row.name)}>{flags && row.name !== UNSPECIFIED && row.name !== "Otros" && <CountryFlag place={row.name} />}{formatName(row.name)}</span>
      <div className="ca-bar-track"><i style={{ width: `${Math.max(value(row) ? 2 : 0, value(row) / max * 100)}%` }} /></div>
      <strong>{number(value(row))}</strong>
      <small>{percent(value(row), total)}</small>
    </li>)}
  </ol>;
}

function ColumnChart({ data, label, color = "#794c32", unit = "clientes" }: { data: { label: string; value: number }[]; label: string; color?: string; unit?: string }) {
  return <div className="ca-chart" role="img" aria-label={label}>
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke="rgba(23,20,18,.09)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={6} tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <Tooltip cursor={{ fill: "rgba(121,76,50,.07)" }} formatter={(value) => [`${number(Number(value))} ${unit}`, ""]} separator="" />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>{data.map((entry) => <Cell key={entry.label} fill={color} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

export function CustomerAnalyticsView(props: PageProps) {
  const { s } = props;
  const customers = visibleCustomers(s);
  const orders = visibleOrders(s);
  const analytics = useMemo(() => buildCustomerAnalytics(customers, orders), [customers, orders]);
  const [countryMetric, setCountryMetric] = useState<Metric>("customers");
  const [regionMetric, setRegionMetric] = useState<Metric>("customers");
  const [channelMetric, setChannelMetric] = useState<Metric>("customers");
  const [pickedCountry, setPickedCountry] = useState("");

  const sortedBy = (rows: Slice[], metric: Metric) => [...rows].sort((a, b) =>
    (a.name === UNSPECIFIED) !== (b.name === UNSPECIFIED) ? (a.name === UNSPECIFIED ? 1 : -1)
      : (metric === "customers" ? b.customers - a.customers || b.orders - a.orders : b.orders - a.orders || b.customers - a.customers) || a.name.localeCompare(b.name, "es"));

  const knownCountries = analytics.countries.filter((row) => row.name !== UNSPECIFIED);
  const defaultCountry = (knownCountries.find((row) => (analytics.provincesByCountry.get(row.name) || []).some((region) => region.name !== UNSPECIFIED)) || knownCountries[0])?.name || "";
  const regionCountry = knownCountries.some((row) => row.name === pickedCountry) ? pickedCountry : defaultCountry;
  const regions = analytics.provincesByCountry.get(regionCountry) || [];
  const regionTotal = regions.reduce((sum, row) => sum + row.customers, 0);
  const regionKnown = regions.filter((row) => row.name !== UNSPECIFIED).reduce((sum, row) => sum + row.customers, 0);
  const word = regionWord(regionCountry);
  const regionRows = sortedBy(regions, regionMetric);

  if (!analytics.total) return <section className="ca-page"><div className="empty">Todavía no hay clientes cargados para analizar.</div></section>;
  const unspecifiedCountry = analytics.countries.find((row) => row.name === UNSPECIFIED)?.customers || 0;

  return <section className="ca-page" aria-label="Análisis de la base de clientes">
    <Stats items={[
      { label: "Clientes", value: number(analytics.total) },
      { label: "Con compras", value: number(analytics.withOrders), note: percent(analytics.withOrders, analytics.total) },
      { label: "Mayoristas", value: number(analytics.wholesale), note: `${number(analytics.retail)} minoristas` },
      { label: "Países", value: number(knownCountries.length) },
      { label: "Edad promedio", value: analytics.ages.average === null ? "—" : `${String(analytics.ages.average).replace(".", ",")} años`, note: analytics.ages.known ? `${number(analytics.ages.known)} con fecha de nacimiento` : "Sin fechas de nacimiento" },
      { label: "Nuevos (30 días)", value: number(analytics.newLast30Days) },
    ]} />

    <div className="ca-grid">
      <Card title="Clientes por país" action={<MetricTabs metric={countryMetric} onChange={setCountryMetric} label="Medir países por" />}>
        <RankBars rows={topWithOthers(sortedBy(analytics.countries, countryMetric), 10)} metric={countryMetric} flags label="Clientes por país" />
        {unspecifiedCountry > 0 && <p className="ca-note">{unspecifiedCountry === 1 ? "1 cliente todavía no tiene país cargado." : `${number(unspecifiedCountry)} clientes todavía no tienen país cargado.`}</p>}
      </Card>

      <Card title={`${word.plural} de ${regionCountry || "—"}`} action={<div className="ca-card-actions">
        <label className="ca-country-pick">País<select aria-label="País para ver el detalle por provincia" value={regionCountry} onChange={(event) => setPickedCountry(event.target.value)}>{knownCountries.map((row) => <option key={row.name} value={row.name}>{row.name} ({number(row.customers)})</option>)}</select></label>
        <MetricTabs metric={regionMetric} onChange={setRegionMetric} label="Medir provincias por" />
      </div>}>
        {regionCountry ? <>
          <RankBars rows={topWithOthers(regionRows, 12)} metric={regionMetric} label={`${word.plural} de ${regionCountry}`} />
          <p className="ca-note">{number(regionKnown)} de {number(regionTotal)} clientes de {regionCountry} tienen dato de {word.singular} ({percent(regionKnown, regionTotal)}).</p>
        </> : <div className="empty">Cargá el país de tus clientes para ver este detalle.</div>}
      </Card>

      <Card title="Clientes por edad">
        {analytics.ages.known ? <>
          <ColumnChart data={analytics.ages.buckets.map((bucket) => ({ label: bucket.label, value: bucket.customers }))} label="Clientes por rango de edad" />
          <p className="ca-note">Edad promedio {String(analytics.ages.average).replace(".", ",")} años · mediana {analytics.ages.median} años. {analytics.ages.known === analytics.total ? "Todos los clientes tienen fecha de nacimiento." : `Solo ${number(analytics.ages.known)} de ${number(analytics.total)} clientes (${percent(analytics.ages.known, analytics.total)}) tienen fecha de nacimiento.`}</p>
        </> : <div className="empty">Ningún cliente tiene fecha de nacimiento cargada todavía.</div>}
      </Card>

      <Card title="Clientes nuevos por mes">
        <ColumnChart data={analytics.newByMonth.map((point) => ({ label: point.label, value: point.customers }))} label="Clientes nuevos en los últimos 12 meses" color="#2f7d55" />
        <p className="ca-note">Últimos 12 meses, según la fecha de alta o de primera compra.</p>
      </Card>

      <Card title="Tipo de cliente">
        <RankBars rows={[{ name: "Minoristas", customers: analytics.retail, orders: 0 }, { name: "Mayoristas", customers: analytics.wholesale, orders: 0 }]} metric="customers" label="Minoristas y mayoristas" />
      </Card>

      <Card title="Cómo llegan los clientes" action={<MetricTabs metric={channelMetric} onChange={setChannelMetric} label="Medir canales por" />}>
        <RankBars rows={sortedBy(analytics.channels, channelMetric)} metric={channelMetric} label="Canal de origen" formatName={(name) => name === UNSPECIFIED ? name : customerOriginLabel(name)} />
      </Card>
    </div>

    <Card title="Qué tan completa está la base">
      <ol className="ca-bars ca-completeness" aria-label="Datos cargados por cliente">
        {analytics.completeness.map((row) => <li key={row.label}>
          <span className="ca-bar-label">{row.label}</span>
          <div className="ca-bar-track"><i style={{ width: `${analytics.total ? row.count / analytics.total * 100 : 0}%` }} /></div>
          <strong>{number(row.count)}</strong>
          <small>{percent(row.count, analytics.total)}</small>
        </li>)}
      </ol>
      <p className="ca-note">Los gráficos de país, provincia y edad son tan precisos como los datos cargados: cuantos más clientes tengan estos campos, mejor se ve el público.</p>
    </Card>
  </section>;
}
