import { useState } from "react";

export type PaymentMethod = "mercado-pago" | "transferencia";
export type PaymentMockStatus = "pending" | "confirmed" | "rejected";

interface CheckoutStepProps {
  subtotalUYU: number;
  mercadoPagoCommissionPercent: number;
  onBack: () => void;
  onContinue: () => void;
}

const statusStyles: Record<PaymentMockStatus, string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-900",
  confirmed: "border-emerald-300 bg-emerald-50 text-emerald-900",
  rejected: "border-red-300 bg-red-50 text-red-900",
};

const statusLabels: Record<PaymentMockStatus, string> = {
  pending: "Pago pendiente",
  confirmed: "Pago confirmado",
  rejected: "Pago rechazado",
};

export function CheckoutStep({ subtotalUYU, mercadoPagoCommissionPercent, onBack, onContinue }: CheckoutStepProps) {
  const [method, setMethod] = useState<PaymentMethod>("mercado-pago");
  const [status, setStatus] = useState<PaymentMockStatus>("pending");
  const commissionUYU = method === "mercado-pago" ? Math.round(subtotalUYU * mercadoPagoCommissionPercent) / 100 : 0;
  const totalUYU = subtotalUYU + commissionUYU;

  const selectMethod = (nextMethod: PaymentMethod) => {
    setMethod(nextMethod);
    setStatus("pending");
  };

  return (
    <main id="main-content" className="transaction-checkout mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
      <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950" role="note">
        Simulación visual: esta pantalla no procesa cobros, no usa credenciales y no envía el pedido a producción.
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-3xl border border-[#e7d7c1] bg-white p-5 shadow-xl shadow-[#7a4a31]/8 md:p-8">
          <div className="border-b border-[#e7d7c1] pb-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7a4a31]">Paso final</p>
            <h1 className="mt-1 font-serif text-3xl font-black text-[#2d1d14]">Elegí cómo pagar</h1>
            <p className="mt-2 text-sm text-[#5f3826]/80">Podés recorrer ambos métodos y probar sus estados antes de integrar el backend real.</p>
          </div>

          <fieldset className="mt-6 grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Método de pago</legend>
            <button type="button" onClick={() => selectMethod("mercado-pago")} aria-pressed={method === "mercado-pago"} className={`min-h-24 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a4a31] ${method === "mercado-pago" ? "border-sky-500 bg-sky-50 ring-2 ring-sky-500/15" : "border-[#e7d7c1] bg-white hover:border-sky-300"}`}>
              <span className="block text-base font-black text-[#2d1d14]">Mercado Pago</span>
              <span className="mt-1 block text-xs leading-relaxed text-[#5f3826]/75">Incluye una comisión configurable antes de confirmar.</span>
            </button>
            <button type="button" onClick={() => selectMethod("transferencia")} aria-pressed={method === "transferencia"} className={`min-h-24 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a4a31] ${method === "transferencia" ? "border-[#7a4a31] bg-[#fbf3de] ring-2 ring-[#7a4a31]/15" : "border-[#e7d7c1] bg-white hover:border-[#7a4a31]/50"}`}>
              <span className="block text-base font-black text-[#2d1d14]">Transferencia</span>
              <span className="mt-1 block text-xs leading-relaxed text-[#5f3826]/75">Sin comisión en el mock; la acreditación requiere confirmación.</span>
            </button>
          </fieldset>

          {method === "transferencia" && (
            <div className="mt-5 rounded-2xl border border-[#e7d7c1] bg-[#fdf7e9] p-4 text-sm text-[#5f3826]">
              <p className="font-black text-[#2d1d14]">Datos bancarios de demostración</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
                <dt className="font-bold">Banco</dt><dd>Pendiente de configurar</dd>
                <dt className="font-bold">Cuenta</dt><dd>•••• •••• ••••</dd>
                <dt className="font-bold">Referencia</dt><dd>Se generará con el pedido real</dd>
              </dl>
            </div>
          )}

          <div className={`mt-5 rounded-2xl border p-4 ${statusStyles[status]}`} role="status" aria-live="polite">
            <p className="text-sm font-black">{statusLabels[status]}</p>
            <p className="mt-1 text-xs">{status === "confirmed" ? "La continuación visual quedó habilitada." : status === "rejected" ? "Probá nuevamente o elegí otro método." : "La producción permanece bloqueada hasta recibir confirmación."}</p>
          </div>

          <div className="mt-5 rounded-2xl border border-dashed border-[#cdb79d] p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#7a4a31]">Controles de demostración</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => setStatus("pending")} className="min-h-11 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-900">Simular pendiente</button>
              <button type="button" onClick={() => setStatus("confirmed")} className="min-h-11 rounded-xl border border-emerald-400 bg-emerald-50 px-3 text-xs font-bold text-emerald-900">Simular confirmado</button>
              <button type="button" onClick={() => setStatus("rejected")} className="min-h-11 rounded-xl border border-red-300 bg-red-50 px-3 text-xs font-bold text-red-900">Simular rechazado</button>
            </div>
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-[#e7d7c1] bg-white p-5 shadow-xl shadow-[#7a4a31]/8 lg:sticky lg:top-24">
          <h2 className="font-serif text-xl font-black text-[#2d1d14]">Total del pedido</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between border-b border-[#e7d7c1] pb-3"><dt className="text-[#5f3826]/75">Subtotal</dt><dd className="font-bold">$ {subtotalUYU.toLocaleString("es-UY")} UYU</dd></div>
            <div className="flex justify-between border-b border-[#e7d7c1] pb-3"><dt className="text-[#5f3826]/75">Comisión ({method === "mercado-pago" ? `${mercadoPagoCommissionPercent}%` : "no aplica"})</dt><dd className="font-bold">$ {commissionUYU.toLocaleString("es-UY")} UYU</dd></div>
            <div className="flex items-end justify-between pt-2"><dt className="text-xs font-black uppercase tracking-wider text-[#7a4a31]">Total</dt><dd className="font-serif text-2xl font-black text-[#2d1d14]">$ {totalUYU.toLocaleString("es-UY")} UYU</dd></div>
          </dl>
          {method === "mercado-pago" && mercadoPagoCommissionPercent === 0 && <p className="mt-3 rounded-xl bg-[#fbf3de] p-3 text-[10px] leading-relaxed text-[#5f3826]">La comisión está en 0% hasta configurar <code>VITE_MERCADO_PAGO_COMMISSION_PERCENT</code>.</p>}
          <div className="mt-6 space-y-3">
            <button type="button" disabled={status !== "confirmed"} onClick={onContinue} className="min-h-12 w-full rounded-xl bg-[#7a4a31] px-4 text-sm font-extrabold uppercase tracking-wider text-white shadow-md transition-colors hover:bg-[#5f3826] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600">Continuar simulación</button>
            <button type="button" onClick={onBack} className="min-h-11 w-full rounded-xl border border-[#e7d7c1] bg-white px-4 text-xs font-bold text-[#5f3826] hover:bg-[#fbf3de]">Volver al resumen</button>
          </div>
        </aside>
      </div>
    </main>
  );
}
