import { saveOriginOverride } from "./contactOrigin";
import { useState, type FormEvent } from "react";
import type { Customer } from "./data";
import { commerceSource } from "./commerceSource";
import { formatContactName } from "../../shared/contactName";
import { Trash } from "@phosphor-icons/react";
import { deleteUnlinkedCustomer } from "./deleteCustomer";
import { CustomerFormFields, readCustomerForm } from "./CustomerFormFields";
import { flagCode } from "./location";

export function LocalCustomerEditor({ customer, onSaved, onDeleted, orderCount = 0, webOrderIds = [] }: { customer?: Customer; onSaved: () => void; onDeleted?: () => void; orderCount?: number; webOrderIds?: string[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const companyOnly = !!customer?.companyName && customer.companyName.localeCompare(customer.name, "es", { sensitivity: "base" }) === 0;
  async function remove() {
    if (!customer || !onDeleted || busy) return;
    setBusy(true); setError("");
    try { if (await deleteUnlinkedCustomer(customer, orderCount)) onDeleted(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo eliminar el contacto."); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commerceSource || (customer && !customer.localCustomerId)) return;
    const form = readCustomerForm(event.currentTarget);
    const name = formatContactName(form.name);
    const companyName = form.company;
    const { email, phone, birthDate, city, country, notes, address, additionalPhones } = form;
    const inferredCategory = form.inferredCategory;
    const originChannel = form.originChannel;
    const customerType = form.customerType;
    if (!name && !companyName) { setError("Ingresá un nombre o una empresa."); return; }
    if ((customer?.raffleEntryId || webOrderIds.length) && !email) { setError("El correo es obligatorio para las fichas vinculadas a Sorteo o Web."); return; }
    setBusy(true); setError("");
    const changes = { full_name: name || companyName, company_name: companyName || null, email: email || null, phone: phone || null, city: city || null, country: country || null, department: form.department || null, postal_code: form.postalCode || null, product_interest: form.productInterest || null, birth_date: birthDate || null, address: address || null, notes, agenda_additional_phones: additionalPhones, agenda_inferred_category: inferredCategory || null, origin_channel: originChannel, customer_type: customerType };
    const { error } = customer?.localCustomerId
      ? await commerceSource.from("local_sales_customers").update(changes).eq("id", customer.localCustomerId).select("id").single()
      : await commerceSource.from("local_sales_customers").insert(changes).select("id").single();
    if (error) { setBusy(false); setError(error.code === "23505" ? "Ya existe un cliente con ese correo." : "No se pudieron guardar los cambios."); return; }
    if (customer?.raffleEntryId) {
      const raffle = await commerceSource.from("rural_raffle_entries").update({ full_name: name || companyName, company_name: companyName || null, email, phone, birth_date: birthDate || null, city: city || null, country: country || null, department: form.department || null, postal_code: form.postalCode || null, additional_phones: additionalPhones, inferred_category: inferredCategory || null, address: address || null, notes, product_interest: form.productInterest || customer.raffleProductInterest || "mates", origin_channel: originChannel, customer_type: customerType }).eq("id", customer.raffleEntryId).select("id").single();
      if (raffle.error) { setError("Se guardó la ficha principal, pero no se pudo actualizar el interés del sorteo."); setBusy(false); return; }
    }
    const contact = { name: name || companyName, email, phone, company: companyName, birthDate, city, country, address, department: form.department, postalCode: form.postalCode, countryCode: flagCode(country)?.toUpperCase() || "", notes, additionalPhones, inferredCategory, productInterest: form.productInterest, originChannel, customerType };
    if (webOrderIds.length) {
      const web = await commerceSource.rpc("gestion_update_customer_all", { order_ids: webOrderIds, contact });
      if (web.error || web.data !== webOrderIds.length) { setError("Se guardó la ficha local, pero no se pudo sincronizar el contacto con sus pedidos Web."); setBusy(false); return; }
    }
    if (customer?.webLeadKind && customer.webLeadId) {
      const webLead = await commerceSource.rpc("gestion_update_web_lead", { p_source_kind: customer.webLeadKind, p_source_id: customer.webLeadId, p_contact: contact });
      if (webLead.error || !webLead.data) { setError("Se guardó la ficha local, pero no se pudieron sincronizar sus datos Web."); setBusy(false); return; }
    }
    const originError = await saveOriginOverride(customer, form);
    if (originError) { setError(originError); setBusy(false); return; }
    setBusy(false);
    onSaved();
  }
  return <form onSubmit={(event) => void save(event)}>
    <CustomerFormFields customer={companyOnly && customer ? { ...customer, name: "" } : customer} defaultOrigin="Local" typeLocked={!customer} emailReadOnly={customer?.webLeadKind === "account"} emailRequired={Boolean(customer?.raffleEntryId || webOrderIds.length || customer?.webLeadKind)} />
    {error && <div className="error" role="alert">{error}</div>}
    <div className="wholesale-customer-actions">{customer && <button className="wholesale-customer-delete" type="button" aria-label={`Eliminar ${customer.name}`} title={`Eliminar ${customer.name}`} disabled={busy} onClick={() => void remove()}><Trash size={20} aria-hidden="true" /></button>}<button className="primary" disabled={busy}>{busy ? "Procesando…" : "Guardar cambios"}</button></div>
  </form>;
}
