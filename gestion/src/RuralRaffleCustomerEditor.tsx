import { useState, type FormEvent } from "react";
import type { Customer } from "./data";
import { commerceSource } from "./commerceSource";
import { Trash } from "@phosphor-icons/react";
import { deleteUnlinkedCustomer } from "./deleteCustomer";
import { CustomerFormFields, readCustomerForm, customerInterestOptions } from "./CustomerFormFields";

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("0")) return `+598${digits.slice(1)}`;
  if (digits.length === 8) return `+598${digits}`;
  if (digits.startsWith("598") && digits.length === 11) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0")) return `+${digits}`;
  return null;
}

export function RuralRaffleCustomerEditor({ customer, onSaved, onDeleted, orderCount = 0 }: { customer: Customer; onSaved: () => void; onDeleted: () => void; orderCount?: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (busy) return;
    setBusy(true); setError("");
    try { if (await deleteUnlinkedCustomer(customer, orderCount)) onDeleted(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo eliminar el contacto."); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commerceSource || !customer.raffleEntryId) return;
    const form = readCustomerForm(event.currentTarget);
    const fullName = form.name.trim().replace(/\s+/g, " ");
    const email = form.email.trim().toLowerCase();
    const phone = normalizePhone(form.phone);
    if (fullName.length < 2 || !phone || !customerInterestOptions.includes(form.productInterest)) { setError("Completá nombre, celular y producto de interés."); return; }
    setBusy(true); setError("");
    const { error: saveError } = await commerceSource.from("rural_raffle_entries")
      .update({ full_name: fullName, company_name: form.company || null, address: form.address || null, notes: form.notes || null,
        email, phone, city: form.city || null, country: form.country || null, department: form.department || null,
        postal_code: form.postalCode || null, birth_date: form.birthDate || null, product_interest: form.productInterest,
        additional_phones: form.additionalPhones, inferred_category: form.inferredCategory || null,
        origin_channel: form.originChannel, customer_type: form.customerType })
      .eq("id", customer.raffleEntryId).select("id").single();
    setBusy(false);
    if (saveError) { setError(saveError.code === "23505" ? "Ya existe una inscripción con ese correo." : saveError.message); return; }
    onSaved();
  }
  return <form onSubmit={(event) => void save(event)}>
    <CustomerFormFields customer={{ ...customer, name: customer.name === "Participante del sorteo" ? "" : customer.name }} defaultOrigin="Sorteo" emailRequired phoneRequired nameRequired />
    {error && <div className="error" role="alert">{error}</div>}
    <div className="wholesale-customer-actions"><button className="wholesale-customer-delete" type="button" aria-label={`Eliminar ${customer.name}`} title={`Eliminar ${customer.name}`} disabled={busy} onClick={() => void remove()}><Trash size={20} aria-hidden="true" /></button><button className="primary" disabled={busy}>{busy ? "Procesando…" : "Guardar cambios"}</button></div>
  </form>;
}
