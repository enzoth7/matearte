import { useMemo, useState, type FormEvent } from "react";
import { CaretDownIcon, CaretUpDownIcon, CaretUpIcon, MagnifyingGlassIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { formatDate, formatNumber, normalizeText } from "../lib/format";
import type { CustomerProfile, DashboardData } from "../types";

interface CustomersViewProps {
  data: DashboardData;
  onAdd: (customer: CustomerProfile) => Promise<unknown>;
  onRename: (previousCustomer: string, customer: CustomerProfile) => Promise<unknown>;
}

type CustomerSortKey = "latestPurchase" | "currentOrders" | "totalOrders";
type CustomerSortDirection = "desc" | "asc";

const emptyCustomer: CustomerProfile = {
  fullName: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

const profileFromName = (fullName: string): CustomerProfile => {
  const [firstName = fullName, ...lastName] = fullName.trim().split(/\s+/);
  return { ...emptyCustomer, fullName, firstName, lastName: lastName.join(" ") };
};

export function CustomersView({ data, onAdd, onRename }: CustomersViewProps) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerProfile>(emptyCustomer);
  const [saving, setSaving] = useState(false);
  const [customerSort, setCustomerSort] = useState<{ key: CustomerSortKey; direction: CustomerSortDirection }>({ key: "latestPurchase", direction: "desc" });

  const customerRows = useMemo(() => {
    const profiles = new Map(
      (data.customerProfiles ?? []).map((profile) => [normalizeText(profile.fullName), profile]),
    );
    const normalizedQuery = normalizeText(query);

    return (data.customers ?? []).map((fullName) => {
      const key = normalizeText(fullName);
      const profile = profiles.get(key) ?? profileFromName(fullName);
      const currentLines = data.production.filter((item) => normalizeText(item.customer) === key);
      const historyLines = data.history.filter((item) => normalizeText(item.customer) === key);
      const currentOrders = new Set(currentLines.map((item) => item.orderId ?? item.lineId)).size;
      const totalOrders = new Set(historyLines.map((item) => item.orderId ?? item.lineId)).size;
      const latestPurchase = historyLines
        .map((item) => item.createdAt)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
      return { profile, currentOrders, totalOrders, latestPurchase };
    }).filter(({ profile }) => {
      const searchable = `${profile.firstName} ${profile.lastName} ${profile.phone} ${profile.email}`;
      return !normalizedQuery || normalizeText(searchable).includes(normalizedQuery);
    }).sort((a, b) => {
      if (customerSort.key === "latestPurchase") {
        const aTime = a.latestPurchase ? new Date(a.latestPurchase).getTime() : null;
        const bTime = b.latestPurchase ? new Date(b.latestPurchase).getTime() : null;
        if (aTime === null && bTime === null) return a.profile.fullName.localeCompare(b.profile.fullName, "es");
        if (aTime === null) return 1;
        if (bTime === null) return -1;
        const comparison = aTime - bTime;
        return customerSort.direction === "desc" ? -comparison : comparison;
      }
      const comparison = a[customerSort.key] - b[customerSort.key];
      if (comparison === 0) return a.profile.fullName.localeCompare(b.profile.fullName, "es");
      return customerSort.direction === "desc" ? -comparison : comparison;
    });
  }, [customerSort, data.customerProfiles, data.customers, data.history, data.production, query]);

  const editingHistory = useMemo(() => {
    if (!editingCustomer) return { rows: [], totalOrders: 0, totalUnits: 0 };
    const customerKey = normalizeText(editingCustomer);
    const lines = data.history.filter((item) => normalizeText(item.customer) === customerKey);
    const groups = new Map<string, { model: string; orders: Set<string>; units: number }>();
    lines.forEach((item) => {
      const model = item.model.trim() || "-";
      const key = normalizeText(model);
      const current = groups.get(key) ?? { model, orders: new Set<string>(), units: 0 };
      current.orders.add(item.orderId ?? item.lineId);
      current.units += item.quantity;
      groups.set(key, current);
    });
    const rows = Array.from(groups.values())
      .map((group) => ({ model: group.model, orders: group.orders.size, units: group.units }))
      .sort((a, b) => b.units - a.units || a.model.localeCompare(b.model, "es"));
    return {
      rows,
      totalOrders: new Set(lines.map((item) => item.orderId ?? item.lineId)).size,
      totalUnits: lines.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [data.history, editingCustomer]);

  const requestCustomerSort = (key: CustomerSortKey) => {
    setCustomerSort((current) => current.key === key
      ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
      : { key, direction: "desc" });
  };

  const customerSortButton = (key: CustomerSortKey, label: string) => {
    const active = customerSort.key === key;
    const Icon = !active ? CaretUpDownIcon : customerSort.direction === "desc" ? CaretDownIcon : CaretUpIcon;
    const nextDirection = active && customerSort.direction === "desc" ? "asc" : "desc";
    const directionLabel = key === "latestPurchase"
      ? nextDirection === "desc" ? "de más nueva a más antigua" : "de más antigua a más nueva"
      : nextDirection === "desc" ? "de mayor a menor" : "de menor a mayor";
    return (
      <button type="button" className={`customer-sort-button ${active ? "is-active" : ""}`} onClick={() => requestCustomerSort(key)} aria-label={`Ordenar ${label.toLocaleLowerCase("es")} ${directionLabel}`}>
        {label}
        <Icon size={17} weight="bold" aria-hidden="true" />
      </button>
    );
  };

  const openNewCustomer = () => {
    setEditingCustomer(null);
    setForm(emptyCustomer);
    setDialogOpen(true);
  };

  const openCustomer = (profile: CustomerProfile) => {
    setEditingCustomer(profile.fullName);
    setForm(profile);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
  };

  const updateField = (field: keyof CustomerProfile, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveCustomer = async (event: FormEvent) => {
    event.preventDefault();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    if (!firstName) return;
    const customer = { ...form, firstName, lastName, fullName: `${firstName} ${lastName}`.trim() };
    setSaving(true);
    try {
      if (editingCustomer) await onRename(editingCustomer, customer);
      else await onAdd(customer);
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack customers-page">
      <PageHeader title="Clientes" description="Información comercial y datos de contacto." />

      <section className="panel customers-directory" aria-labelledby="customers-list-title">
        <header className="customers-toolbar">
          <div>
            <h2 id="customers-list-title">Clientes recurrentes</h2>
            <p>{(data.customers ?? []).length} clientes registrados</p>
          </div>
          <div className="customers-toolbar-actions">
            <div className="search-field customer-search">
              <MagnifyingGlassIcon size={19} aria-hidden="true" />
              <label className="sr-only" htmlFor="customer-search">Buscar cliente</label>
              <input
                id="customer-search"
                type="search"
                value={query}
                placeholder="Buscar cliente"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button type="button" className="button-primary" onClick={openNewCustomer}>
              <PlusIcon size={18} weight="bold" aria-hidden="true" />
              Agregar cliente
            </button>
          </div>
        </header>

        <div className="customer-column-headings">
          <strong>Nombre</strong>
          <strong>Apellido</strong>
          {customerSortButton("latestPurchase", "Última compra")}
          {customerSortButton("currentOrders", "Pedidos actuales")}
          {customerSortButton("totalOrders", "Total pedidos")}
        </div>

        {customerRows.length ? (
          <ul className="customer-directory-list">
            {customerRows.map(({ profile, currentOrders, totalOrders, latestPurchase }) => (
              <li key={profile.fullName}>
                <button type="button" onClick={() => openCustomer(profile)} aria-label={`Editar cliente ${profile.fullName}`}>
                  <strong>{profile.firstName || "-"}</strong>
                  <p>{profile.lastName || "-"}</p>
                  <time dateTime={latestPurchase ?? undefined}>{formatDate(latestPurchase)}</time>
                  <p>{currentOrders}</p>
                  <p>{totalOrders}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No encontramos clientes" description="Probá con otra búsqueda." />
        )}
      </section>

      {dialogOpen && (
        <div className="customer-dialog-layer" onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}>
          <dialog className={`customer-dialog ${editingCustomer ? "customer-history-dialog" : ""}`} open aria-modal="true" aria-labelledby="customer-dialog-title" onCancel={closeDialog}>
            <form onSubmit={saveCustomer}>
            <header>
              <div>
                <h2 id="customer-dialog-title">{editingCustomer ? "Editar cliente" : "Agregar cliente"}</h2>
                <p>Datos de contacto y seguimiento comercial.</p>
              </div>
              <button type="button" className="icon-button" aria-label="Cerrar" onClick={closeDialog}>
                <XIcon size={20} aria-hidden="true" />
              </button>
            </header>

            <div className="customer-dialog-fields">
              <label htmlFor="customer-first-name">Nombre<input id="customer-first-name" value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} autoFocus required /></label>
              <label htmlFor="customer-last-name">Apellido<input id="customer-last-name" value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} /></label>
              <label htmlFor="customer-phone">Teléfono<input id="customer-phone" type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} autoComplete="tel" /></label>
              <label htmlFor="customer-email">Email<input id="customer-email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} autoComplete="email" /></label>
              <label className="customer-field-wide" htmlFor="customer-address">Dirección<input id="customer-address" value={form.address} onChange={(event) => updateField("address", event.target.value)} autoComplete="street-address" /></label>
              <label className="customer-field-wide" htmlFor="customer-notes">Notas<textarea id="customer-notes" rows={3} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} /></label>
            </div>

            {editingCustomer && (
              <section className="customer-history-summary" aria-labelledby="customer-history-title">
                <div className="customer-history-heading">
                  <h3 id="customer-history-title">Histórico por tipo de mate</h3>
                  <p>{formatNumber(editingHistory.totalOrders)} pedidos · {formatNumber(editingHistory.totalUnits)} unidades</p>
                </div>
                {editingHistory.rows.length ? (
                  <div className="responsive-table-wrap">
                    <table className="data-table customer-history-table">
                      <thead><tr><th>Tipo de mate</th><th>Pedidos</th><th>Unidades</th></tr></thead>
                      <tbody>
                        {editingHistory.rows.map((row) => (
                          <tr key={normalizeText(row.model)}>
                            <th scope="row">{row.model}</th>
                            <td>{formatNumber(row.orders)}</td>
                            <td>{formatNumber(row.units)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr><th>Total</th><td>{formatNumber(editingHistory.totalOrders)}</td><td>{formatNumber(editingHistory.totalUnits)}</td></tr></tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="customer-history-empty">No hay pedidos históricos para este cliente.</p>
                )}
              </section>
            )}

            <footer>
              <button type="button" className="button-quiet" onClick={closeDialog}>Cancelar</button>
              <button type="submit" className="button-primary" disabled={saving || !form.firstName.trim()}>{saving ? "Guardando…" : "Guardar cliente"}</button>
            </footer>
            </form>
          </dialog>
        </div>
      )}
    </div>
  );
}
