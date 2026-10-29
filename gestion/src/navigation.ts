export const areas = [
  {
    id: "inicio",
    name: "Inicio",
    hint: "Una mirada a todo Matearte",
    pages: [
      ["resumen", "Resumen general"],
      ["alertas", "Pendientes y alertas"],
    ],
  },
  {
    id: "comercial",
    name: "Comercial",
    hint: "De la primera consulta a la venta",
    pages: [
      ["pedidos", "Ventas y pedidos"],
      ["registrar-min", "Registrar venta min."],
      ["registrar-may", "Registrar venta may."],
      ["consultas", "Consultas y oportunidades"],
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    hint: "Suscriptores, campañas y promociones",
    pages: [
      ["campanas", "Campañas"],
      ["pauta", "Informes de pauta"],
      ["sorteo", "Sorteo"],
      ["contactos", "Leads"],
      ["suscripcion", "Suscripción"],
      ["analytics", "Analytics"],
      ["descuentos", "Descuentos y promociones"],
      ["avisos", "Avisos"],
    ],
  },
  {
    id: "clientes",
    name: "Clientes",
    hint: "Relaciones que perduran",
    pages: [
      ["base", "Base de clientes"],
      ["analitica", "Análisis de clientes"],
      ["seguimiento", "Seguimiento y reactivación"],
    ],
  },
  {
    id: "productos",
    name: "Productos",
    hint: "Un catálogo, todos los canales",
    pages: [
      ["catalogo", "Catálogo general"],
      ["servicios", "Servicios"],
      ["categorias", "Categorías y atributos"],
      ["ajustes", "Ajustes y mayoristas"],
      ["personalizador", "Configurador Personalizador"],
    ],
  },
  {
    id: "produccion",
    name: "Producción",
    hint: "Del diseño a las manos",
    pages: [
      ["resumen", "Resumen de producción"],
      ["mayorista", "Mayorista"],
      ["minorista", "Minorista"],
      ["personalizados", "Pedidos personalizados"],
      ["capacidad", "Capacidad y planificación"],
      ["historico", "Histórico"],
    ],
  },
  {
    id: "inventario",
    name: "Inventario y compras",
    hint: "Todo en su lugar",
    pages: [
      ["compras", "Compras"],
      ["stock", "Stock de productos"],
      ["insumos", "Insumos"],
      ["movimientos", "Movimientos y reservas"],
      ["reposicion", "Reposición"],
      ["proveedores", "Proveedores"],
    ],
  },
  {
    id: "entregas",
    name: "Entregas y envíos",
    hint: "El último tramo también importa",
    pages: [
      ["pendientes", "Pendientes de entrega"],
      ["retiros", "Retiros en local"],
      ["envios", "Envíos y seguimiento"],
      ["tarifas", "Tarifas y simulador"],
    ],
  },
  {
    id: "finanzas",
    name: "Finanzas",
    hint: "Claridad para decidir",
    pages: [
      ["resumen", "Resumen financiero"],
      ["cobros", "Cobros y comprobantes"],
      ["egresos", "Egresos"],
      ["por-cobrar", "Cuentas por cobrar"],
      ["por-pagar", "Cuentas por pagar"],
      ["monedas", "Monedas y cotizaciones"],
    ],
  },
  {
    id: "personal",
    name: "Personal",
    hint: "Las personas detrás de Matearte",
    pages: [
      ["organigrama", "Organigrama"],
      ["equipo", "Equipo"],
      ["horas", "Control de horas"],
    ],
  },
  {
    id: "administracion",
    name: "Administración",
    hint: "Tu espacio, a tu manera",
    pages: [
      ["usuarios", "Usuarios y permisos"],
      ["canales", "Canales y medios de pago"],
      ["origen-canal", "Canal y origen"],
      ["automatizaciones", "Automatizaciones"],
      ["links", "Links"],
      ["actividad", "Registro de actividad"],
    ],
  },
] as const;
export const paths = areas.flatMap((a) =>
  a.pages.map((p) => `/${a.id}/${p[0]}`),
);
export function resolvePath(path: string) {
  const [a, p] = path.split("/").filter(Boolean);
  const area = areas.find((x) => x.id === a);
  if (!area) return null;
  const page = area.pages.find((x) => x[0] === p);
  return page ? { area, page } : null;
}
