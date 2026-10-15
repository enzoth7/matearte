import { useState, type FormEvent } from "react";
import type { Customer } from "./data";
import { commerceSource } from "./commerceSource";

export function LocalCustomerEditor({ customer, onSaved }: { customer?: Customer; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commerceSource || (customer && !customer.localCustomerId)) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const birthDate = String(form.get("birthDate") || "");
    const city = String(form.get("city") || "").trim();
    const country = String(form.get("country") || "").trim();
    const notes = String(form.get("notes") || "").trim();
    if (!name) { setError("Ingresá el nombre del cliente."); return; }
    setBusy(true); setError("");
    const changes = { full_name: name, email: email || null, phone: phone || null, city: city || null, country: country || null, birth_date: birthDate || null, notes };
    const { error } = customer?.localCustomerId
      ? await commerceSource.from("local_sales_customers").update(changes).eq("id", customer.localCustomerId).select("id").single()
      : await commerceSource.from("local_sales_customers").insert(changes).select("id").single();
    setBusy(false);
    if (error) { setError(error.code === "23505" ? "Ya existe un cliente con ese correo." : "No se pudieron guardar los cambios."); return; }
    onSaved();
  }
  return <form onSubmit={(event) => void save(event)}>
    <div className="form-grid">
      <label>Nombre<input name="name" required maxLength={120} defaultValue={customer?.name || ""} /></label>
      <label>Mail<input name="email" type="email" maxLength={320} defaultValue={customer?.email || ""} /></label>
      <label>Celular<input name="phone" type="tel" maxLength={40} defaultValue={customer?.phone || ""} /></label>
      <label>Fecha de nacimiento<input name="birthDate" type="date" defaultValue={customer?.birthDate || ""} /></label>
      <label>Ciudad<input name="city" maxLength={120} defaultValue={customer?.city || ""} /></label>
      <label>País<input name="country" maxLength={120} defaultValue={customer?.country || ""} /></label>
      <label className="wide">Notas<textarea name="notes" maxLength={2000} defaultValue={customer?.notes || ""} /></label>
    </div>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="form-actions"><button className="primary" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button></div>
  </form>;
}
