import { useMemo, useState, type FormEvent } from "react";
import type { PageProps } from "./pages";
import type { Customer, Order } from "./data";
import { money, orderName, paid, balance, total } from "./data";
import { Badge, Modal, Stats, Table } from "./ui";
import { createWholesaleOrder, deleteWholesaleLine, completeWholesaleLine, nextWholesaleProductId, saveWholesaleCustomer, saveWholesaleProduct, updateWholesaleLine, type WholesaleCustomer, type WholesaleLine, type WholesaleProduct, type WholesaleSnapshot } from "./wholesaleSource";
import { exportWholesaleCsv, exportWholesalePdf, exportWholesaleXlsx } from "./wholesaleExports";

const formatArg = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value);
const errorText = (value: unknown) => value instanceof Error ? value.message : "No se pudo guardar. Volvé a intentar.";
const snapshotOf = (props: PageProps) => props.commerce?.wholesale;
const productLabel = (product: WholesaleProduct) => `${product.model} · ${product.variant}`;

export function WholesaleRegister(props: PageProps) {
  const snapshot = snapshotOf(props);
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState([{ key: crypto.randomUUID(), productId: "", quantity: 1, noCost: false }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!snapshot) return <div className="empty">Cargando producción mayorista…</div>;
  const sortedProducts = [...snapshot.products].sort((a, b) => productLabel(a).localeCompare(productLabel(b), "es"));
  const estimated = items.reduce((sum, item) => sum + (item.noCost ? 0 : Number(snapshot.products.find((product) => String(product.id) === item.productId)?.price_uyu || 0) * item.quantity), 0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      if (!items.every((item) => item.productId && Number.isInteger(item.quantity) && item.quantity > 0)) throw new Error("Revisá productos y cantidades.");
      const orderId = await createWholesaleOrder(customer, items);
      await props.refresh?.(); props.notify(`Pedido ${orderId} creado.`);
      props.go(`/comercial/pedidos?pedido=${encodeURIComponent(`wholesale:${orderId}`)}`);
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  return <section className="wholesale-form-shell">
    <div className="data-note">Los pedidos nuevos se guardan en el mismo tablero de producción mayorista y conservan el número PED-.</div>
    <form onSubmit={(event) => void submit(event)}>
      <label>Cliente
        <select required value={customer} onChange={(event) => setCustomer(event.target.value)}><option value="">Seleccionar cliente</option>{[...snapshot.customers].sort((a, b) => a.full_name.localeCompare(b.full_name, "es")).map((entry) => <option key={entry.full_name} value={entry.full_name}>{entry.full_name}</option>)}</select>
      </label>
      <div className="wholesale-form-heading"><h2>Artículos</h2><button type="button" className="secondary" onClick={() => setItems([...items, { key: crypto.randomUUID(), productId: "", quantity: 1, noCost: false }])}>Agregar artículo</button></div>
      {items.map((item, index) => <div className="wholesale-item-row" key={item.key}>
        <label>Producto {index + 1}<select required value={item.productId} onChange={(event) => setItems(items.map((row) => row.key === item.key ? { ...row, productId: event.target.value } : row))}><option value="">Seleccionar producto</option>{sortedProducts.map((product) => <option key={product.id} value={product.id}>{productLabel(product)} · {formatArg(Number(product.price_arg))}</option>)}</select></label>
        <label>Cantidad<input type="number" min="1" step="1" required value={item.quantity} onChange={(event) => setItems(items.map((row) => row.key === item.key ? { ...row, quantity: Number(event.target.value) } : row))} /></label>
        <label className="wholesale-checkbox"><input type="checkbox" checked={item.noCost} onChange={(event) => setItems(items.map((row) => row.key === item.key ? { ...row, noCost: event.target.checked } : row))} /> Sin costo</label>
        <button type="button" className="secondary compact" disabled={items.length === 1} onClick={() => setItems(items.filter((row) => row.key !== item.key))}>Quitar</button>
      </div>)}
      <div className="wholesale-form-total">Total estimado <strong>{money(estimated)}</strong></div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="form-actions"><button className="primary" type="submit" disabled={busy}>{busy ? "Guardando…" : "Crear pedido mayorista"}</button></div>
    </form>
  </section>;
}

export function WholesaleCustomerEditor({ customer, onSaved }: { customer?: Customer; onSaved: () => void }) {
  const [name, setName] = useState(customer?.wholesaleName || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [notes, setNotes] = useState(customer?.notes || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const parts = name.trim().split(/\s+/);
    const value: WholesaleCustomer = { full_name: name, first_name: parts[0], last_name: parts.slice(1).join(" "), phone, email, address, notes };
    try { await saveWholesaleCustomer(value, customer?.wholesaleName); onSaved(); }
    catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  return <form className="wholesale-editor" onSubmit={(event) => void submit(event)}>
    <label>Nombre completo<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Celular<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
    <label>Correo (opcional)<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label>Dirección<input value={address} onChange={(event) => setAddress(event.target.value)} /></label>
    <label>Notas<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    {error && <div className="error" role="alert">{error}</div>}
    <button className="primary" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar cliente"}</button>
  </form>;
}

export function WholesaleProductEditor({ product, snapshot, onSaved, onClose }: { product?: WholesaleProduct; snapshot: WholesaleSnapshot; onSaved: () => void; onClose: () => void }) {
  const [model, setModel] = useState(product?.model || "");
  const [variant, setVariant] = useState(product?.variant || "");
  const [rim, setRim] = useState(product?.rim_type || "");
  const [leather, setLeather] = useState(product?.leather_type || "");
  const [price, setPrice] = useState(String(product?.price_arg ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const id = product?.id || await nextWholesaleProductId();
      await saveWholesaleProduct({ id, model, variant, rim_type: rim, leather_type: leather, price_arg: Number(price), price_uyu: Number(price) * snapshot.exchangeRate }, product?.id);
      onSaved();
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  return <div className="wholesale-product-editor"><div className="wholesale-form-heading"><h2>{product ? "Editar variante mayorista" : "Nueva variante mayorista"}</h2><button className="secondary compact" onClick={onClose}>Cerrar</button></div>
    <form className="wholesale-editor" onSubmit={(event) => void submit(event)}>
      <label>Modelo<input required value={model} onChange={(event) => setModel(event.target.value)} /></label>
      <label>Variante<input required value={variant} onChange={(event) => setVariant(event.target.value)} /></label>
      <label>Virola<input value={rim} onChange={(event) => setRim(event.target.value)} /></label>
      <label>Cuero<input value={leather} onChange={(event) => setLeather(event.target.value)} /></label>
      <label>Precio ARS<input required type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
      <div>Equivalente UYU: <strong>{money((Number(price) || 0) * snapshot.exchangeRate)}</strong></div>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar producto"}</button>
    </form>
  </div>;
}

function WholesaleLineEditor({ line, snapshot, refresh, notify }: { line: WholesaleLine; snapshot: WholesaleSnapshot; refresh?: () => Promise<void>; notify: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [model, setModel] = useState(line.model);
  const [variant, setVariant] = useState(line.variant);
  const [quantity, setQuantity] = useState(line.quantity);
  const [status, setStatus] = useState(line.status);
  const [customer, setCustomer] = useState(line.customer);
  const [orderId, setOrderId] = useState(line.order_id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const product = snapshot.products.find((item) => item.model === line.model && item.variant === line.variant);
  async function act(action: "save" | "complete" | "delete") {
    if (action === "delete" && !window.confirm("¿Eliminar esta línea de producción? Esta acción no se puede deshacer.")) return;
    setBusy(true); setError("");
    try {
      if (action === "save") await updateWholesaleLine(line, { model, variant, quantity, status, customer, orderId });
      else if (action === "complete") await completeWholesaleLine(line.line_id);
      else await deleteWholesaleLine(line.line_id);
      setEditing(false); await refresh?.(); notify(action === "complete" ? "Línea completada" : action === "delete" ? "Línea eliminada" : "Línea actualizada");
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  return <div className="wholesale-line-editor">
    {editing ? <div className="wholesale-line-fields">
      <label>Modelo<select value={model} onChange={(event) => { setModel(event.target.value); setVariant(""); }}><option value="">Seleccionar</option>{[...new Set(snapshot.products.map((item) => item.model))].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Variante<select value={variant} onChange={(event) => setVariant(event.target.value)}><option value="">Seleccionar</option>{snapshot.products.filter((item) => item.model === model).map((item) => <option key={item.id}>{item.variant}</option>)}</select></label>
      <label>Cantidad<input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
      <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Pendiente</option><option>En producción</option></select></label>
      <label>Cliente<select value={customer} onChange={(event) => setCustomer(event.target.value)}>{snapshot.customers.map((entry) => <option key={entry.full_name}>{entry.full_name}</option>)}</select></label>
      <label>Pedido<input value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="Sin número" /></label>
      <button className="primary compact" disabled={busy || !model || !variant} onClick={() => void act("save")}>Guardar</button>
      <button className="secondary compact" onClick={() => setEditing(false)}>Cancelar</button>
    </div> : <div className="wholesale-line-summary"><span>{line.model} · {line.variant} · {line.quantity} u. · <Badge>{line.status}</Badge>{product && <small> {product.rim_type || ""} {product.leather_type || ""}</small>}</span><div className="table-actions">{line.status !== "Completado" && <><button className="secondary compact" onClick={() => setEditing(true)}>Editar</button><button className="secondary compact" disabled={busy} onClick={() => void act("complete")}>Completar</button></>}<button className="secondary compact" disabled={busy} onClick={() => void act("delete")}>Eliminar</button></div></div>}
    {error && <div className="error" role="alert">{error}</div>}
  </div>;
}

export function WholesaleOrderModal({ order, props, onClose }: { order: Order; props: PageProps; onClose: () => void }) {
  const snapshot = snapshotOf(props);
  if (!snapshot) return null;
  const customer = props.s.customers.find((item) => item.id === order.customerId);
  const lines = snapshot.lines.filter((line) => order.items?.some((item) => item.wholesaleLineId === line.line_id));
  return <Modal title={orderName(order)} onClose={onClose}>
    <div className="detail-banner"><div><small>{order.date} · Mayorista</small><h3>{customer?.name || order.customerName}</h3></div><strong>{money(total(order))}</strong></div>
    <Stats items={[{ label: "Unidades", value: order.quantity }, { label: "Cobrado", value: money(paid(props.s, order)) }, { label: "Por cobrar", value: money(balance(props.s, order)) }]} />
    <div className="wholesale-line-list">{lines.map((line) => <WholesaleLineEditor key={line.line_id} line={line} snapshot={snapshot} refresh={props.refresh} notify={props.notify} />)}</div>
    <div className="form-actions"><button className="secondary" onClick={() => exportWholesalePdf(orderName(order), lines, snapshot)}>Descargar PDF</button><button className="text-button" onClick={() => props.go(`/clientes/base?cliente=${encodeURIComponent(order.customerId)}`)}>Ver cliente</button></div>
  </Modal>;
}

export function WholesaleProduction({ props, history = false }: { props: PageProps; history?: boolean }) {
  const snapshot = snapshotOf(props);
  const [group, setGroup] = useState("Pedidos");
  const [status, setStatus] = useState("Todos");
  const [model, setModel] = useState("Todos");
  const [sort, setSort] = useState("fecha-desc");
  const [selected, setSelected] = useState<string | null>(null);
  const products = useMemo(() => new Map(snapshot?.products.map((product) => [`${product.model}\u0000${product.variant}`, product]) || []), [snapshot]);
  if (!snapshot) return <div className="empty">Cargando producción mayorista…</div>;
  const lines = snapshot.lines.filter((line) => history ? line.status === "Completado" : line.status !== "Completado")
    .filter((line) => status === "Todos" || line.status === status)
    .filter((line) => model === "Todos" || line.model === model)
    .sort((a, b) => sort === "cantidad-desc" ? b.quantity - a.quantity : sort === "cantidad-asc" ? a.quantity - b.quantity : sort === "fecha-asc" ? (a.created_at || "").localeCompare(b.created_at || "") : (b.created_at || "").localeCompare(a.created_at || ""));
  const groupKey = (line: WholesaleLine) => { const product = products.get(`${line.model}\u0000${line.variant}`); return group === "Modelo" ? line.model : group === "Variante" ? `${line.model} · ${line.variant}` : group === "Virola" ? product?.rim_type || "Sin virola" : product?.leather_type || "Sin cuero"; };
  const summaries = [...lines.reduce((map, line) => { const key = groupKey(line); const current = map.get(key) || { id: key, name: key, pending: 0, inProduction: 0, completed: 0, quantity: 0 }; current.quantity += line.quantity; if (line.status === "Pendiente") current.pending += line.quantity; else if (line.status === "Completado") current.completed += line.quantity; else current.inProduction += line.quantity; map.set(key, current); return map; }, new Map<string, { id: string; name: string; pending: number; inProduction: number; completed: number; quantity: number }>()).values()].sort((a, b) => b.quantity - a.quantity);
  const selectedOrder = props.s.orders.find((order) => order.source === "wholesale" && order.items?.some((item) => item.wholesaleLineId === selected));
  return <section className="wholesale-production">
    <Stats items={[{ label: history ? "Líneas terminadas" : "Líneas activas", value: lines.length }, { label: "Unidades", value: lines.reduce((sum, line) => sum + Number(line.quantity), 0) }, { label: "Pedidos", value: new Set(lines.map((line) => line.order_id || line.line_id)).size }]} />
    <div className="toolbar"><div className="table-actions"><label className="inline-label">Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option>{(history ? ["Completado"] : ["Pendiente", "En producción"]).map((value) => <option key={value}>{value}</option>)}</select></label><label className="inline-label">Modelo<select value={model} onChange={(event) => setModel(event.target.value)}><option>Todos</option>{[...new Set(snapshot.lines.map((line) => line.model))].sort().map((value) => <option key={value}>{value}</option>)}</select></label><label className="inline-label">Ordenar<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="fecha-desc">Más recientes</option><option value="fecha-asc">Más antiguos</option><option value="cantidad-desc">Más unidades</option><option value="cantidad-asc">Menos unidades</option></select></label></div>
      <div className="table-actions"><button className="secondary" disabled={!lines.length} onClick={() => exportWholesaleXlsx(lines, snapshot)}>Excel</button><button className="secondary" disabled={!lines.length} onClick={() => exportWholesalePdf(history ? "Histórico mayorista" : "Producción mayorista", lines, snapshot)}>PDF</button><button className="secondary" disabled={!lines.length} onClick={() => exportWholesaleCsv(lines, snapshot)}>CSV</button></div></div>
    {!history && <div className="tabs inner-tabs">{["Pedidos", "Modelo", "Variante", "Virola", "Cuero"].map((value) => <button key={value} className={group === value ? "active" : ""} onClick={() => setGroup(value)}>{value}</button>)}</div>}
    {group === "Pedidos" || history ? <Table rows={lines.map((line) => ({ ...line, id: line.line_id }))} searchText={(line) => `${line.order_id || line.line_id} ${line.customer} ${line.model} ${line.variant}`} columns={[
      { label: "Pedido", render: (line) => <button className="text-button" onClick={() => setSelected(line.line_id)}>{line.order_id || `Línea ${line.line_id}`}</button> },
      { label: "Cliente", render: (line) => line.customer }, { label: "Modelo", render: (line) => line.model }, { label: "Variante", render: (line) => line.variant },
      { label: "Cantidad", render: (line) => line.quantity }, { label: "Estado", render: (line) => <Badge>{line.status}</Badge> },
      { label: history ? "Completado" : "Creado", render: (line) => (history ? line.completed_at : line.created_at)?.slice(0, 10) || "—" },
      { label: "Acciones", render: (line) => <button className="secondary compact" onClick={() => setSelected(line.line_id)}>Ver / editar</button> },
    ]} /> : <Table rows={summaries} searchText={(row) => row.name} columns={[{ label: group, render: (row) => row.name }, { label: "Pendientes", render: (row) => row.pending }, { label: "En producción", render: (row) => row.inProduction }, { label: "Unidades", render: (row) => row.quantity }]} />}
    {selectedOrder && <WholesaleOrderModal order={selectedOrder} props={props} onClose={() => setSelected(null)} />}
  </section>;
}
