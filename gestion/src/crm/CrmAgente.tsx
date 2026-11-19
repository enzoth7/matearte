// Área CRM: Agente y Ajustes, con las mismas secciones que el panel del CRM. Cada control manda un
// pedido «guardar_campo» con la misma ruta que usa el panel; la base solo acepta una lista cerrada de
// rutas y pide el permiso de la página, y el servidor del asistente vuelve a validar el valor.
// Las claves (OpenAI, Claude, WhatsApp) no pasan por Gestión. Sin <p> ni <span> (AGENTS.md).

import { useEffect, useId, useState, type ReactNode } from "react";
import { pedirYEsperar } from "./crmApi";
import { conSeccion, seccionesDe, type CrmPanel } from "./crmModel";

type Notificar = (mensaje: string) => void;
interface Props { panel: CrmPanel; notify: Notificar; recargar: () => Promise<void> }

type Activa = {
  negocio?: { nombre?: string; color?: string; lema?: string };
  regional?: { pais?: string; moneda?: string; prefijo?: string };
  agente?: { trato?: "tu" | "usted"; pasarSiempre?: { motivo?: string; frases?: string[] }[]; frases?: Record<string, string> };
  sistema?: {
    asistente?: { activo?: boolean; modelo?: string | null };
    avisos?: { comercial?: { telefono?: string | null } };
    seguimiento?: { automatico?: boolean };
    atencion?: { siempre?: boolean; dias?: number[]; desde?: string; hasta?: string };
    alcance?: { modo?: "todo" | "seguimientos"; categorias?: string[] };
    reglas?: Record<string, number | boolean>;
  };
};

const activaDe = (p: CrmPanel): Activa => ((p.asistente?.configuracion as { activa?: Activa } | undefined)?.activa ?? {}) as Activa;

/** Guarda un campo como el panel del CRM y recarga. */
function useGuardar({ notify, recargar }: Pick<Props, "notify" | "recargar">) {
  const [ocupado, setOcupado] = useState(false);
  const guardar = async (ruta: string, valor: unknown, extra: Record<string, unknown> = {}, listo = "Guardado.") => {
    setOcupado(true);
    const r = await pedirYEsperar("guardar_campo", null, { ruta, valor, ...extra }, notify, listo);
    setOcupado(false);
    await recargar();
    return r !== null;
  };
  return { ocupado, guardar };
}

// ---- Piezas ----

function Bloque({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="crm-bloque" aria-labelledby={id}>
      <h2 id={id}>{titulo}</h2>
      {subtitulo && <div className="crm-bloque-sub">{subtitulo}</div>}
      <div className="crm-bloque-cuerpo">{children}</div>
    </section>
  );
}

function Fila({ etiqueta, ayuda, children, columna = false }: { etiqueta: string; ayuda?: string; children: ReactNode; columna?: boolean }) {
  return (
    <div className={`crm-campo ${columna ? "columna" : ""}`}>
      <div className="crm-campo-texto">
        <strong>{etiqueta}</strong>
        {ayuda && <div>{ayuda}</div>}
      </div>
      <div className="crm-campo-control">{children}</div>
    </div>
  );
}

function Interruptor({ marcado, cambiar, etiqueta, desactivado }: { marcado: boolean; cambiar: (v: boolean) => void; etiqueta: string; desactivado?: boolean }) {
  return <button type="button" role="switch" aria-checked={marcado} aria-label={etiqueta} disabled={desactivado} className={`crm-interruptor ${marcado ? "si" : ""}`} onClick={() => cambiar(!marcado)} />;
}

function Segmentado<T extends string>({ opciones, valor, cambiar, etiqueta, desactivado }: { opciones: { valor: T; texto: string }[]; valor: T; cambiar: (v: T) => void; etiqueta: string; desactivado?: boolean }) {
  return (
    <div className="crm-segmentado" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" role="radio" aria-checked={o.valor === valor} disabled={desactivado} onClick={() => o.valor !== valor && cambiar(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

/** Un texto que se guarda al salir del campo (o con Enter si es de una línea). */
function Texto({ valor, guardar, etiqueta, varias = false, tipo = "text", placeholder }: { valor: string; guardar: (v: string) => void; etiqueta: string; varias?: boolean; tipo?: string; placeholder?: string }) {
  const [t, setT] = useState(valor);
  useEffect(() => setT(valor), [valor]);
  const salir = () => t.trim() !== valor.trim() && guardar(t.trim());
  return varias ? (
    <textarea aria-label={etiqueta} rows={2} value={t} onChange={(e) => setT(e.target.value)} onBlur={salir} />
  ) : (
    <input aria-label={etiqueta} type={tipo} value={t} placeholder={placeholder} onChange={(e) => setT(e.target.value)} onBlur={salir} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
  );
}

// ---- Agente ----

const RESUMEN: { titulo: string; nombre: string }[] = [
  { titulo: "Objetivo", nombre: "Tu objetivo" },
  { titulo: "Cómo vende", nombre: "Cómo vendés" },
  { titulo: "Cuándo pasa al equipo", nombre: "Pasar a una persona" },
  { titulo: "Lo que nunca hace", nombre: "Lo que nunca hacés" },
  { titulo: "Lo que sabe del negocio", nombre: "Información que puedes dar tal cual" },
  { titulo: "Personalización", nombre: "Personalización" },
  { titulo: "Pago por transferencia", nombre: "Pago por transferencia, sin pasar por la web" },
  { titulo: "Cómo escribe", nombre: "Cómo escribís" },
  { titulo: "Qué pregunta", nombre: "Qué preguntás, en este orden (solo lo que falte)" },
];
const HERRAMIENTAS = [
  { nombre: "Buscar productos", texto: "Busca en el catálogo real de la tienda y devuelve nombre, precio, precio por transferencia y enlace." },
  { nombre: "Opciones del personalizado", texto: "Recorre el personalizador (modelo, terminación, metal) con los precios que publica Gestión." },
  { nombre: "Precios de personalización", texto: "Calcula lo que suman letras, escudos y grabado según la técnica." },
  { nombre: "Guardar dato", texto: "Anota en la ficha lo que cuenta el cliente: producto, personalización, entrega, cómo paga e interés." },
  { nombre: "Pasar al equipo", texto: "Le pasa la charla al equipo de MateArte y deja de contestar." },
  { nombre: "Marcar publicidad", texto: "Si es spam o una oferta comercial, lo marca y no contesta más." },
];
const CONTROLES_FIJOS = [
  "No puede dar precios que no salgan del catálogo o de sus instrucciones: el CRM revisa cada respuesta antes de enviarla.",
  "El precio por transferencia lo calcula el código con el descuento de abajo, no el modelo.",
  "Sin «¿» ni «¡» y sin repetir enlaces: si pasa, se le pide que lo reescriba.",
  "Quien pide que no le escriban, no recibe más mensajes.",
];
const REGLAS: { clave: string; etiqueta: string; unidad: string; min: number; max: number }[] = [
  { clave: "descuentoTransferencia", etiqueta: "Descuento por transferencia", unidad: "%", min: 0, max: 50 },
  { clave: "esperaSegundos", etiqueta: "Silencio antes de contestar", unidad: "s", min: 0, max: 300 },
  { clave: "esperaMaximaSegundos", etiqueta: "Espera máxima", unidad: "s", min: 0, max: 900 },
  { clave: "maximoPalabras", etiqueta: "Máximo de palabras", unidad: "palabras", min: 15, max: 150 },
  { clave: "horasAutomatico", etiqueta: "Seguimiento automático a las", unidad: "h", min: 1, max: 23 },
];
const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
const NOMBRES_DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const CATEGORIAS = ["Mate", "Mate personalizado", "Matera", "Bombilla", "Termo", "Yerbero", "Kit matero", "Botas", "Cinto", "Billetera", "Cartera", "Zuecos", "Regalo empresarial"];
const MODELOS: { valor: string; texto: string }[] = [
  { valor: "claude-haiku-5-5", texto: "Claude rápido (recomendado)" },
  { valor: "claude-sonnet-5-5", texto: "Claude más cuidadoso, más caro" },
  { valor: "gpt-6-luna", texto: "OpenAI rápido" },
  { valor: "gpt-6.2-sol", texto: "OpenAI más cuidadoso, más caro" },
];
const FRASES: { clave: string; etiqueta: string; ayuda?: string }[] = [
  { clave: "pase", etiqueta: "Cuando te lo pasa" },
  { clave: "fallo", etiqueta: "Si algo falla" },
  { clave: "audio", etiqueta: "Si no se entiende una nota de voz" },
  { clave: "baja", etiqueta: "Si pide que no le escriban" },
  { clave: "presentacion", etiqueta: "Cómo se presenta", ayuda: "Tiene que decir que es un asistente virtual. {negocio} es el nombre del negocio." },
  { clave: "borrarDatos", etiqueta: "Si pide que borres sus datos", ayuda: "Poné {negocio} donde va el nombre del negocio." },
];

export function Agente(p: Props) {
  const a = p.panel.asistente;
  if (!a) return <div className="crm-aviso">Todavía no llegaron las instrucciones: prendé el servidor del asistente.</div>;
  const activa = activaDe(p.panel);
  return (
    <div className="crm-bloques">
      <Bloque titulo="Qué hace tu agente" subtitulo="Lo que dicen sus instrucciones, de un vistazo. Cada parte se edita al abrirla.">
        <div className="crm-resumen">
          <div className="crm-secciones">
            {RESUMEN.filter((r) => seccionesDe(a.instrucciones).some((s) => s.titulo === r.nombre)).map((r) => (
              <SeccionEditable key={r.nombre} {...p} titulo={r.titulo} nombre={r.nombre} />
            ))}
          </div>
          <div className="crm-resumen-lado">
            <h3>Herramientas</h3>
            <ul className="crm-lista-simple">
              {HERRAMIENTAS.map((h) => (
                <li key={h.nombre}><strong>{h.nombre}:</strong> {h.texto}</li>
              ))}
            </ul>
            <h3>Controles del CRM</h3>
            <Controles {...p} />
            <ul className="crm-lista-simple puntos">
              {CONTROLES_FIJOS.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
        </div>
      </Bloque>
      <Bloque titulo="Cuándo y para qué">
        <Horario {...p} activa={activa} />
        <Alcance {...p} activa={activa} />
      </Bloque>
      <Bloque titulo="Cómo contesta">
        <ComoContesta {...p} activa={activa} />
      </Bloque>
      <Bloque titulo="Motor">
        <Motor {...p} activa={activa} />
      </Bloque>
      <Bloque titulo="Instrucciones completas">
        <InstruccionesCompletas {...p} />
        <PaseSiempre {...p} activa={activa} />
        <Frases {...p} activa={activa} />
      </Bloque>
    </div>
  );
}

function SeccionEditable(p: Props & { titulo: string; nombre: string }) {
  const a = p.panel.asistente!;
  const cuerpo = seccionesDe(a.instrucciones).find((s) => s.titulo === p.nombre)?.cuerpo ?? "";
  const [texto, setTexto] = useState(cuerpo);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => setTexto(cuerpo), [cuerpo]);
  const cambiado = texto.trim() !== cuerpo.trim();
  return (
    <details className="crm-seccion-editable">
      <summary>{p.titulo}<small>editar</small></summary>
      <textarea aria-label={p.titulo} rows={Math.min(14, Math.max(4, texto.split("\n").length + 1))} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="crm-acciones">
        <button
          type="button"
          className="crm-boton oscuro"
          disabled={!cambiado || ocupado}
          onClick={async () => {
            setOcupado(true);
            await pedirYEsperar("guardar_instrucciones", null, { texto: conSeccion(a.instrucciones, p.nombre, texto), hash: a.hash }, p.notify, "Instrucciones guardadas.");
            setOcupado(false);
            await p.recargar();
          }}
        >
          {ocupado ? "Guardando…" : "Guardar"}
        </button>
        {cambiado && <button type="button" className="crm-boton" onClick={() => setTexto(cuerpo)}>Descartar</button>}
      </div>
    </details>
  );
}

function Controles(p: Props) {
  const reglas = activaDe(p.panel).sistema?.reglas ?? {};
  const { ocupado, guardar } = useGuardar(p);
  return (
    <div className="crm-reglas">
      {REGLAS.map((r) => (
        <ReglaNumero key={r.clave} {...r} valor={Number(reglas[r.clave] ?? 0)} guardar={(n) => void guardar(`sistema.reglas.${r.clave}`, n, {}, `${r.etiqueta}: guardado.`)} />
      ))}
      <Fila etiqueta="Foto o documento pasa al equipo" ayuda="El comprobante de una transferencia o un diseño: lo revisa una persona.">
        <Interruptor etiqueta="Foto o documento pasa al equipo" marcado={reglas.imagenAlEquipo !== false} desactivado={ocupado} cambiar={(v) => void guardar("sistema.reglas.imagenAlEquipo", v)} />
      </Fila>
    </div>
  );
}

function ReglaNumero(p: { etiqueta: string; unidad: string; min: number; max: number; valor: number; guardar: (n: number) => void }) {
  const [t, setT] = useState(String(p.valor));
  useEffect(() => setT(String(p.valor)), [p.valor]);
  const salir = () => {
    const n = Number(t);
    if (!Number.isInteger(n) || n < p.min || n > p.max) return setT(String(p.valor));
    if (n !== p.valor) p.guardar(n);
  };
  return (
    <label className="crm-regla">
      {p.etiqueta}
      <div>
        <input type="number" min={p.min} max={p.max} step={1} value={t} onChange={(e) => setT(e.target.value)} onBlur={salir} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
        <small>{p.unidad} · entre {p.min} y {p.max}</small>
      </div>
    </label>
  );
}

function Horario(p: Props & { activa: Activa }) {
  const at = { siempre: true, dias: [1, 2, 3, 4, 5, 6], desde: "09:00", hasta: "21:00", ...p.activa.sistema?.atencion };
  const { ocupado, guardar } = useGuardar(p);
  return (
    <>
      <Fila etiqueta="Activo siempre" ayuda="Si lo apagás, el asistente solo contesta en los días y horas que elijas. Fuera de horario guarda los mensajes y les contesta el equipo.">
        <Interruptor etiqueta="Activo siempre" marcado={at.siempre} desactivado={ocupado} cambiar={(v) => void guardar("sistema.atencion.siempre", v)} />
      </Fila>
      {!at.siempre && (
        <div className="crm-horario">
          <div className="crm-dias" role="group" aria-label="Días">
            {DIAS.map((d, i) => {
              const activo = at.dias.includes(i);
              return (
                <button key={NOMBRES_DIAS[i]} type="button" aria-pressed={activo} aria-label={NOMBRES_DIAS[i]} disabled={ocupado} onClick={() => void guardar("sistema.atencion.dias", activo ? at.dias.filter((x) => x !== i) : [...at.dias, i])}>
                  {d}
                </button>
              );
            })}
          </div>
          <label>Desde<Texto etiqueta="Desde" tipo="time" valor={at.desde} guardar={(v) => void guardar("sistema.atencion.desde", v)} /></label>
          <label>Hasta<Texto etiqueta="Hasta" tipo="time" valor={at.hasta} guardar={(v) => void guardar("sistema.atencion.hasta", v)} /></label>
        </div>
      )}
    </>
  );
}

function Alcance(p: Props & { activa: Activa }) {
  const al = { modo: "todo" as const, categorias: [] as string[], ...p.activa.sistema?.alcance };
  const { ocupado, guardar } = useGuardar(p);
  return (
    <>
      <Fila etiqueta="Qué hace" ayuda="«Solo seguimientos»: no contesta los mensajes (los atiende el equipo) y solo manda los seguimientos automáticos.">
        <Segmentado etiqueta="Qué hace" desactivado={ocupado} valor={al.modo} cambiar={(v) => void guardar("sistema.alcance.modo", v)} opciones={[{ valor: "todo", texto: "Contesta y hace seguimientos" }, { valor: "seguimientos", texto: "Solo seguimientos" }]} />
      </Fila>
      <Fila etiqueta="Categorías que atiende" ayuda="Sin ninguna marcada, atiende todas. Si marcás algunas, las demás consultas pasan al equipo." columna>
        <div className="crm-chips" role="group" aria-label="Categorías que atiende">
          {CATEGORIAS.map((c) => {
            const activa = al.categorias.includes(c);
            return (
              <button key={c} type="button" aria-pressed={activa} disabled={ocupado} onClick={() => void guardar("sistema.alcance.categorias", activa ? al.categorias.filter((x) => x !== c) : [...al.categorias, c])}>
                {c}
              </button>
            );
          })}
        </div>
      </Fila>
    </>
  );
}

function ComoContesta(p: Props & { activa: Activa }) {
  const s = p.activa.sistema ?? {};
  const { ocupado, guardar } = useGuardar(p);
  const [ocupadoActivo, setOcupadoActivo] = useState(false);
  const activo = s.asistente?.activo !== false;
  return (
    <>
      <Fila etiqueta="Contesta a los clientes" ayuda="Si lo apagás, los mensajes se guardan y les contesta el equipo.">
        <Interruptor
          etiqueta="Contesta a los clientes"
          marcado={activo}
          desactivado={ocupadoActivo}
          cambiar={async (v) => {
            setOcupadoActivo(true);
            await pedirYEsperar("asistente_activo", null, { activo: v }, p.notify, v ? "El asistente vuelve a contestar." : "Asistente en pausa.");
            setOcupadoActivo(false);
            await p.recargar();
          }}
        />
      </Fila>
      <Fila etiqueta="Seguimiento automático" ayuda="Un solo mensaje a las horas de «Controles del CRM» si el cliente no contestó, dentro de la ventana de 24 h y entre las 9 y las 21.">
        <Interruptor etiqueta="Seguimiento automático" marcado={s.seguimiento?.automatico === true} desactivado={ocupado} cambiar={(v) => void guardar("sistema.seguimiento.automatico", v)} />
      </Fila>
      <Fila etiqueta="Trata a los clientes de">
        <Segmentado etiqueta="Trato" desactivado={ocupado} valor={p.activa.agente?.trato ?? "tu"} cambiar={(v) => void guardar("agente.trato", v)} opciones={[{ valor: "tu", texto: "Tú o vos" }, { valor: "usted", texto: "Usted" }]} />
      </Fila>
      <Fila etiqueta="Cuando te toque, avisame por WhatsApp a" ayuda="Un número con código de país. Vacío: sin aviso.">
        <Texto etiqueta="Teléfono para avisos" valor={s.avisos?.comercial?.telefono ?? ""} placeholder="+598 9x xxx xxx" guardar={(v) => void guardar("sistema.avisos.comercial.telefono", v.replace(/[^\d+]/g, ""))} />
      </Fila>
    </>
  );
}

function Motor(p: Props & { activa: Activa }) {
  const { ocupado, guardar } = useGuardar(p);
  return (
    <Fila etiqueta="Modelo" ayuda="El que redacta las respuestas. El rápido de OpenAI cuesta unos 0,004 USD por charla.">
      <Segmentado etiqueta="Modelo" desactivado={ocupado} valor={p.activa.sistema?.asistente?.modelo ?? "claude-haiku-5-5"} cambiar={(v) => void guardar("sistema.asistente.modelo", v, {}, "Modelo cambiado.")} opciones={MODELOS} />
    </Fila>
  );
}

function InstruccionesCompletas(p: Props) {
  const a = p.panel.asistente!;
  const [texto, setTexto] = useState(a.instrucciones);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => setTexto(a.instrucciones), [a.instrucciones]);
  const cambiado = texto !== a.instrucciones;
  return (
    <Fila etiqueta="System prompt" ayuda="Las instrucciones enteras. La primera línea no se cambia: liga cada cliente a su perfil." columna>
      <textarea className="crm-prompt" aria-label="Instrucciones completas" rows={18} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="crm-acciones">
        <button
          type="button"
          className="crm-boton oscuro"
          disabled={!cambiado || ocupado}
          onClick={async () => {
            setOcupado(true);
            await pedirYEsperar("guardar_instrucciones", null, { texto, hash: a.hash }, p.notify, "Instrucciones guardadas.");
            setOcupado(false);
            await p.recargar();
          }}
        >
          {ocupado ? "Guardando…" : "Guardar instrucciones"}
        </button>
        {cambiado && <button type="button" className="crm-boton" onClick={() => setTexto(a.instrucciones)}>Descartar</button>}
      </div>
    </Fila>
  );
}

function PaseSiempre(p: Props & { activa: Activa }) {
  const frases = [...new Set((p.activa.agente?.pasarSiempre ?? []).filter((r) => (r.motivo ?? "") === "").flatMap((r) => r.frases ?? []))];
  const [nueva, setNueva] = useState("");
  const { ocupado, guardar } = useGuardar(p);
  const guardarLista = (lista: string[]) => guardar("agente.pasarSiempre", null, { lista });
  return (
    <Fila etiqueta="Pásamelo siempre si escribe…" ayuda="Si un cliente escribe una de estas frases (sin importar mayúsculas ni tildes), el asistente se lo pasa al equipo." columna>
      <div className="crm-chips" role="group" aria-label="Frases">
        {frases.length === 0 && <div className="crm-vacio">Ninguna frase todavía.</div>}
        {frases.map((f) => (
          <button key={f} type="button" className="crm-chip-quitar" disabled={ocupado} aria-label={`Quitar «${f}»`} onClick={() => void guardarLista(frases.filter((x) => x !== f))}>
            {f} ×
          </button>
        ))}
      </div>
      <form className="crm-anadir" onSubmit={(e) => { e.preventDefault(); if (nueva.trim()) void guardarLista([...frases, nueva.trim()]).then((ok) => ok && setNueva("")); }}>
        <input aria-label="Añadir frase" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Añadir frase" />
        <button type="submit" className="crm-boton" disabled={ocupado || !nueva.trim()}>Añadir</button>
      </form>
    </Fila>
  );
}

function Frases(p: Props & { activa: Activa }) {
  const frases = p.activa.agente?.frases ?? {};
  const { guardar } = useGuardar(p);
  return (
    <div className="crm-frases">
      <h3>Frases fijas</h3>
      {FRASES.map((f) => (
        <Fila key={f.clave} etiqueta={f.etiqueta} ayuda={f.ayuda}>
          <Texto etiqueta={f.etiqueta} varias valor={frases[f.clave] ?? ""} guardar={(v) => v && void guardar(`agente.frases.${f.clave}`, v)} />
        </Fila>
      ))}
    </div>
  );
}

// ---- Ajustes ----

export function Ajustes(p: Props) {
  const activa = activaDe(p.panel);
  const conf = p.panel.asistente?.configuracion as { modoWhatsApp?: string } | undefined;
  const { ocupado, guardar } = useGuardar(p);
  const senal = p.panel.asistente ? Date.parse(p.panel.asistente.actualizado_en) : 0;
  const minutos = senal ? Math.round((Date.now() - senal) / 60_000) : null;
  const pendientes = p.panel.comandos.filter((c) => c.estado === "pendiente").length;
  return (
    <div className="crm-bloques">
      <Bloque titulo="Tu negocio">
        <Fila etiqueta="Nombre" ayuda="Sale en el primer WhatsApp y en la presentación del asistente.">
          <Texto etiqueta="Nombre del negocio" valor={activa.negocio?.nombre ?? ""} guardar={(v) => v && void guardar("negocio.nombre", v)} />
        </Fila>
        <Fila etiqueta="Lema">
          <Texto etiqueta="Lema" valor={activa.negocio?.lema ?? ""} guardar={(v) => void guardar("negocio.lema", v)} />
        </Fila>
        <Fila etiqueta="Color">
          <input type="color" aria-label="Color" disabled={ocupado} value={activa.negocio?.color ?? "#1e120c"} onChange={(e) => void guardar("negocio.color", e.target.value)} />
        </Fila>
        <Fila etiqueta="País y moneda">
          <div className="crm-dato">{[activa.regional?.pais, activa.regional?.moneda, activa.regional?.prefijo && `+${activa.regional.prefijo}`].filter(Boolean).join(" · ") || "—"}</div>
        </Fila>
      </Bloque>
      <Bloque titulo="Conexiones">
        <Conexiones {...p} />
        <Fila etiqueta="Servidor del asistente" ayuda="Hoy corre en la PC de Enzo; con un VPS queda prendido siempre.">
          <div className={minutos !== null && minutos <= 2 ? "crm-ok" : "crm-atencion"}>{minutos === null ? "Nunca se conectó" : minutos <= 2 ? "Conectado" : `Sin señal hace ${minutos} min`}{pendientes ? ` · ${pendientes} pedidos pendientes` : ""}</div>
        </Fila>
        {conf?.modoWhatsApp === "prueba" && <Permitidos {...p} />}
      </Bloque>
      <details className="crm-bloque crm-avanzado">
        <summary>Avanzado</summary>
        <Avanzado {...p} />
      </details>
    </div>
  );
}

type Conf = {
  modoWhatsApp?: string;
  conexiones?: { comprobadoEn?: number | null; filas?: { id: string; nombre: string; estado: string; detalle: string }[] } | null;
  claves?: { nombre: string; guardada: boolean; terminaEn: string | null }[];
  modoPrueba?: { activo: boolean; numero: string | null; permitidos: string[] } | null;
};
const confDe = (p: CrmPanel) => (p.asistente?.configuracion ?? {}) as Conf;

function Conexiones(p: Props) {
  const c = confDe(p.panel);
  const [ocupado, setOcupado] = useState(false);
  const pedirConexion = async (datos: Record<string, unknown>, listo: string) => {
    setOcupado(true);
    await pedirYEsperar("conexiones", null, datos, p.notify, listo);
    setOcupado(false);
    await p.recargar();
  };
  const comprobado = c.conexiones?.comprobadoEn ? Math.round((Date.now() - c.conexiones.comprobadoEn) / 60_000) : null;
  return (
    <div className="crm-conexiones">
      <div className="crm-conexiones-cabecera">
        <div>{comprobado === null ? "Sin comprobar" : comprobado < 1 ? "Comprobado hace un momento" : `Comprobado hace ${comprobado} min`}</div>
        <button type="button" className="crm-enlace" disabled={ocupado} onClick={() => void pedirConexion({ accion: "comprobar" }, "Conexiones comprobadas.")}>
          Volver a comprobar
        </button>
      </div>
      <ul className="crm-conexiones-lista">
        {(c.conexiones?.filas ?? []).map((f) => (
          <li key={f.id}>
            <i className={`crm-punto ${f.estado}`} aria-hidden="true" />
            <div>
              <strong>{f.nombre}</strong>
              <div className={f.estado === "atencion" ? "crm-atencion" : f.estado === "error" ? "crm-error" : ""}>{f.detalle}</div>
              {f.id === "whatsapp" && c.modoWhatsApp === "prueba" && (
                <div className="crm-acciones">
                  <button
                    type="button"
                    className="crm-boton"
                    disabled={ocupado}
                    onClick={() => {
                      if (window.confirm("¿Desvincular el móvil de pruebas? El asistente deja de recibir mensajes hasta que se vuelva a escanear el QR en la PC del CRM.")) void pedirConexion({ accion: "desvincular" }, "Móvil desvinculado.");
                    }}
                  >
                    Desvincular
                  </button>
                  <div className="crm-nota-chica">Pasar a WhatsApp oficial se hace en el CRM de la PC: pide las claves de Meta, que no pasan por Gestión.</div>
                </div>
              )}
            </div>
          </li>
        ))}
        {!c.conexiones?.filas?.length && <li>Todavía no llegó el chequeo: prendé el servidor del asistente.</li>}
      </ul>
    </div>
  );
}

function Permitidos(p: Props) {
  const actuales = confDe(p.panel).modoPrueba?.permitidos ?? [];
  const [numeros, setNumeros] = useState<string[]>(actuales.length ? actuales : [""]);
  const [ocupado, setOcupado] = useState(false);
  const firma = actuales.join(",");
  useEffect(() => setNumeros(actuales.length ? actuales : [""]), [firma]); // eslint-disable-line react-hooks/exhaustive-deps
  const cambiado = numeros.filter((n) => n.trim()).join(",") !== firma;
  return (
    <div className="crm-permitidos">
      <strong>¿A qué números puede contestar tu asistente?</strong>
      <div className="crm-nota-chica">Solo a estos. Los demás chats del móvil vinculado no se leen, no se guardan y no se contestan.</div>
      {numeros.map((n, i) => (
        <div key={i} className="crm-permitido">
          <input aria-label={`Número permitido ${i + 1}`} value={n} placeholder="+598 9x xxx xxx" onChange={(e) => setNumeros((ns) => ns.map((x, j) => (j === i ? e.target.value : x)))} />
          {numeros.length > 1 && <button type="button" className="crm-boton" aria-label={`Quitar número ${i + 1}`} onClick={() => setNumeros((ns) => ns.filter((_, j) => j !== i))}>Quitar</button>}
        </div>
      ))}
      <button type="button" className="crm-enlace" onClick={() => setNumeros((ns) => [...ns, ""])}>+ Añadir otro número</button>
      <button
        type="button"
        className="crm-boton oscuro"
        disabled={ocupado || !cambiado}
        onClick={async () => {
          setOcupado(true);
          await pedirYEsperar("conexiones", null, { accion: "permitidos", numeros: numeros.map((n) => n.trim()).filter(Boolean) }, p.notify, "Números guardados.");
          setOcupado(false);
          await p.recargar();
        }}
      >
        Guardar
      </button>
    </div>
  );
}

const VARIABLES: Record<string, string> = { "{{1}}": "Nombre del cliente", "{{2}}": "Nombre del negocio" };

function Avanzado(p: Props) {
  const c = confDe(p.panel);
  const plantilla = ((activaDe(p.panel) as { plantilla?: { nombre?: string; idioma?: string; texto?: string } }).plantilla ?? {});
  const [nombre, setNombre] = useState(plantilla.nombre ?? "");
  const [idioma, setIdioma] = useState(plantilla.idioma ?? "es_ES");
  const [texto, setTexto] = useState(plantilla.texto ?? "");
  const { ocupado, guardar } = useGuardar(p);
  useEffect(() => {
    setNombre(plantilla.nombre ?? "");
    setIdioma(plantilla.idioma ?? "es_ES");
    setTexto(plantilla.texto ?? "");
  }, [plantilla.nombre, plantilla.idioma, plantilla.texto]);
  const voz = c.claves?.find((k) => k.nombre === "OPENAI_API_KEY");
  const cambiado = nombre !== (plantilla.nombre ?? "") || idioma !== (plantilla.idioma ?? "es_ES") || texto !== (plantilla.texto ?? "");
  return (
    <>
      <Fila etiqueta="Notas de voz" ayuda="Transcribe los audios con la clave de OpenAI. Se cambia en el CRM de la PC.">
        <div className={voz?.guardada ? "crm-ok" : "crm-atencion"}>{voz?.guardada ? `Guardada · termina en ${voz.terminaEn ?? ""}` : "Sin clave"}</div>
      </Fila>
      <Fila etiqueta="Mensajes aprobados" ayuda="El mensaje de bienvenida que se manda con WhatsApp oficial cuando el cliente escribe desde la web. En modo prueba no se usa." columna>
        <div className="crm-plantilla">
          <label>Nombre en Meta<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
          <label>Idioma
            <select value={idioma} onChange={(e) => setIdioma(e.target.value)}>
              {["es_ES", "es", "es_AR", "es_MX", "en_US", "pt_BR"].map((i) => <option key={i}>{i}</option>)}
            </select>
          </label>
        </div>
        <label className="crm-plantilla-texto">Texto
          <textarea rows={3} maxLength={1024} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <small>{texto.length} / 1.024</small>
        </label>
        <div className="crm-plantilla-vista">
          <div className="crm-burbuja">
            {texto.split(/(\{\{\d\}\})/).map((parte, i) => (VARIABLES[parte] ? <mark key={i}>{VARIABLES[parte]}</mark> : parte))}
          </div>
        </div>
        <button type="button" className="crm-boton oscuro" disabled={ocupado || !cambiado || !nombre.trim() || !texto.trim()} onClick={() => void guardar("plantilla", { nombre: nombre.trim(), idioma, texto: texto.trim() }, {}, "Mensaje aprobado guardado.")}>
          Guardar mensaje
        </button>
      </Fila>
      <Fila etiqueta="Borrar todo" ayuda="Por seguridad, borrar todos los clientes no se puede desde Gestión: solo desde el CRM de la PC.">
        <div className="crm-dato">Solo en el CRM de la PC</div>
      </Fila>
    </>
  );
}

