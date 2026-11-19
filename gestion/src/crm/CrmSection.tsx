// Área CRM de Gestión: el CRM de WhatsApp de MateArte (asistente con IA). Lee con `crm_panel` y pide
// acciones con `crm_encolar`; las dos exigen permiso de página `/crm/...` en la base. Las acciones las
// ejecuta el servidor del asistente (hoy la PC de Enzo): si está apagado, quedan pendientes y se avisa.
// Sin <p> ni <span> (AGENTS.md).

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge, Card, downloadCsv } from "../ui";
import { TablaCrm, type ColumnaCrm } from "./TablaCrm";
import { cargarPanel, pedirYEsperar, type TipoPedido } from "./crmApi";
import { Agente, Ajustes } from "./CrmAgente";
import {
  canalDe, categoriaDe, categoriasBuscadas, clientesReales, conSeccion, costeMetaUsd, etapaDe, interesDe, nombreDe,
  paraRetomar, puntajePotencial, sePuedeRetomar, seccionesDe, ventanaHasta, type CrmLead, type CrmPanel, type Interes,
} from "./crmModel";
import "./crm.css";

type Notificar = (mensaje: string) => void;

const pesos = (n: number) => `UYU ${new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(n)}`;
const dolares = (n: number) => `USD ${n.toFixed(2)}`;
const fecha = (ms: number) => new Intl.DateTimeFormat("es-UY", { timeZone: "America/Montevideo", day: "2-digit", month: "2-digit", year: "numeric" }).format(ms);
const hora = (ms: number) => new Intl.DateTimeFormat("es-UY", { timeZone: "America/Montevideo", hour: "2-digit", minute: "2-digit" }).format(ms);
function hace(ms: number): string {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}
/** Cuánto falta hasta `ms`, en minutos u horas. */
function restante(ms: number): string {
  const min = Math.max(0, Math.round((ms - Date.now()) / 60_000));
  return min < 60 ? `${min} min` : `${Math.round(min / 60)} h`;
}
const ultimoTs = (l: CrmLead) => l.mensajes.at(-1)?.ts ?? l.actualizado_en;
const iniciales = (nombre: string) => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
function cuando(ms: number): string {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo" }).format(Date.now());
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo" }).format(ms);
  return dia === hoy ? `Hoy, ${hora(ms)}` : `${fecha(ms)}, ${hora(ms)}`;
}
const TONO_INTERES: Record<Interes, "green" | "yellow" | "red"> = { Alto: "green", Medio: "yellow", Bajo: "red" };
const Interes = ({ l }: { l: CrmLead }) => {
  const i = interesDe(l);
  return i ? <Badge tone={TONO_INTERES[i]}>{i}</Badge> : <>—</>;
};

/** El panel, recargado cada 15 s. */
function usePanel() {
  const [panel, setPanel] = useState<CrmPanel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recargar = useCallback(async () => {
    try {
      setPanel(await cargarPanel());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el CRM.");
    }
  }, []);
  useEffect(() => {
    void recargar();
    const t = setInterval(() => void recargar(), 15_000);
    return () => clearInterval(t);
  }, [recargar]);
  return { panel, error, recargar };
}

export function CrmSection({ page, notify }: { page: string; notify: Notificar }) {
  const { panel, error, recargar } = usePanel();
  // El cliente abierto en el panel lateral: se abre tocando su nombre en cualquier pestaña.
  const [abierto, setAbierto] = useState<string | null>(null);
  const cerrarPanel = useCallback(() => setAbierto(null), []);
  if (!panel) return <Card title="CRM">{error ?? "Cargando el CRM…"}</Card>;
  const actualizado = panel.asistente ? Date.parse(panel.asistente.actualizado_en) : 0;
  const apagado = !actualizado || Date.now() - actualizado > 2 * 60_000;
  return (
    <div className="crm-area">
      {apagado && (
        <div className="crm-aviso" role="status">
          El servidor del asistente no está conectado{actualizado ? ` (última señal ${hace(actualizado)})` : ""}. Se puede ver todo, pero las respuestas y los cambios quedan pendientes hasta que se prenda.
        </div>
      )}
      {page === "inicio" && <Inicio panel={panel} abrir={setAbierto} />}
      {page === "clientes" && <Clientes panel={panel} abrir={setAbierto} />}
      {page === "seguimiento" && <Seguimiento panel={panel} abrir={setAbierto} />}
      {page === "leads" && <Leads panel={panel} abrir={setAbierto} />}
      {page === "agente" && <Agente panel={panel} notify={notify} recargar={recargar} />}
      {page === "ajustes" && <Ajustes panel={panel} notify={notify} recargar={recargar} />}
      {abierto && panel.leads.some((l) => l.id === abierto) && (
        <Charla lead={panel.leads.find((l) => l.id === abierto) as CrmLead} notify={notify} recargar={recargar} cerrar={cerrarPanel} />
      )}
    </div>
  );
}

// ---- Inicio: como en el CRM (cuatro KPI de color, lo más importante y el top 10) ----

type Abrir = (id: string) => void;
const NombreBoton = ({ l, abrir }: { l: CrmLead; abrir: Abrir }) => (
  <button type="button" className="crm-nombre" onClick={() => abrir(l.id)}>{nombreDe(l)}</button>
);

function Inicio({ panel, abrir }: { panel: CrmPanel; abrir: Abrir }) {
  const ahora = Date.now();
  const leads = clientesReales(panel.leads).filter((l) => l.estado !== "spam");
  const prueba = (panel.asistente?.configuracion as { modoWhatsApp?: string } | undefined)?.modoWhatsApp === "prueba";
  const mes = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit" }).format(ms);
  const esteMes = mes(ahora);
  const delMes = leads.filter((l) => mes(l.creado_en) === esteMes);
  const ventas = leads.filter((l) => l.cierre === "si" && l.cierre_en && mes(l.cierre_en) === esteMes);
  const costoIa = leads.reduce((t, l) => t + (l.coste_ia_usd ?? 0), 0);
  const costoMeta = leads.reduce((t, l) => t + costeMetaUsd(l, prueba), 0);
  const cerrados = leads.filter((l) => l.cierre);
  const conversion = cerrados.length ? Math.round((100 * cerrados.filter((l) => l.cierre === "si").length) / cerrados.length) : null;
  const conInteres = leads.filter((l) => interesDe(l));
  const buscadas = categoriasBuscadas(leads).slice(0, 3);
  const esperan = leads.filter((l) => l.estado === "persona" && !l.cierre).length;
  const respuestas = leads.map((l) => l.ms_primera_respuesta).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
  const mediana = respuestas.length ? respuestas[Math.floor(respuestas.length / 2)] : null;
  const potenciales = leads.map((l) => ({ l, p: puntajePotencial(l, ahora) })).filter((x) => x.p >= 0).sort((a, b) => b.p - a.p).slice(0, 10).map((x) => x.l);

  const kpis: { titulo: string; valor: string | number; detalle: string; tono: string }[] = [
    { titulo: "Leads del mes", valor: delMes.length, detalle: `${leads.length} en total`, tono: "azul" },
    { titulo: "Ventas del mes", valor: ventas.length, detalle: pesos(ventas.reduce((t, l) => t + (l.presupuesto ?? 0), 0)), tono: "verde" },
    { titulo: "Para retomar", valor: paraRetomar(panel.leads, ahora).length, detalle: "sin respuesta hace 24 h o más", tono: "neutro" },
    { titulo: "Costo total", valor: dolares(costoIa + costoMeta), detalle: `IA ${dolares(costoIa)}, Meta ${dolares(costoMeta)}`, tono: "rojo" },
  ];
  const datos: { titulo: string; valor: string; texto: string; alerta?: boolean }[] = [
    { titulo: "Lo que más buscan", valor: buscadas[0]?.categoria ?? "—", texto: buscadas.map((b) => `${b.categoria} ${b.total}`).join(", ") || "Todavía no hay datos de lo que buscan." },
    { titulo: "Interés alto", valor: conInteres.length ? `${conInteres.filter((l) => interesDe(l) === "Alto").length} de ${conInteres.length}` : "—", texto: conInteres.length ? "clientes calificados con interés alto" : "El asistente todavía no calificó a nadie." },
    { titulo: "Conversión", valor: conversion === null ? "—" : `${conversion} %`, texto: conversion === null ? "Todavía no hay charlas cerradas." : "de las charlas cerradas terminaron en venta" },
    { titulo: "Esperan al equipo", valor: String(esperan), texto: esperan ? `${esperan === 1 ? "cliente espera" : "clientes esperan"} respuesta de una persona` : "Nadie espera a una persona ahora.", alerta: esperan > 0 },
    { titulo: "Velocidad", valor: mediana === null ? "—" : mediana < 60_000 ? `${Math.round(mediana / 1000)} s` : `${Math.round(mediana / 60_000)} min`, texto: mediana === null ? "Sin datos de tiempo de respuesta." : "tarda el asistente en contestar, de mediana" },
  ];
  const columnas: ColumnaCrm<CrmLead>[] = [
    { id: "cliente", titulo: "Cliente", ancho: 16, celda: (l) => <NombreBoton l={l} abrir={abrir} /> },
    { id: "canal", titulo: "Canal", ancho: 14, celda: (l) => <Badge tone="green">{canalDe(l)}</Badge> },
    { id: "categoria", titulo: "Categoría", ancho: 14, celda: (l) => categoriaDe(l) ?? "—" },
    { id: "producto", titulo: "Producto", ancho: 28, celda: (l) => l.datos.producto ?? "—" },
    { id: "interes", titulo: "Interés", ancho: 11, celda: (l) => <Interes l={l} /> },
    { id: "ultima", titulo: "Última charla", ancho: 17, celda: (l) => hace(ultimoTs(l)) },
  ];
  return (
    <>
      <dl className="crm-kpis cuatro">
        {kpis.map((k) => (
          <div key={k.titulo} className={`crm-kpi ${k.tono}`}>
            <dt>{k.titulo}</dt>
            <dd>{k.valor}</dd>
            <dd className="crm-kpi-detalle">{k.detalle}</dd>
          </div>
        ))}
      </dl>
      <section className="crm-seccion" aria-labelledby="crm-importante">
        <h2 id="crm-importante">Lo más importante</h2>
        <ul className="crm-datos">
          {datos.map((d) => (
            <li key={d.titulo} className={d.alerta ? "alerta" : ""}>
              <strong>{d.titulo}</strong>
              <div className="crm-valor">{d.valor}</div>
              <div>{d.texto}</div>
            </li>
          ))}
        </ul>
      </section>
      <section className="crm-seccion" aria-labelledby="crm-top">
        <h2 id="crm-top">Top 10 clientes potenciales</h2>
        <TablaCrm filas={potenciales} columnas={columnas} vacio="Todavía no hay clientes abiertos." />
      </section>
    </>
  );
}

// ---- Clientes: tablero de tres columnas y la charla en un panel lateral ----


/** Las tres columnas, como en el CRM: con el asistente, para retomar y te toca. */
function columnasDelTablero(leads: CrmLead[]) {
  const retomar = new Set(paraRetomar(leads, Date.now()).map((l) => l.id));
  const abiertos = clientesReales(leads).filter((l) => !l.cierre && l.estado !== "spam").sort((a, b) => ultimoTs(b) - ultimoTs(a));
  return [
    { id: "asistente", titulo: "Con tu asistente", leads: abiertos.filter((l) => l.estado !== "persona" && !retomar.has(l.id)) },
    { id: "retomar", titulo: "Para retomar", leads: abiertos.filter((l) => l.estado !== "persona" && retomar.has(l.id)) },
    { id: "persona", titulo: "Te toca", leads: abiertos.filter((l) => l.estado === "persona") },
  ];
}

function Clientes({ panel, abrir }: { panel: CrmPanel; abrir: Abrir }) {
  const columnas = useMemo(() => columnasDelTablero(panel.leads), [panel.leads]);
  return (
    <>
      <div className="crm-tablero">
        {columnas.map((c) => (
          <section key={c.id} className={`crm-columna ${c.id}`} aria-labelledby={`crm-col-${c.id}`}>
            <h2 id={`crm-col-${c.id}`}>
              {c.titulo} <small>{c.leads.length}</small>
            </h2>
            <div className="crm-bandeja">
              {c.leads.map((l) => (
                <button key={l.id} type="button" className="crm-tarjeta" onClick={() => abrir(l.id)}>
                  <div className="crm-avatar" aria-hidden>{iniciales(nombreDe(l))}</div>
                  <div className="crm-tarjeta-cuerpo">
                    <div className="crm-tarjeta-fila">
                      <strong>{nombreDe(l)}</strong>
                      <time>{cuando(ultimoTs(l))}</time>
                    </div>
                    <div className="crm-tarjeta-fila">
                      <div className="crm-tarjeta-resumen">{[l.datos.entrega, l.datos.producto].filter(Boolean).join(" · ") || l.datos.producto || "Sin datos todavía"}</div>
                      <Badge tone="green">{canalDe(l)}</Badge>
                    </div>
                    <div className={`crm-tarjeta-pie ${c.id}`}>
                      {c.id === "persona" ? l.motivo_persona || "Te toca responder" : `${l.mensajes.at(-1)?.de === "cliente" ? "" : "Tu asistente: "}${l.mensajes.at(-1)?.texto ?? ""}`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

// ---- El panel lateral de un cliente: la charla a la izquierda y la ficha a la derecha (como en el CRM) ----

const ETIQUETAS_DATOS: Record<string, string> = {
  entrega: "Envío o retiro",
  cantidad: "Cantidad",
  producto: "Producto de interés",
  personalizacion: "Personalización",
  como_paga: "Cómo paga",
  nombre_real: "Nombre real",
  plazo: "Plazo",
  calificacion: "Calificación",
};
const MOTIVOS_NO_SIGUE = ["Precio", "Se lo ha pensado", "Ha elegido a otro", "No contesta", "Otro"];

function telefonoLindo(t: string): string {
  const d = t.replace(/\D/g, "");
  return d.startsWith("598") && d.length === 11 ? `+598 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : `+${d}`;
}

function TagPago({ pago }: { pago: string }) {
  const p = pago.toLowerCase();
  const tono = p.includes("transfer") ? "blue" : p.includes("efectivo") ? "green" : undefined;
  return <Badge tone={tono}>{pago}</Badge>;
}

function Charla({ lead, notify, recargar, cerrar }: { lead: CrmLead; notify: Notificar; recargar: () => Promise<void>; cerrar: () => void }) {
  const [texto, setTexto] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [menu, setMenu] = useState<null | "lista" | "si" | "no">(null);
  const [importe, setImporte] = useState("");
  const [motivo, setMotivo] = useState(MOTIVOS_NO_SIGUE[0]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && (menu ? setMenu(null) : cerrar());
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [cerrar, menu]);
  const etapa = etapaDe(lead);
  const ultimo = lead.mensajes.at(-1);
  const accion = async (tipo: TipoPedido, datos: Record<string, unknown>, listo: string) => {
    setEnviando(true);
    setMenu(null);
    const r = await pedirYEsperar(tipo, lead.id, datos, notify, listo);
    setEnviando(false);
    if (r && tipo === "responder") setTexto("");
    if (r && tipo === "nota") setNota("");
    await recargar();
  };
  const sugerir = async () => {
    setEnviando(true);
    const r = await pedirYEsperar("enviar_seguimiento", lead.id, { sugerir: true }, notify, "Mensaje redactado: revisalo antes de enviar.");
    setEnviando(false);
    if (r && typeof r.texto === "string") setTexto(r.texto);
  };
  const quiere = [lead.datos.entrega, lead.datos.cantidad, lead.datos.producto].filter(Boolean).join(" · ");
  const siguiente = lead.cierre === "si" ? "Vendido" : lead.cierre === "no" ? "No sigue" : lead.estado === "persona" ? lead.motivo_persona || "Te toca responder" : "Hablando con tu asistente";

  return (
    <div className="crm-cortina" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <section className="crm-panel" role="dialog" aria-modal="true" aria-label={`Charla con ${nombreDe(lead)}`}>
        <header className="crm-panel-cabecera">
          <div className="crm-avatar grande" aria-hidden>{iniciales(nombreDe(lead))}</div>
          <div className="crm-panel-titulo">
            <h2>{nombreDe(lead)}</h2>
            <div>Te escribió por {canalDe(lead)} · {cuando(lead.creado_en)}</div>
          </div>
          <div className="crm-etapa">
            <button type="button" className={`crm-pastilla ${etapa.tono}`} aria-haspopup="menu" aria-expanded={menu !== null} disabled={enviando} onClick={() => setMenu(menu ? null : "lista")}>
              {etapa.texto}
            </button>
            {menu && (
              <div className="crm-etapa-menu" role="menu">
                {menu === "lista" && (
                  <>
                    {lead.estado === "persona" ? (
                      <button type="button" role="menuitem" onClick={() => void accion("cambiar_etapa", { a: "asistente" }, "La charla vuelve al asistente.")}>Devolver a tu asistente</button>
                    ) : (
                      <button type="button" role="menuitem" onClick={() => void accion("cambiar_etapa", { a: "persona" }, "Ahora la charla la lleva el equipo.")}>Lo llevo yo</button>
                    )}
                    {!lead.cierre && <button type="button" role="menuitem" onClick={() => setMenu("si")}>Ha dicho que sí</button>}
                    {!lead.cierre && <button type="button" role="menuitem" onClick={() => setMenu("no")}>No sigue</button>}
                    {lead.cierre && <button type="button" role="menuitem" onClick={() => void accion("cerrar", { accion: "reabrir" }, "Charla reabierta.")}>Reabrir</button>}
                    {lead.estado !== "spam" && <button type="button" role="menuitem" onClick={() => void accion("cambiar_etapa", { a: "spam" }, "Marcado como publicidad.")}>Es publicidad</button>}
                  </>
                )}
                {menu === "si" && (
                  <form className="crm-etapa-form" onSubmit={(e) => { e.preventDefault(); const n = Number(importe); if (Number.isInteger(n) && n >= 0) void accion("cerrar", { accion: "si", importe: n }, "Venta registrada."); else notify("Escribí el importe en pesos, sin decimales."); }}>
                    <label>Importe de la venta (UYU)<input type="number" min={0} step={1} value={importe} onChange={(e) => setImporte(e.target.value)} autoFocus /></label>
                    <button type="submit" className="primary">Guardar venta</button>
                  </form>
                )}
                {menu === "no" && (
                  <form className="crm-etapa-form" onSubmit={(e) => { e.preventDefault(); void accion("cerrar", { accion: "no", motivo }, "Marcado como no sigue."); }}>
                    <label>Motivo<select value={motivo} onChange={(e) => setMotivo(e.target.value)}>{MOTIVOS_NO_SIGUE.map((m) => <option key={m}>{m}</option>)}</select></label>
                    <button type="submit" className="primary">Guardar</button>
                  </form>
                )}
              </div>
            )}
          </div>
          <button type="button" className="crm-cerrar" onClick={cerrar} aria-label="Cerrar">×</button>
        </header>

        <div className="crm-panel-cuerpo">
          <div className="crm-panel-charla">
            <ol className="crm-burbujas">
              {lead.mensajes.map((m) => (
                <li key={m.id} className={m.de === "cliente" ? "cliente" : "nuestro"}>
                  {m.de !== "cliente" && <small className="crm-quien">{m.manual ? "Vos" : "Tu asistente"}</small>}
                  <div className="crm-burbuja">
                    {m.texto}
                    <small className="crm-hora">{hora(m.ts)}{m.de !== "cliente" ? " ✓" : ""}{m.audio ? " · audio" : ""}</small>
                  </div>
                </li>
              ))}
            </ol>
            <form
              className="crm-escribir"
              onSubmit={(e) => {
                e.preventDefault();
                if (texto.trim()) void accion("responder", { texto: texto.trim() }, "Mensaje enviado por WhatsApp.");
              }}
            >
              <div className="crm-escribir-fila">
                <div className="crm-escribir-estado">{ultimo && ultimo.de !== "cliente" ? `Sin respuesta todavía, ${hace(ultimo.ts)}` : ultimo ? `Te escribió ${hace(ultimo.ts)}` : ""}</div>
                <button type="button" className="crm-sugerir" disabled={enviando} onClick={() => void sugerir()}>Sugerir mensaje</button>
              </div>
              <div className="crm-escribir-fila">
                <textarea aria-label={`Mensaje para ${nombreDe(lead)}`} rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={`Escribí un seguimiento para ${nombreDe(lead)} o pedí una sugerencia`} />
                <button type="submit" className="crm-enviar" aria-label="Enviar" disabled={enviando || !texto.trim()}>
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 12 20 4l-4 16-4-7-8-1Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
                </button>
              </div>
              <small className="crm-escribir-nota">Revisalo antes de enviar: sale por WhatsApp desde el número del negocio.</small>
            </form>
          </div>

          <aside className="crm-panel-ficha" aria-label="Ficha">
            <h3>Ficha</h3>
            <dl className="crm-fila-datos">
              <div><dt>Quiere</dt><dd>{quiere || "—"}</dd></div>
              <div><dt>Siguiente</dt><dd className={lead.estado === "persona" && !lead.cierre ? "crm-atencion" : ""}>{siguiente}</dd></div>
            </dl>
            <div className="crm-telefono">
              <strong>{telefonoLindo(lead.telefono)}</strong>
              <div className="crm-telefono-botones">
                <a href={`tel:+${lead.telefono.replace(/\D/g, "")}`}>Llamar</a>
                <button type="button" onClick={() => void navigator.clipboard.writeText(`+${lead.telefono.replace(/\D/g, "")}`).then(() => notify("Teléfono copiado."))}>Copiar</button>
              </div>
              {lead.ms_primera_respuesta !== null && <small>Contestado en {(lead.ms_primera_respuesta / 1000).toLocaleString("es-UY", { maximumFractionDigits: 1 })} s</small>}
            </div>
            <dl className="crm-fila-datos">
              {Object.entries(lead.datos)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{ETIQUETAS_DATOS[k] ?? k.replace(/_/g, " ")}</dt>
                    <dd>{k === "como_paga" ? <TagPago pago={v as string} /> : k === "calificacion" ? <Interes l={lead} /> : v}</dd>
                  </div>
                ))}
            </dl>
            <div className="crm-notas">
              <h3>Notas</h3>
              <small>Solo las ve el equipo; el cliente, nunca.</small>
              {(lead.notas ?? []).map((n) => (
                <div key={n.id} className="crm-nota">{n.texto}<small>{cuando(n.ts)}</small></div>
              ))}
              <textarea aria-label="Nota nueva" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Algo que quieras recordar de este cliente" />
              <button type="button" disabled={enviando || !nota.trim()} onClick={() => void accion("nota", { texto: nota.trim() }, "Nota guardada.")}>Guardar</button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

// ---- Seguimiento: todas las charlas sin concretar donde lo último es nuestro ----

function Seguimiento({ panel, abrir }: { panel: CrmPanel; abrir: Abrir }) {
  const filas = clientesReales(panel.leads)
    .filter(sePuedeRetomar)
    .sort((a, b) => ultimoTs(a) - ultimoTs(b));
  const prueba = (panel.asistente?.configuracion as { modoWhatsApp?: string } | undefined)?.modoWhatsApp === "prueba";
  const columnas: ColumnaCrm<CrmLead>[] = [
    { id: "cliente", titulo: "Cliente", ancho: 11, celda: (l) => <NombreBoton l={l} abrir={abrir} /> },
    { id: "canal", titulo: "Canal", ancho: 9, celda: (l) => <Badge tone="green">{canalDe(l)}</Badge> },
    {
      id: "categoria",
      titulo: "Categoría",
      ancho: 14,
      celda: (l) => (
        <div className="crm-celda">
          {categoriaDe(l) ?? "Sin dato"}
          {l.datos.producto && <small>{l.datos.producto}</small>}
        </div>
      ),
    },
    { id: "interes", titulo: "Interés", ancho: 7, celda: (l) => <Interes l={l} /> },
    { id: "ultimo", titulo: "Lo último que le dijimos", ancho: 24, celda: (l) => <div className="crm-ultimo">{l.mensajes.at(-1)?.texto ?? ""}</div> },
    { id: "cuando", titulo: "Última charla", ancho: 10, celda: (l) => hace(ultimoTs(l)) },
    {
      id: "ventana",
      titulo: "Ventana 24 h",
      ancho: 15,
      celda: (l) => {
        const hasta = ventanaHasta(l);
        if (prueba) return <strong className="crm-ok">Modo prueba: se puede escribir</strong>;
        if (hasta) return <strong className="crm-ok">Abierta {restante(hasta)} más</strong>;
        return <strong className="crm-atencion">Cerrada: mensaje aprobado</strong>;
      },
    },
    {
      id: "accion",
      titulo: "Acción",
      ancho: 10,
      celda: (l) => (
        <button type="button" className="crm-retomar" onClick={() => abrir(l.id)}>
          Retomar
        </button>
      ),
    },
  ];
  return (
    <>
      <TablaCrm filas={filas} columnas={columnas} vacio="No hay charlas esperando respuesta del cliente." />
    </>
  );
}

// ---- Leads: KPI de color, Excel y la tabla con filtros (sin scroll horizontal) ----

const resultadoDe = (l: CrmLead): { texto: string; tono: "green" | "yellow" | "red" } =>
  l.estado === "spam" ? { texto: "Publicidad", tono: "red" } : l.cierre === "si" ? { texto: "Vendido", tono: "green" } : l.cierre === "no" ? { texto: "No sigue", tono: "red" } : { texto: "En curso", tono: "yellow" };

function Leads({ panel, abrir }: { panel: CrmPanel; abrir: Abrir }) {
  const leads = clientesReales(panel.leads);
  const prueba = (panel.asistente?.configuracion as { modoWhatsApp?: string } | undefined)?.modoWhatsApp === "prueba";
  const vendidos = leads.filter((l) => l.cierre === "si");
  const costoIa = leads.reduce((t, l) => t + (l.coste_ia_usd ?? 0), 0);
  const costoMeta = leads.reduce((t, l) => t + costeMetaUsd(l, prueba), 0);
  const kpis: { titulo: string; valor: string | number; detalle?: string; tono: "azul" | "verde" | "rojo" }[] = [
    { titulo: "Leads", valor: leads.length, tono: "azul" },
    { titulo: "Concretaron", valor: vendidos.length, tono: "verde" },
    { titulo: "Vendido", valor: pesos(vendidos.reduce((t, l) => t + (l.presupuesto ?? 0), 0)), tono: "verde" },
    { titulo: "Costo IA", valor: dolares(costoIa), tono: "rojo" },
    { titulo: "Costo Meta", valor: dolares(costoMeta), detalle: prueba ? "modo prueba: sin costo" : "estimado con la tarifa de Uruguay", tono: "rojo" },
  ];
  const columnas: ColumnaCrm<CrmLead>[] = [
    { id: "cliente", titulo: "Cliente", ancho: 9, celda: (l) => <NombreBoton l={l} abrir={abrir} />, orden: nombreDe },
    { id: "canal", titulo: "Canal", ancho: 6, celda: (l) => <Badge tone="green">{canalDe(l)}</Badge>, filtro: canalDe },
    { id: "telefono", titulo: "Teléfono", ancho: 8, celda: (l) => `+${l.telefono}` },
    { id: "fecha", titulo: "Fecha", ancho: 7, celda: (l) => fecha(l.creado_en), orden: (l) => l.creado_en, filtro: (l) => fecha(l.creado_en) },
    { id: "llego", titulo: "Llegó", ancho: 6, celda: (l) => hora(l.creado_en) },
    { id: "categoria", titulo: "Categoría", ancho: 8, celda: (l) => categoriaDe(l) ?? "—", filtro: (l) => categoriaDe(l) ?? "Sin dato" },
    { id: "producto", titulo: "Producto", ancho: 11, celda: (l) => l.datos.producto ?? "—", filtro: (l) => l.datos.producto ?? "Sin dato" },
    { id: "interes", titulo: "Interés", ancho: 6, celda: (l) => <Interes l={l} />, filtro: (l) => interesDe(l) ?? "Sin calificar" },
    { id: "pago", titulo: "Cómo paga", ancho: 8, celda: (l) => l.datos.como_paga ?? "—", filtro: (l) => l.datos.como_paga ?? "Sin dato" },
    { id: "resultado", titulo: "Resultado", ancho: 7, celda: (l) => <Badge tone={resultadoDe(l).tono}>{resultadoDe(l).texto}</Badge>, filtro: (l) => resultadoDe(l).texto },
    { id: "importe", titulo: "Importe", ancho: 6, celda: (l) => (l.cierre === "si" && l.presupuesto ? pesos(l.presupuesto) : "—"), orden: (l) => (l.cierre === "si" ? l.presupuesto ?? 0 : -1), derecha: true },
    { id: "costo-ia", titulo: "Costo IA", ancho: 6, celda: (l) => dolares(l.coste_ia_usd ?? 0), orden: (l) => l.coste_ia_usd ?? 0, derecha: true },
    { id: "costo-meta", titulo: "Costo Meta", ancho: 6, celda: (l) => (prueba ? "—" : dolares(costeMetaUsd(l, false))), derecha: true },
    { id: "mensajes", titulo: "Mensajes", ancho: 6, celda: (l) => l.mensajes.length, orden: (l) => l.mensajes.length, derecha: true },
  ];
  const excel = () =>
    downloadCsv(
      "leads-crm.csv",
      leads.map((l) => ({
        Cliente: nombreDe(l),
        Canal: canalDe(l),
        Teléfono: `+${l.telefono}`,
        Fecha: fecha(l.creado_en),
        Llegó: hora(l.creado_en),
        Categoría: categoriaDe(l) ?? "",
        Producto: l.datos.producto ?? "",
        Interés: interesDe(l) ?? "",
        "Cómo paga": l.datos.como_paga ?? "",
        Resultado: resultadoDe(l).texto,
        Importe: l.cierre === "si" ? l.presupuesto ?? "" : "",
        "Costo IA (USD)": (l.coste_ia_usd ?? 0).toFixed(4),
        Mensajes: l.mensajes.length,
      })),
    );
  return (
    <>
      <dl className="crm-kpis">
        {kpis.map((k) => (
          <div key={k.titulo} className={`crm-kpi ${k.tono}`}>
            <dt>{k.titulo}</dt>
            <dd>{k.valor}</dd>
            {k.detalle && <dd className="crm-kpi-detalle">{k.detalle}</dd>}
          </div>
        ))}
      </dl>
      <div className="crm-barra">
        <button type="button" className="crm-excel" onClick={excel} disabled={!leads.length}>Descargar en Excel (CSV)</button>
      </div>
      <TablaCrm filas={leads} columnas={columnas} vacio="Todavía no hay leads." ordenInicial={{ id: "fecha", desc: true }} />
    </>
  );
}
