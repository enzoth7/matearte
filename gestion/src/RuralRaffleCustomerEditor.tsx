import { useState, type FormEvent } from "react";
import type { Customer } from "./data";
import { commerceSource } from "./commerceSource";

const productOptions = [
  ["mates", "Mates"],
  ["bombillas", "Bombillas"],
  ["materas", "Materas"],
  ["termos", "Termos"],
  ["personalizados", "Productos personalizados"],
  ["botas", "Botas"],
  ["carteras", "Carteras"],
  ["otros-articulos-cuero", "Otros artículos en cuero"],
] as const;

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("0")) return `+598${digits.slice(1)}`;
  if (digits.length === 8) return `+598${digits}`;
  if (digits.startsWith("598") && digits.length === 11) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0")) return `+${digits}`;
  return null;
}

export function RuralRaffleCustomerEditor({ customer, onSaved }: { customer: Customer; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commerceSource || !customer.raffleEntryId) return;

    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("name") || "").trim().replace(/\s+/g, " ");
    const email = String(form.get("email") || "").trim().toLowerCase();
    const phone = normalizePhone(String(form.get("phone") || ""));
    const city = String(form.get("city") || "").trim().replace(/\s+/g, " ");
    const country = String(form.get("country") || "").trim().replace(/\s+/g, " ");
    const birthDate = String(form.get("birthDate") || "");
    const productInterest = String(form.get("productInterest") || "");
    if (fullName.length < 2 || !phone || !city || !country || !birthDate || !productOptions.some(([value]) => value === productInterest)) {
      setError("Completá nombre, celular, ciudad, país, cumpleaños y producto de interés.");
      return;
    }

    setBusy(true);
    setError("");
    const { error: saveError } = await commerceSource.from("rural_raffle_entries")
      .update({ full_name: fullName, email, phone, city, country, birth_date: birthDate, product_interest: productInterest })
      .eq("id", customer.raffleEntryId).select("id").single();
    setBusy(false);
    if (saveError) {
      setError(saveError.code === "23505" ? "Ya existe una inscripción con ese correo." : "No se pudieron guardar los cambios.");
      return;
    }
    onSaved();
  }

  return <form onSubmit={(event) => void save(event)}>
    <div className="form-grid">
      <label>Nombre y apellido<input name="name" required minLength={2} maxLength={120} autoComplete="name" defaultValue={customer.name === "Participante del sorteo" ? "" : customer.name} /></label>
      <label>Mail<input name="email" type="email" required maxLength={320} autoComplete="email" defaultValue={customer.email} /></label>
      <label>Celular<input name="phone" type="tel" required autoComplete="tel" defaultValue={customer.phone} /></label>
      <label>Ciudad<input name="city" required maxLength={120} autoComplete="address-level2" defaultValue={customer.city} /></label>
      <label>País<input name="country" required maxLength={120} autoComplete="country-name" defaultValue={customer.country} /></label>
      <label>Fecha de cumpleaños<input name="birthDate" type="date" required min="1900-01-01" defaultValue={customer.birthDate || ""} /></label>
      <label className="wide">Producto de interés<select name="productInterest" required defaultValue={customer.raffleProductInterest || ""}>
        {productOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="form-actions"><button className="primary" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button></div>
  </form>;
}
