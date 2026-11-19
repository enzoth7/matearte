// Área CRM: lo que manda `public.crm_panel()` (el CRM de WhatsApp en el esquema `crm`) y las cuentas que
// se muestran en Gestión. La base revisa el permiso de página `/crm/...`; acá solo se presenta. Puro.

export type Interes = "Alto" | "Medio" | "Bajo";

export interface CrmMensaje {
  id: string;
  de: "cliente" | "agente";
  texto: string;
  ts: number;
  plantilla: boolean;
  audio: boolean;
  manual: boolean;
}

export interface CrmLead {
  id: string;
  telefono: string;
  nombre: string;
  origen: string;
  estado: "nuevo" | "conversacion" | "visita" | "persona" | "spam";
  datos: Record<string, string | undefined>;
  motivo_persona: string | null;
  creado_en: number;
  actualizado_en: number;
  presupuesto: number | null;
  cierre: "si" | "no" | null;
  cierre_en: number | null;
  silenciado_en: number | null;
  ejemplo: boolean;
  coste_ia_usd: number;
  ms_primera_respuesta: number | null;
  mensajes: CrmMensaje[];
  notas?: { id: string; texto: string; ts: number }[];
}

export interface CrmComando {
  id: string;
  tipo: string;
  lead_id: string | null;
  estado: "pendiente" | "hecho" | "error";
  resultado: Record<string, unknown> | null;
  creado_en: string;
}

export interface CrmAsistente {
  instrucciones: string;
  hash: string;
  configuracion: { sistema?: Record<string, unknown> } & Record<string, unknown>;
  actualizado_en: string;
}

export interface CrmPanel {
  leads: CrmLead[];
  asistente: CrmAsistente | null;
  comandos: CrmComando[];
}

const HORA_MS = 3_600_000;
export const HORAS_RETOMAR = 24;
/** Tarifas de Meta para Uruguay por mensaje entregado (desde el 1 de octubre de 2026). */
const META_MARKETING_USD = 0.074;
const META_SERVICIO_USD = 0.0113;

const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Los de ejemplo solo se muestran si todavía no hay clientes reales. */
export function clientesReales(leads: CrmLead[]): CrmLead[] {
  const reales = leads.filter((l) => !l.ejemplo);
  return reales.length ? reales : leads;
}

export const nombreDe = (l: CrmLead) => l.datos.nombre_real || l.nombre;
export const canalDe = (l: CrmLead) => (l.datos.canal === "Instagram" ? "Instagram" : "WhatsApp");

export function interesDe(l: CrmLead): Interes | null {
  const v = normalizar(l.datos.calificacion ?? "");
  if (v.startsWith("alt")) return "Alto";
  if (v.startsWith("med")) return "Medio";
  if (v.startsWith("baj")) return "Bajo";
  return null;
}

const CATEGORIAS: [RegExp, string][] = [
  [/personaliz|grabad|escudo|iniciales|nombre/, "Mate personalizado"],
  [/matera/, "Matera"],
  [/bombilla/, "Bombilla"],
  [/termo/, "Termo"],
  [/yerbero/, "Yerbero"],
  [/kit/, "Kit matero"],
  [/bota/, "Botas"],
  [/cinto/, "Cinto"],
  [/billeter|tarjeter/, "Billetera"],
  [/bandolera|cartera/, "Cartera"],
  [/zueco/, "Zuecos"],
  [/empresa|corporativ|regalo empresarial/, "Regalo empresarial"],
  [/mate/, "Mate"],
];

export function categoriaDe(l: CrmLead): string | null {
  const texto = normalizar(`${l.datos.producto ?? ""} ${l.datos.personalizacion ?? ""}`);
  if (!texto) return null;
  if (normalizar(l.datos.personalizacion ?? "")) return "Mate personalizado";
  return CATEGORIAS.find(([re]) => re.test(texto))?.[1] ?? "Otro";
}

/** Costo estimado en Meta: plantillas como marketing y el resto como servicio. 0 en modo prueba. */
export function costeMetaUsd(l: CrmLead, prueba: boolean): number {
  if (prueba) return 0;
  return l.mensajes.reduce((t, m) => (m.de === "agente" ? t + (m.plantilla ? META_MARKETING_USD : META_SERVICIO_USD) : t), 0);
}

/** Índice del último mensaje del cliente, o -1 (Gestión compila con ES2022: sin findLastIndex). */
function ultimoDelCliente(mensajes: CrmMensaje[]): number {
  for (let i = mensajes.length - 1; i >= 0; i--) if (mensajes[i].de === "cliente") return i;
  return -1;
}

export function nuestrosSinRespuesta(mensajes: CrmMensaje[]): CrmMensaje[] {
  const ultimoCliente = ultimoDelCliente(mensajes);
  return ultimoCliente < 0 ? [] : mensajes.slice(ultimoCliente + 1).filter((m) => m.de === "agente");
}

/** Lo último es nuestro, sin respuesta, y no está cerrado, silenciado ni es publicidad. */
export function sePuedeRetomar(l: CrmLead): boolean {
  if (l.estado === "spam" || l.silenciado_en || l.cierre) return false;
  const ultimo = l.mensajes.at(-1);
  return !!ultimo && ultimo.de === "agente" && nuestrosSinRespuesta(l.mensajes).length > 0;
}

export function paraRetomar(leads: CrmLead[], ahora: number, horas = HORAS_RETOMAR): CrmLead[] {
  return clientesReales(leads)
    .filter((l) => sePuedeRetomar(l) && ahora - (l.mensajes.at(-1) as CrmMensaje).ts >= horas * HORA_MS)
    .sort((a, b) => (a.mensajes.at(-1)?.ts ?? 0) - (b.mensajes.at(-1)?.ts ?? 0));
}

/** La ventana de 24 h de WhatsApp: hasta cuándo se le puede escribir sin mensaje aprobado. null = cerrada. */
export function ventanaHasta(l: CrmLead): number | null {
  const i = ultimoDelCliente(l.mensajes);
  if (i < 0) return null;
  const ultimoCliente = l.mensajes[i];
  const hasta = ultimoCliente.ts + 24 * HORA_MS;
  return hasta > Date.now() ? hasta : null;
}

export function puntajePotencial(l: CrmLead, ahora: number): number {
  if (l.cierre || l.estado === "spam" || l.silenciado_en) return -1;
  const interes = interesDe(l);
  const base = interes === "Alto" ? 60 : interes === "Medio" ? 35 : interes === "Bajo" ? 10 : 20;
  const dias = (ahora - (l.mensajes.at(-1)?.ts ?? l.actualizado_en)) / 86_400_000;
  return base + Math.max(0, 30 - dias * 3) + (l.datos.producto ? 10 : 0);
}

export function categoriasBuscadas(leads: CrmLead[]): { categoria: string; total: number }[] {
  const cuenta = new Map<string, number>();
  for (const l of leads) {
    const c = categoriaDe(l);
    if (c) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  }
  return [...cuenta.entries()].map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total);
}

/** En qué etapa está, en palabras del equipo. */
export function etapaDe(l: CrmLead): { texto: string; tono: "green" | "yellow" | "red" | "blue" } {
  if (l.estado === "spam") return { texto: "Publicidad", tono: "red" };
  if (l.cierre === "si") return { texto: "Vendido", tono: "green" };
  if (l.cierre === "no") return { texto: "No sigue", tono: "red" };
  if (l.estado === "persona") return { texto: "Te toca", tono: "yellow" };
  return { texto: "Con el asistente", tono: "blue" };
}

/** Secciones «## …» de las instrucciones del asistente, en orden. */
export function seccionesDe(texto: string): { titulo: string; cuerpo: string }[] {
  return texto
    .split(/^## /m)
    .slice(1)
    .map((parte) => {
      const salto = parte.indexOf("\n");
      return { titulo: parte.slice(0, salto).trim(), cuerpo: parte.slice(salto + 1).trim() };
    });
}

/** Cambia el cuerpo de una sección «## titulo» sin tocar el resto. */
export function conSeccion(texto: string, titulo: string, cuerpo: string): string {
  const inicio = texto.indexOf(`## ${titulo}`);
  if (inicio < 0) return texto;
  const finTitulo = texto.indexOf("\n", inicio);
  const siguiente = texto.indexOf("\n## ", finTitulo);
  const fin = siguiente < 0 ? texto.length : siguiente;
  return `${texto.slice(0, finTitulo + 1)}${cuerpo.trim()}\n${texto.slice(fin)}`;
}
