import { commerceSource } from "./commerceSource";
import type { Customer } from "./data";

/** Misma clave que usa la base para juntar los registros de una persona. */
export const contactOriginKey = (email: string, phone: string) => {
  const mail = email.trim().toLowerCase();
  if (mail) return `email:${mail}`;
  const digits = phone.replace(/[^0-9]+/g, "");
  return digits ? `phone:${digits}` : "";
};

/**
 * Si el origen se cambió a mano en la ficha, queda guardado como decisión manual: manda por encima del
 * cálculo automático (primer registro). Devuelve un mensaje de error o null.
 */
export async function saveOriginOverride(previous: Customer | undefined, form: { originChannel: string; email: string; phone: string }) {
  if (!commerceSource || !previous || !form.originChannel || form.originChannel === previous.originChannel) return null;
  const key = contactOriginKey(form.email, form.phone);
  if (!key) return null;
  const { error } = await commerceSource.rpc("gestion_set_contact_origin", { p_contact_key: key, p_origin: form.originChannel });
  return error ? "Se guardó la ficha, pero no se pudo guardar el cambio de origen." : null;
}
