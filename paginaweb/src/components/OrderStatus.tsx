"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, Clock, Package, Receipt, ShieldCheck, WarningCircle, WhatsappLogo } from "@phosphor-icons/react";
import { orderStatusDescriptions, orderStatusLabels, orderStatusTone } from "@/lib/order-status";

type OrderItem = { id: string; title: string; quantity: number; total_minor: number };
type OrderValue = {
  order_number: number;
  status: string;
  shipping_method: string;
  total_minor: number;
  currency: string;
  created_at: string;
  order_items: OrderItem[];
};

const money = (minor: number, currency = "UYU") => new Intl.NumberFormat("es-UY", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
const date = (value: string) => new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));

export function OrderStatus({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderValue | null>(null);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const load = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        const value = await response.json();
        if (!response.ok) {
          setError(value.error || "No pudimos consultar este pedido.");
          return;
        }
        setError("");
        setOrder(value as OrderValue);
        if (!stopped && value.status === "pending_payment") timer = setTimeout(load, 5_000);
      } catch {
        setError("No pudimos conectarnos para consultar el pedido.");
      }
    };

    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [orderId, retryKey]);

  if (error) {
    return (
      <div role="alert" className="border border-[var(--danger)]/30 bg-[var(--paper)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <WarningCircle size={30} className="text-[var(--danger)]" aria-hidden="true" />
        <h2 className="display-font mt-4 text-3xl">No pudimos cargar el pedido</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-black/60">{error}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="button-primary cursor-pointer" onClick={() => setRetryKey((value) => value + 1)}>Intentar nuevamente</button>
          <Link className="button-secondary" href="/perfil">Volver a mis pedidos</Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div role="status" aria-live="polite" className="overflow-hidden border border-black/15 bg-[var(--paper)] shadow-[var(--shadow-soft)]">
        <div className="h-1.5 bg-[var(--leather)]" />
        <div className="grid gap-8 p-6 motion-safe:animate-pulse sm:p-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:p-10">
          <div>
            <div className="h-3 w-28 rounded bg-black/10" />
            <div className="mt-6 h-9 max-w-xl rounded bg-black/10" />
            <div className="mt-4 h-4 w-52 rounded bg-black/10" />
            <div className="mt-10 h-24 rounded bg-black/5" />
          </div>
          <div className="h-56 rounded bg-black/10" />
        </div>
        <span className="sr-only">Consultando el estado confirmado…</span>
      </div>
    );
  }

  const status = order.status;
  const isInternational = order.shipping_method === "international_coordination";
  const isPending = status === "pending_payment";
  const isProblem = ["payment_failed", "cancelled", "refunded"].includes(status);
  const StatusIcon = isInternational ? WhatsappLogo : isPending ? Clock : isProblem ? WarningCircle : CheckCircle;
  const statusDescription = isInternational && status === "manual_review"
    ? "Tu compra internacional quedó registrada. Estamos coordinando el envío y el pago por WhatsApp."
    : orderStatusDescriptions[status] || "Estamos procesando la información de tu pedido.";

  return (
    <section className="overflow-hidden border border-black/15 bg-[var(--paper)] shadow-[var(--shadow-soft)]" aria-labelledby="order-status-title">
      <div className="h-1.5 bg-[var(--leather)]" aria-hidden="true" />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-xs font-bold tracking-[0.14em] text-[var(--walnut)] uppercase">Pedido #{order.order_number}</p>
              <span className="hidden h-4 w-px bg-black/15 sm:block" aria-hidden="true" />
              <p className="text-xs text-black/50">{date(order.created_at)}</p>
            </div>
            <span className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${orderStatusTone(status)}`}>
              <StatusIcon size={16} aria-hidden="true" />
              {orderStatusLabels[status] || status}
            </span>
          </div>

          <div className="mt-8 flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--cream-deep)] text-[var(--leather)]">
              <StatusIcon size={24} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold tracking-[0.14em] text-black/45 uppercase">Estado actual</p>
              <h2 id="order-status-title" className="display-font mt-2 max-w-3xl text-3xl leading-tight sm:text-4xl">
                {statusDescription}
              </h2>
              {isPending && (
                <p className="mt-4 flex items-center gap-2 text-xs text-black/50">
                  <span className="size-2 rounded-full bg-[var(--rawhide)]" aria-hidden="true" />
                  Esta pantalla se actualiza automáticamente.
                </p>
              )}
            </div>
          </div>

          <div className="mt-9 border-t border-black/10 pt-7">
            <p className="flex items-center gap-2 text-[0.68rem] font-semibold tracking-[0.14em] text-black/45 uppercase">
              <Receipt size={17} aria-hidden="true" />
              Resumen del pedido
            </p>
            {(order.order_items || []).length ? (
              <ul className="mt-4 divide-y divide-black/10" aria-label={`Artículos del pedido ${order.order_number}`}>
                {(order.order_items || []).map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-5 py-4 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-start gap-3">
                      <Package size={20} className="mt-0.5 shrink-0 text-[var(--leather)]" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-[var(--ink)]">{item.title}</p>
                        {item.quantity > 1 && <p className="mt-1 text-xs text-black/50">Cantidad: {item.quantity}</p>}
                      </div>
                    </div>
                    <strong className="shrink-0 text-sm tabular-nums">{money(item.total_minor, order.currency)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-black/55">El detalle de los artículos todavía se está procesando.</p>
            )}
          </div>
        </div>

        <aside className="flex flex-col justify-between bg-[var(--walnut)] p-6 text-[var(--paper)] sm:p-8 lg:p-9" aria-label="Total y navegación del pedido">
          <div>
            <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-[var(--rawhide)] uppercase">{isInternational ? "Subtotal sin envío" : "Total del pedido"}</p>
            <p className="display-font mt-3 text-4xl font-semibold tabular-nums">{money(order.total_minor, order.currency)}</p>
            <div className="mt-8 border-t border-white/15 pt-6">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {isInternational ? <WhatsappLogo size={21} weight="fill" className="text-[var(--rawhide)]" aria-hidden="true" /> : <ShieldCheck size={21} className="text-[var(--rawhide)]" aria-hidden="true" />}
                {isInternational ? "Coordinación personal" : "Estado verificado"}
              </p>
              <p className="mt-3 text-xs leading-6 text-white/65">
                {isInternational ? "El costo de envío y la forma de pago se confirman por WhatsApp antes de producir o despachar." : "El pedido cambia de estado únicamente cuando el backend verifica la notificación de Mercado Pago."}
              </p>
            </div>
          </div>
          <Link className="button-light mt-8 w-full gap-2" href="/perfil">
            Volver a mis pedidos <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </section>
  );
}
