import { useState, type FormEvent } from "react";
import type { Customer } from "../data";
import { supabase } from "./supabase";
import { Trash } from "@phosphor-icons/react";
import { CustomerFormFields, readCustomerForm } from "../CustomerFormFields";
import { flagCode } from "../location";
import { saveOriginOverride } from "../contactOrigin";

export function CustomerContactEditor({ customer, orderIds, onSaved, onDeleted }: { customer: Customer; orderIds: string[]; onSaved: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (busy) return;
    if (orderIds.length) { setError(`No se puede eliminar este contacto: tiene ${orderIds.length} ${orderIds.length === 1 ? "pedido vinculado" : "pedidos vinculados"}. La ficha y el historial se conservaron.`); return; }
    if (!customer.webLeadKind || !customer.webLeadId) { setError("No se identificó una ficha Web independiente para eliminar."); return; }
    if (!window.confirm(`¿Eliminar definitivamente a ${customer.name}${customer.webLeadKind === "account" ? " y su cuenta de acceso" : " y su suscripción"}? Esta acción no se puede deshacer.`)) return;
    setBusy(true); setError("");
    try {
      const { data, error } = await supabase.rpc("gestion_delete_unpurchased_web_lead", { p_source_kind: customer.webLeadKind, p_source_id: customer.webLeadId });
      if (error) throw error;
      if (data !== true) throw new Error("No se confirmó el borrado. Actualizá la lista.");
      onDeleted();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo eliminar el contacto."); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = readCustomerForm(event.currentTarget);
    const contact = { ...form, countryCode: flagCode(form.country)?.toUpperCase() || "" };
    setBusy(true); setError("");
    try {
      if (orderIds.length) {
        const { data, error } = await supabase.rpc("gestion_update_customer_all", { order_ids: orderIds, contact });
        if (error) throw error;
        if (data !== orderIds.length) throw new Error("No se confirmaron todos los cambios. Actualizá la ficha.");
      }
      if (customer.webLeadKind && customer.webLeadId) {
        const { data, error } = await supabase.rpc("gestion_update_web_lead", { p_source_kind: customer.webLeadKind, p_source_id: customer.webLeadId, p_contact: contact });
        if (error) throw error;
        if (!data) throw new Error("No se encontró la ficha Web. Actualizá la lista.");
      } else if (!orderIds.length) throw new Error("No se identificó la ficha original de este contacto.");
      const originError = await saveOriginOverride(customer, form);
      if (originError) throw new Error(originError);
      onSaved();
    } catch (failure) { setError(failure && typeof failure === "object" && "message" in failure ? String(failure.message) : "No se pudo guardar el contacto."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save}>
    {orderIds.length > 0 && <div className="data-note">Actualiza la ficha y el contacto de sus pedidos en ambos paneles. Las direcciones de entrega históricas se conservan.</div>}
    <CustomerFormFields customer={customer} defaultOrigin="Web" emailReadOnly={customer.webLeadKind === "account"} emailRequired nameRequired />
    {error && <div role="alert" className="error">{error}</div>}
    <div className="wholesale-customer-actions"><button className="wholesale-customer-delete" type="button" aria-label={`Eliminar ${customer.name}`} title={`Eliminar ${customer.name}`} disabled={busy} onClick={() => void remove()}><Trash size={20} aria-hidden="true" /></button><button className="primary" disabled={busy}>{busy ? "Procesando…" : "Guardar contacto"}</button></div>
  </form>;
}
