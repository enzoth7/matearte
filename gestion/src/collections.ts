import type { Row } from "./data";
export type Field = {
  key: string;
  label: string;
  type?: "number" | "date" | "email";
  options?: string[];
};
export type Collection = {
  description: string;
  action: string;
  fields: Field[];
  rows: Row[];
  status?: string[];
};
const f = (
  key: string,
  label: string,
  type?: Field["type"],
  options?: string[],
): Field => ({ key, label, type, options });
const make = (
  description: string,
  action: string,
  fields: Field[],
  status?: string[],
): Collection => ({
  description,
  action,
  fields,
  rows: [],
  status,
});
export const collections: Record<string, Collection> = {
  "comercial/consultas": make(
    "Cada conversación tiene un próximo paso.",
    "Nueva consulta",
    [
      f("nombre", "Contacto"),
      f("canal", "Canal", undefined, ["Instagram", "WhatsApp", "Facebook"]),
      f("interes", "Interés"),
      f("responsable", "Responsable"),
      f("estado", "Estado", undefined, [
        "Nueva",
        "En conversación",
        "Convertida",
      ]),
    ],
    ["Nueva", "En conversación", "Convertida"],
  ),
  "marketing/descuentos": make(
    "Condiciones comerciales y promociones.",
    "Crear descuento",
    [
      f("codigo", "Código"),
      f("tipo", "Tipo", undefined, ["Porcentaje", "Monto UYU"]),
      f("valor", "Valor", "number"),
      f("fecha", "Vigencia", "date"),
      f("estado", "Estado", undefined, ["Activo", "Pausado"]),
    ],
    ["Activo", "Pausado"],
  ),
  "clientes/seguimiento": make(
    "Recuperá conversaciones y acompañá la próxima compra.",
    "Agregar seguimiento",
    [
      f("nombre", "Cliente"),
      f("motivo", "Motivo"),
      f("fecha", "Próximo contacto", "date"),
      f("responsable", "Responsable"),
      f("estado", "Estado", undefined, ["Pendiente", "Contactado", "Resuelto"]),
    ],
    ["Pendiente", "Contactado", "Resuelto"],
  ),
  "productos/categorias": make(
    "Familias y atributos que ordenan el catálogo compartido.",
    "Agregar categoría",
    [
      f("nombre", "Familia"),
      f("atributos", "Atributos"),
      f("variantes", "Define variantes"),
      f("estado", "Estado", undefined, ["Activa", "Inactiva"]),
    ],
    ["Activa", "Inactiva"],
  ),
  "produccion/capacidad": make(
    "Plan semanal de capacidad normal y máxima, en unidades.",
    "Agregar planificación",
    [
      f("nombre", "Equipo / proceso"),
      f("fecha", "Semana del", "date"),
      f("normal", "Capacidad normal", "number"),
      f("maxima", "Capacidad máxima", "number"),
      f("plan", "Carga planificada", "number"),
    ],
  ),
  "inventario/insumos": make(
    "Materiales críticos y puntos de reposición.",
    "Agregar insumo",
    [
      f("nombre", "Insumo"),
      f("unidad", "Unidad"),
      f("cantidad", "Disponible", "number"),
      f("minimo", "Mínimo", "number"),
      f("proveedor", "Proveedor"),
    ],
  ),
  "inventario/compras": make(
    "Órdenes de compra y gastos asociados.",
    "Nueva compra",
    [
      f("nombre", "Compra"),
      f("proveedor", "Proveedor"),
      f("importe", "Importe UYU", "number"),
      f("fecha", "Entrega estimada", "date"),
      f("estado", "Estado", undefined, [
        "Solicitada",
        "Confirmada",
        "Recibida",
      ]),
    ],
    ["Solicitada", "Confirmada", "Recibida"],
  ),
  "inventario/proveedores": make(
    "Contactos y condiciones de abastecimiento.",
    "Agregar proveedor",
    [
      f("nombre", "Proveedor"),
      f("rubro", "Rubro"),
      f("email", "Correo", "email"),
      f("plazo", "Plazo habitual"),
    ],
  ),
  "administracion/canales": make(
    "Canales y medios de pago del comercio.",
    "Agregar medio",
    [
      f("nombre", "Canal / medio"),
      f("tipo", "Tipo", undefined, ["Canal", "Medio de pago"]),
      f("detalle", "Condiciones"),
      f("estado", "Estado", undefined, ["Habilitado", "Deshabilitado"]),
    ],
    ["Habilitado", "Deshabilitado"],
  ),
  "administracion/automatizaciones": make(
    "Automatizaciones de Gestión.",
    "Diseñar regla",
    [
      f("nombre", "Regla"),
      f("disparador", "Disparador"),
      f("accion", "Acción prevista"),
      f("estado", "Estado", undefined, ["Borrador", "Lista para revisar"]),
    ],
    ["Borrador", "Lista para revisar"],
  ),
};
