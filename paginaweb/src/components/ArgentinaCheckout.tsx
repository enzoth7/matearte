"use client";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { argentinaShippingNotice } from "@/lib/argentina";
import { countryRegions } from "@/lib/countries";

export function ArgentinaCheckout({ initialCustomer }: { initialCustomer: { fullName: string; phone: string } }) {
  const locale = useLocale();
  const router = useRouter();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [customer, setCustomer] = useState({ fullName: initialCustomer.fullName, phone: initialCustomer.phone, department: "", city: "", postalCode: "", address: "", countryCode: "AR" });
  useEffect(() => { let active = true; fetch("/api/checkout/argentina", { cache: "no-store" }).then(r => r.json()).then(data => { if (active) setAvailable(Boolean(data.enabled)); }).catch(() => { if (active) setAvailable(false); }); return () => { active = false; }; }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const storageKey = "matearte_argentina_checkout";
      const key = sessionStorage.getItem(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
      const response = await fetch("/api/checkout/argentina", { method: "POST", headers: { "Content-Type": "application/json", "idempotency-key": key }, body: JSON.stringify({ customer, locale }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo crear el pedido.");
      sessionStorage.removeItem(storageKey);
      window.dispatchEvent(new Event("cart-updated"));
      router.push({ pathname: "/pedidos/[id]", params: { id: result.orderId } });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo crear el pedido."); } finally { setBusy(false); }
  }
  const field = "mt-2 w-full rounded-xl border border-black/20 bg-white p-3";
  return <section className="mx-auto max-w-3xl px-5 py-8">
    <h1 className="display-font text-4xl">Compra por unidad · Argentina</h1>
    <p className="mt-4">Vas a pagar por transferencia a una cuenta argentina, en ARS. En el siguiente paso verás el total definitivo y los datos bancarios, y podrás adjuntar tu comprobante.</p>
    <p className="my-5 rounded-xl bg-amber-50 p-4">{argentinaShippingNotice}</p>
    {available === null ? <p>Cargando…</p> : !available ? <p role="status">Las compras para Argentina todavía no están habilitadas.</p> : <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      {([['fullName','Nombre completo'],['phone','Teléfono'],['city','Localidad'],['postalCode','Código postal'],['address','Dirección']] as const).map(([key,label]) => <label key={key}>{label}<input className={field} required maxLength={key === "address" ? 240 : 120} type={key === "phone" ? "tel" : "text"} value={customer[key]} onChange={event => setCustomer({ ...customer, [key]: event.target.value })} /></label>)}
      <label>Provincia<select required className={field} value={customer.department} onChange={event => setCustomer({ ...customer, department: event.target.value })}><option value="">Elegí tu provincia</option>{countryRegions("AR").map(region => <option key={region.code} value={region.name}>{region.name}</option>)}</select></label>
      {error && <p role="alert" className="sm:col-span-2 text-red-800">{error}</p>}
      <button disabled={busy} className="rounded-xl bg-[var(--walnut)] px-5 py-4 text-white disabled:opacity-50 sm:col-span-2">{busy ? "Preparando pedido…" : "Confirmar pedido y ver datos para transferir"}</button>
    </form>}
  </section>;
}
