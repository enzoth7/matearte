import { useMemo, useState, type FormEvent } from "react";
import { CheckCircleIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { formatArg, formatUyu } from "../lib/format";
import type { DashboardData, DraftOrderItem, ViewId } from "../types";

const createDraft = (): DraftOrderItem => ({
  key: crypto.randomUUID(),
  productId: "",
  quantity: 1,
});

interface NewOrderViewProps {
  data: DashboardData;
  onAddOrder: (customer: string, items: DraftOrderItem[]) => Promise<string>;
  onNavigate: (view: ViewId) => void;
}

export function NewOrderView({ data, onAddOrder, onNavigate }: NewOrderViewProps) {
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState<DraftOrderItem[]>([createDraft()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<string | null>(null);

  const models = useMemo(() => Array.from(new Set(data.products.map((product) => product.model))), [data.products]);
  const recurrentCustomers = data.customers ?? [];
  const productMap = useMemo(() => new Map(data.products.map((product) => [product.id, product])), [data.products]);
  const selectedItems = items.filter((item) => productMap.has(item.productId));
  const totalArg = selectedItems.reduce(
    (sum, item) => sum + (productMap.get(item.productId)?.priceArg ?? 0) * Math.max(0, item.quantity || 0),
    0,
  );

  const updateItem = (key: string, patch: Partial<DraftOrderItem>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
    setError("");
    setCreatedOrder(null);
  };

  const removeItem = (key: string) => {
    setItems((current) => current.filter((item) => item.key !== key));
    setError("");
  };

  const updateCustomer = (value: string) => {
    setCustomer(value);
    setError("");
    setCreatedOrder(null);
  };

  const focusFirstProduct = () => document.getElementById(`model-${items[0]?.key}`)?.focus();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!customer.trim()) return setError("Ingresá el nombre del cliente.");
    if (items.some((item) => !item.productId || item.quantity <= 0)) return setError("Completá todos los artículos.");
    setSaving(true);
    try {
      const orderId = await onAddOrder(customer.trim(), items);
      setCreatedOrder(orderId);
      setCustomer("");
      setItems([createDraft()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo registrar el pedido.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="new-order-screen" aria-labelledby="new-order-title">
      <header className="order-page-heading">
        <h1 id="new-order-title">Encargar pedido</h1>
        <p>Ingresá los datos y confirmá desde el panel lateral.</p>
      </header>

      {createdOrder && (
        <section className="success-banner" role="status">
          <CheckCircleIcon size={24} weight="fill" aria-hidden="true" />
          <strong>Pedido {createdOrder} registrado</strong>
          <p>Ya está disponible en producción.</p>
          <button type="button" onClick={() => onNavigate("produccion")}>Ver producción</button>
        </section>
      )}

      <form className="order-entry-layout" onSubmit={handleSubmit} noValidate>
        <section className="order-form-column" aria-label="Datos del pedido">
          <header className="order-lines-heading">
            <h2>Productos del pedido</h2>
            <button type="button" onClick={() => setItems((current) => [...current, createDraft()])}>
              <PlusIcon size={18} weight="bold" aria-hidden="true" />
              Agregar artículo
            </button>
          </header>

          <div className="order-item-columns" aria-hidden="true">
            <strong>Modelo</strong>
            <strong>Variante</strong>
            <strong>Cantidad</strong>
            <strong>Importe</strong>
          </div>

          <ol className="order-item-list">
            {items.map((item, index) => {
              const product = productMap.get(item.productId);
              const selectedModel = product?.model ?? "";
              const variants = data.products.filter((candidate) => candidate.model === selectedModel);

              return (
                <li key={item.key}>
                  <div className="order-item-fields">
                    <select
                      id={`model-${item.key}`}
                      aria-label={`Modelo de la fila ${index + 1}`}
                      value={selectedModel}
                      onChange={(event) => {
                        const first = data.products.find((candidate) => candidate.model === event.target.value);
                        updateItem(item.key, { productId: first?.id ?? "" });
                      }}
                    >
                      <option value="">Seleccionar modelo</option>
                      {models.map((model) => <option key={model} value={model}>{model}</option>)}
                    </select>

                    <select
                      id={`variant-${item.key}`}
                      aria-label={`Variante de la fila ${index + 1}`}
                      value={item.productId}
                      disabled={!selectedModel}
                      onChange={(event) => updateItem(item.key, { productId: event.target.value })}
                    >
                      {!selectedModel && <option value="">Elegí un modelo</option>}
                      {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.variant}</option>)}
                    </select>

                    <input
                      id={`quantity-${item.key}`}
                      aria-label={`Cantidad de la fila ${index + 1}`}
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(event) => updateItem(item.key, { quantity: Number(event.target.value) })}
                    />

                    <output className="order-line-subtotal" aria-label={`Subtotal del artículo ${index + 1}`}>
                      {formatArg((product?.priceArg ?? 0) * Math.max(0, item.quantity || 0))}
                    </output>

                    <button
                      type="button"
                      className="icon-button remove-item"
                      aria-label={`Quitar artículo ${index + 1}`}
                      disabled={items.length === 1}
                      onClick={() => removeItem(item.key)}
                    >
                      <TrashIcon size={18} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>

          {error && <p className="form-error" role="alert">{error}</p>}
        </section>

        <aside className="order-summary-panel" aria-label="Resumen del pedido">
          <section className="order-summary-customers" aria-labelledby="customers-title">
            <h2 id="customers-title">Cliente</h2>
            <label className="order-recurrent-customer" htmlFor="recurrent-customer">
              Encargar pedido a
              <select
                id="recurrent-customer"
                value={recurrentCustomers.includes(customer) ? customer : ""}
                onChange={(event) => updateCustomer(event.target.value)}
                autoFocus
              >
                <option value="">Seleccionar cliente</option>
                {recurrentCustomers.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          </section>

          {selectedItems.length ? (
            <ul className="order-summary-list">
              {selectedItems.map((item) => {
                const product = productMap.get(item.productId);
                if (!product) return null;
                return (
                  <li key={item.key}>
                    <p>{product.model}</p>
                    <p className="order-summary-detail">{item.quantity} × {product.variant}</p>
                    <strong>{formatArg(product.priceArg * Math.max(0, item.quantity || 0))}</strong>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="order-summary-empty">
              <p>Seleccioná un modelo y una variante para armar el pedido.</p>
              <button type="button" onClick={focusFirstProduct}>Agrega primero</button>
            </div>
          )}

          <dl className="order-summary-total">
            <dt>Total estimado</dt>
            <dd>{formatArg(totalArg)}</dd>
            <dt>Conversión a UYU</dt>
            <dd>{formatUyu(totalArg * data.exchangeRate)}</dd>
          </dl>

          <button type="submit" className="order-submit" disabled={saving}>
            {saving ? "Guardando…" : "Registrar pedido"}
          </button>
        </aside>
      </form>
    </section>
  );
}
