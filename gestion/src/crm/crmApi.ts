// Área CRM: lectura y pedidos. Todo pasa por funciones de la base que exigen permiso de página
// `/crm/...`; Gestión nunca toca el esquema `crm` directamente. Las acciones quedan en una cola que
// toma el servidor del asistente (hoy la PC de Enzo): si está apagado, quedan pendientes.

import { supabase } from "../commerce/supabase";
import type { CrmComando, CrmPanel } from "./crmModel";

export type TipoPedido = "responder" | "enviar_seguimiento" | "cambiar_etapa" | "guardar_instrucciones" | "guardar_reglas" | "asistente_activo" | "cerrar" | "nota" | "guardar_campo" | "conexiones";

export async function cargarPanel(): Promise<CrmPanel> {
  const { data, error } = await supabase.rpc("crm_panel");
  if (error) throw new Error(error.code === "42501" ? "No tenés permiso para el CRM." : "No se pudo cargar el CRM.");
  const panel = data as Partial<CrmPanel> | null;
  return { leads: panel?.leads ?? [], asistente: panel?.asistente ?? null, comandos: panel?.comandos ?? [] };
}

export async function pedir(tipo: TipoPedido, leadId: string | null, datos: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await supabase.rpc("crm_encolar", { p_tipo: tipo, p_lead_id: leadId, p_datos: datos });
  if (error) throw new Error(error.code === "42501" ? "No tenés permiso para esta acción." : error.message || "No se pudo enviar el pedido.");
  return data as string;
}

/** Espera a que el servidor del asistente tome un pedido (hasta `ms`). null si sigue pendiente. */
export async function esperarPedido(id: string, ms = 90_000): Promise<CrmComando | null> {
  const hasta = Date.now() + ms;
  while (Date.now() < hasta) {
    await new Promise((r) => setTimeout(r, 2_500));
    const panel = await cargarPanel().catch(() => null);
    const c = panel?.comandos.find((x) => x.id === id);
    if (c && c.estado !== "pendiente" && (c.estado === "error" || c.resultado)) return c;
  }
  return null;
}

/** Manda un pedido y espera a que el servidor del asistente lo tome. */
export async function pedirYEsperar(tipo: TipoPedido, leadId: string | null, datos: Record<string, unknown>, notify: (mensaje: string) => void, listo: string) {
  try {
    const id = await pedir(tipo, leadId, datos);
    notify("Pedido enviado al asistente…");
    const c = await esperarPedido(id);
    if (!c) {
      notify("El servidor del asistente no respondió: el pedido queda pendiente hasta que se prenda.");
      return null;
    }
    if (c.estado === "error") {
      notify(String(c.resultado?.error ?? "El asistente no pudo hacerlo."));
      return null;
    }
    notify(listo);
    return c.resultado ?? {};
  } catch (e) {
    notify(e instanceof Error ? e.message : "No se pudo enviar el pedido.");
    return null;
  }
}
