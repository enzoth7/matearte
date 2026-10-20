import type { Customer } from "./data";
import { commerceSource } from "./commerceSource";

export async function deleteUnlinkedCustomer(customer: Customer, orderCount: number): Promise<boolean> {
  if (orderCount > 0) throw new Error(`No se puede eliminar este contacto: tiene ${orderCount} ${orderCount === 1 ? "pedido vinculado" : "pedidos vinculados"}. La ficha y el historial se conservaron.`);
  if (!commerceSource || (!customer.localCustomerId && !customer.raffleEntryId)) throw new Error("Este contacto no tiene una ficha independiente que se pueda eliminar.");
  if (!window.confirm(`¿Eliminar definitivamente a ${customer.name}? Esta acción no se puede deshacer.`)) return false;
  const expected = Number(!!customer.localCustomerId) + Number(!!customer.raffleEntryId);
  const { data, error } = await commerceSource.rpc("gestion_delete_unlinked_contact", {
    p_local_id: customer.localCustomerId || null,
    p_raffle_id: customer.raffleEntryId || null,
  });
  if (error) throw new Error(error.message);
  if (data !== expected) throw new Error("No se confirmó el borrado completo. Actualizá la base y volvé a intentar.");
  return true;
}
