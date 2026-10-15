import { useMemo, useState, type FormEvent } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import type { PageProps } from "./pages";
import { money, today, type Customer, type Product } from "./data";
import { allowedSalesChannels } from "./access";
import { commerceSource } from "./commerceSource";

type SaleLine = { product: Product; quantity: number; unitPriceMinor: number };
const cents = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);

export function LocalSaleRegister({ s, refresh, go }: PageProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomer, setNewCustomer] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [date, setDate] = useState(today);
  const [payment, setPayment] = useState("Efectivo");
  const [channel, setChannel] = useState<"Local" | "Instagram" | "Facebook" | "WhatsApp">("Local");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [city, setCity] = useState("Paysandú");
  const [country, setCountry] = useState("Uruguay");
  const [deposit, setDeposit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const customers = s.customers;
  const categories = useMemo(() => [...new Set(s.products.filter((product) => product.active && product.availableChannels?.includes("Local")).map((product) => product.family))].sort((a, b) => a.localeCompare(b, "es")), [s.products]);
  const customerMatches = useMemo(() => customers.filter((customer) => !customerSearch.trim() ||
    `${customer.name} ${customer.email || ""} ${customer.phone || ""}`.toLocaleLowerCase().includes(customerSearch.trim().toLocaleLowerCase()) || customer.id === customerId), [customers, customerSearch, customerId]);
  const matches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query && !category) return [];
    return s.products.filter((product) => product.active && product.availableChannels?.includes("Local") &&
      (!category || product.family === category) && (!query || `${product.name} ${product.sku} ${product.variant}`.toLocaleLowerCase().includes(query))).slice(0, 12);
  }, [s.products, search, category]);
  const categoryProducts = useMemo(() => s.products.filter((product) => product.active && product.availableChannels?.includes("Local") && product.family === category)
    .sort((a, b) => `${a.name} ${a.variant}`.localeCompare(`${b.name} ${b.variant}`, "es")), [s.products, category]);
  const itemsMinor = lines.reduce((sum, line) => sum + line.quantity * line.unitPriceMinor, 0);
  const depositMinor = cents(deposit);
  const add = (product: Product) => {
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      return existing ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { product, quantity: 1, unitPriceMinor: Math.round(product.prices.Local * 100) }];
    });
    setSearch(""); setError("");
  };
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commerceSource) return;
    if (!lines.length) { setError("Agregá al menos un producto."); return; }
    if (lines.length > 100 || lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000 || !Number.isInteger(line.unitPriceMinor) || line.unitPriceMinor < 0 || line.unitPriceMinor > 1000000000)) {
      setError("Revisá cantidades y precios."); return;
    }
    if (!date || date > today) { setError("Revisá la fecha de venta."); return; }
    if (payment === "Seña" && (!Number.isInteger(depositMinor) || depositMinor < 0 || depositMinor > itemsMinor)) {
      setError("La seña debe estar entre cero y el valor de los artículos."); return;
    }
    if (newCustomer && !name.trim()) { setError("Ingresá el nombre del cliente."); return; }
    setBusy(true); setError("");
    try {
      const selectedCustomer = customers.find((customer) => customer.id === customerId);
      let selectedCustomerId = selectedCustomer?.localCustomerId || null;
      if (newCustomer || (selectedCustomer && !selectedCustomer.localCustomerId)) {
        const sourceCustomer: Customer | undefined = newCustomer ? undefined : selectedCustomer;
        const sourceUserId = sourceCustomer && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceCustomer.id) ? sourceCustomer.id : null;
        const { data, error } = await commerceSource.from("local_sales_customers").insert({
          full_name: sourceCustomer?.name || name.trim(), email: sourceCustomer?.email || email.trim() || null,
          phone: sourceCustomer?.phone || phone.trim() || null,
          city: sourceCustomer?.city || city.trim() || null,
          country: sourceCustomer?.country || country.trim() || null,
          birth_date: sourceCustomer?.birthDate || birthDate || null,
          source_user_id: sourceUserId,
        }).select("id").single();
        if (error) throw new Error(error.code === "23505" ? "Ese cliente ya existe en el local. Actualizá los datos y volvé a seleccionarlo." : "No se pudo guardar el cliente.");
        selectedCustomerId = data.id;
      }
      const { data, error } = await commerceSource.rpc(channel === "Local" ? "create_local_sale_with_items" : "create_channel_sale_with_items", {
        p_customer_id: selectedCustomerId, p_sold_on: date, p_payment_method: payment,
        p_items: lines.map((line) => ({ variant_id: line.product.id, quantity: line.quantity, unit_price_minor: line.unitPriceMinor })),
        p_deposit_minor: payment === "Seña" ? depositMinor : null,
        ...(channel === "Local" ? {} : { p_channel: channel }),
      });
      if (error) throw new Error("No se pudo guardar la venta. Revisá los datos e intentá nuevamente.");
      await refresh?.();
      go(`/comercial/pedidos?pedido=${encodeURIComponent(String((data as { id: string }).id))}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la venta."); }
    finally { setBusy(false); }
  }
  return <form className="local-sale-register" onSubmit={(event) => void save(event)}>
    <section className="local-sale-section">
      <h2>Artículos</h2>
      <div className="local-sale-search"><label>Familia<select value={category} onChange={(event) => { setCategory(event.target.value); setSelectedProductId(""); }}><option value="">Todas</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>Buscar producto<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, variante o SKU" /></label></div>
      {category && <div className="local-sale-picker"><label>Producto y variante<select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}><option value="">Seleccionar del catálogo</option>{categoryProducts.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name} · {product.variant}</option>)}</select></label><button type="button" className="secondary" disabled={!selectedProductId} onClick={() => { const selected = categoryProducts.find((product) => product.id === selectedProductId); if (selected) add(selected); setSelectedProductId(""); }}>Agregar producto</button></div>}
      {(search.trim() || category) && <div className="local-sale-results">{matches.map((product) => <button type="button" key={product.id} onClick={() => add(product)}>
        <strong>{product.sku} · {product.name}</strong><small>{product.variant} · {money(product.prices.Local)}</small>
      </button>)}{!matches.length && <div className="empty">No hay variantes activas con esa búsqueda.</div>}</div>}
      {!!lines.length && <div className="local-sale-lines">{lines.map((line) => <div className="local-sale-line" key={line.product.id}>
        <div><strong>{line.product.name}</strong><small>{line.product.sku} · {line.product.variant}</small></div>
        <label>Precio<input type="number" min="0" max="10000000" step="0.01" value={line.unitPriceMinor / 100} onChange={(event) => setLines((current) => current.map((item) => item.product.id === line.product.id ? { ...item, unitPriceMinor: cents(event.target.value) } : item))} /></label>
        <label>Cantidad<input type="number" min="1" max="1000" step="1" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.product.id === line.product.id ? { ...item, quantity: Number(event.target.value) } : item))} /></label>
        <strong>{money(line.quantity * line.unitPriceMinor / 100)}</strong>
        <button type="button" className="local-sale-remove" aria-label={`Quitar ${line.product.name}`} onClick={() => setLines((current) => current.filter((item) => item.product.id !== line.product.id))}><Trash size={18} /></button>
      </div>)}</div>}
    </section>
    <section className="local-sale-section">
      <h2>Cliente y cobro</h2>
      <div className="local-sale-fields">
        <label>Canal de venta<select value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)}>{(["Local", "Instagram", "Facebook", "WhatsApp"] as const).filter((option) => option === "Local" || allowedSalesChannels(s).includes(option)).map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Buscar cliente<input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Nombre, mail o celular" /></label>
        <label>Cliente<select value={newCustomer ? "new" : customerId} onChange={(event) => { setNewCustomer(event.target.value === "new"); setCustomerId(event.target.value === "new" ? "" : event.target.value); }}>
          <option value="">Sin registrar</option>
          {customerMatches.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}{customer.localCustomerId ? "" : " · Web"}</option>)}
          <option value="new">Agregar cliente</option>
        </select></label>
        <label>Fecha<input type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label>Medio de pago<select value={payment} onChange={(event) => setPayment(event.target.value)}>{["Efectivo", "Débito", "Crédito", "Transferencia", "Seña"].map((method) => <option key={method}>{method}</option>)}</select></label>
        {payment === "Seña" && <label>Seña cobrada<input type="number" min="0" max="10000000" step="0.01" value={deposit} onChange={(event) => setDeposit(event.target.value)} required /></label>}
      </div>
      {newCustomer && <div className="local-sale-fields">
        <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></label>
        <label>Mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} /></label>
        <label>Celular<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} /></label>
        <label>Fecha de nacimiento<input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} max={today} /></label>
        <label>Ciudad<input value={city} onChange={(event) => setCity(event.target.value)} maxLength={120} /></label>
        <label>País<input value={country} onChange={(event) => setCountry(event.target.value)} maxLength={120} /></label>
      </div>}
    </section>
    <footer className="local-sale-footer">
      <div><small>Artículos</small><strong>{money(itemsMinor / 100)}</strong></div>
      {payment === "Seña" && <div><small>Seña cobrada</small><strong>{money(Number.isFinite(depositMinor) ? depositMinor / 100 : 0)}</strong></div>}
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary" disabled={busy || !lines.length}><Plus size={18} />{busy ? "Guardando…" : "Guardar venta"}</button>
    </footer>
  </form>;
}
