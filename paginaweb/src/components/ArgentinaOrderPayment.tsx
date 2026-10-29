"use client";
import { useState } from "react";
import { argentinaShippingNotice } from "@/lib/argentina";
import { formatMoney } from "@/lib/money";

export function ArgentinaOrderPayment({ orderId, status, totalMinor, bank, rejectionReason }: { orderId: string; status: string; totalMinor: number; bank: Record<string, unknown>; rejectionReason: string }) {
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canUpload = status === "pending_payment" || status === "payment_failed";
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!receipt) return;
    if (receipt.size > 5 * 1024 * 1024) { setError("El comprobante supera los 5 MB."); return; }
    setBusy(true); setError("");
    try {
      const storageKey = `argentina_receipt_${orderId}`;
      const key = sessionStorage.getItem(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
      const form = new FormData(); form.set("receipt", receipt);
      const response = await fetch(`/api/orders/${orderId}/receipt`, { method: "POST", headers: { "idempotency-key": key }, body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo subir el comprobante.");
      sessionStorage.removeItem(storageKey);
      window.location.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo subir el comprobante."); } finally { setBusy(false); }
  }
  return <section className="mx-auto my-6 max-w-3xl rounded-2xl border border-black/15 bg-[var(--paper)] p-6" aria-label="Transferencia en pesos argentinos">
    <h2 className="text-2xl font-semibold">Total del pedido: {formatMoney(totalMinor, "ARS")}</h2>
    <p className="my-3">{argentinaShippingNotice}</p>
    {canUpload && <><p>Transferí el importe exacto a esta cuenta. El total de este pedido ya está fijado.</p><dl className="my-5 grid gap-3">{([['bank_name','Banco'],['account_holder','Titular'],['cbu','CBU'],['alias','Alias']] as const).map(([key,label]) => <div key={key}><dt className="text-sm">{label}</dt><dd className="break-all font-semibold select-all">{String(bank[key] || "—")}</dd></div>)}</dl>
      {rejectionReason && <p role="alert" className="my-3 text-red-800">Comprobante rechazado: {rejectionReason}. Podés adjuntar otro.</p>}
      <form onSubmit={submit} className="grid gap-4"><label>Comprobante (JPG, PNG, WebP o PDF, hasta 5 MB)<input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-2 block w-full" onChange={event => { setReceipt(event.target.files?.[0] || null); sessionStorage.removeItem(`argentina_receipt_${orderId}`); }} /></label>
        <button disabled={busy || !receipt} className="rounded-xl bg-[var(--walnut)] p-3 text-white disabled:opacity-50">{busy ? "Subiendo…" : "Enviar comprobante"}</button></form></>}
    {status === "payment_verification_pending" && <p role="status">Recibimos tu comprobante. Estamos revisando el pago.</p>}
    {error && <p role="alert" className="mt-3 text-red-800">{error}</p>}
  </section>;
}
