"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Rate = { id: string; name: string; rate_minor: number; is_pickup: boolean; departments: string[] };
type CustomerForm = { fullName: string; phone: string; department: string; address: string };
const departments = ["Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores", "Florida", "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro", "Rivera", "Rocha", "Salto", "San José", "Soriano", "Tacuarembó", "Treinta y Tres"];
const money = (minor: number) => new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 }).format(minor / 100);

export function CheckoutForm({ initialCustomer }: { initialCustomer: CustomerForm }) {
  const [rates, setRates] = useState<Rate[]>([]);
  const [rateId, setRateId] = useState("");
  const [form, setForm] = useState(initialCustomer);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rate = useMemo(() => rates.find((item) => item.id === rateId), [rates, rateId]);

  const loadRates = useCallback(async () => {
    setRatesLoading(true); setRatesError("");
    try {
      const response = await fetch("/api/shipping-rates", { cache: "no-store" });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "No se pudieron cargar las opciones de entrega.");
      const nextRates = Array.isArray(value.rates) ? value.rates as Rate[] : [];
      if (!nextRates.length) throw new Error("No hay opciones de entrega disponibles en este momento.");
      setRates(nextRates);
      setRateId((current) => nextRates.some((item) => item.id === current) ? current : nextRates[0].id);
    } catch (reason) {
      setRates([]); setRateId("");
      setRatesError(reason instanceof Error ? reason.message : "No se pudieron cargar las opciones de entrega.");
    } finally { setRatesLoading(false); }
  }, []);

  useEffect(() => { void loadRates(); }, [loadRates]);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const idempotencyKey = crypto.randomUUID();
      sessionStorage.setItem("matearte_checkout_idempotency", idempotencyKey);
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ shippingRateId: rateId, customer: form }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "No se pudo iniciar el pago.");
      window.location.assign(value.checkoutUrl);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo iniciar el pago."); setBusy(false); }
  };

  return <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_22rem]">
    <div className="space-y-8">
      <fieldset><legend className="display-font text-3xl">Tus datos</legend><div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">Nombre completo<input name="name" autoComplete="name" required maxLength={120} value={form.fullName} onChange={(e) => update("fullName", e.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label>
        <label className="text-sm font-medium">Teléfono<input name="tel" type="tel" inputMode="tel" autoComplete="tel" required maxLength={40} value={form.phone} onChange={(e) => update("phone", e.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label>
      </div></fieldset>
      <fieldset><legend className="display-font text-3xl">Entrega</legend>{ratesLoading && <p role="status" className="mt-5 text-sm text-black/60">Cargando opciones de entrega…</p>}{ratesError && <div role="alert" className="mt-5 border border-red-700/30 p-4 text-sm text-red-800"><p>{ratesError}</p><button type="button" onClick={() => void loadRates()} className="mt-3 min-h-11 border border-red-800 px-4 font-semibold">Reintentar</button></div>}<div className="mt-5 space-y-3">{rates.map((item) => <label key={item.id} className="flex min-h-14 cursor-pointer items-center justify-between gap-4 border border-black/15 p-4"><span><input type="radio" name="rate" required checked={rateId === item.id} onChange={() => setRateId(item.id)} className="mr-3" />{item.name}</span><strong>{item.rate_minor ? money(item.rate_minor) : "Sin costo"}</strong></label>)}</div>
        {rate && !rate.is_pickup && <div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium">Departamento<select name="address-level1" autoComplete="address-level1" required value={form.department} onChange={(e) => update("department", e.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4"><option value="">Elegir…</option>{departments.map((name) => <option key={name}>{name}</option>)}</select></label><label className="text-sm font-medium">Dirección<input name="street-address" autoComplete="street-address" required maxLength={240} value={form.address} onChange={(e) => update("address", e.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label></div>}
      </fieldset>
    </div>
    <aside className="h-fit bg-[var(--paper)] p-6"><p className="eyebrow">Pago seguro</p><h2 className="display-font mt-4 text-3xl">Mercado Pago</h2><p className="mt-4 text-sm leading-6 text-black/60">Antes de redirigirte recalculamos precio, stock, envío y personalizados en el servidor.</p>{error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}<button disabled={busy || ratesLoading || !rateId} className="mt-6 min-h-12 w-full bg-[var(--walnut)] px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Preparando pago…" : "Ir a Mercado Pago"}</button></aside>
  </form>;
}
