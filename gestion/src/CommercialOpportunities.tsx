import { Fragment, useEffect, useState } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { commerceSource } from "./commerceSource";
import { CountryFlag } from "./location";
import { OpportunityEmailDraft } from "./OpportunityEmailDraft";
import "./commercialOpportunities.css";

type Opportunity = {
  id: string;
  empresa: string;
  correo: string | null;
  actividad: string;
  ubicacion: string;
  pais: string;
  region: string;
  prioridad: keyof typeof priorities;
  estado: Status | "En preparación" | "Baja";
  canal: string;
  destinatario: string;
  propuesta: string;
  apertura_correo: string | null;
  motivo: string;
  fuente_comercial: string;
  fuente_contacto: string;
  proxima_accion: string;
  contactada_en: string | null;
};

const columns =
  "id,empresa,correo,actividad,ubicacion,pais,region,prioridad,estado,canal,destinatario,propuesta,apertura_correo,motivo,fuente_comercial,fuente_contacto,proxima_accion,contactada_en";

const priorities = {
  Alta: { label: "Alta", color: "green" },
  Media: { label: "Media", color: "yellow" },
  Exploratoria: { label: "Baja", color: "red" },
} as const;
const priorityOrder = Object.keys(priorities);
const statuses = {
  "Sin contactar": "Sin contactar",
  Contactada: "Contactado",
  "No hubo respuesta": "No hubo respuesta",
} as const;
type Status = keyof typeof statuses;
type ContactState = Pick<Opportunity, "estado" | "contactada_en">;

const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");

async function readOpportunities(signal: AbortSignal) {
  if (!commerceSource) throw new Error("Falta la conexión de Gestión.");
  const rows: Opportunity[] = [];
  const batch = 250;
  for (let offset = 0; ; offset += batch) {
    const result = await commerceSource
      .from("commercial_opportunities")
      .select(columns)
      .order("id")
      .range(offset, offset + batch - 1)
      .abortSignal(signal);
    if (result.error)
      throw new Error("No se pudieron cargar las oportunidades.");
    rows.push(...result.data);
    if (result.data.length < batch) break;
  }
  return rows.sort(
    (a, b) =>
      priorityOrder.indexOf(a.prioridad) - priorityOrder.indexOf(b.prioridad) ||
      a.empresa.localeCompare(b.empresa, "es"),
  );
}

export function CommercialOpportunities() {
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState("");
  const [emailRow, setEmailRow] = useState<Opportunity | null>(null);
  const [saving, setSaving] = useState(new Set<string>());
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const request = new AbortController();
    readOpportunities(request.signal)
      .then((data) => {
        if (!request.signal.aborted) setRows(data);
      })
      .catch((cause: Error) => {
        if (!request.signal.aborted) setError(cause.message);
      })
      .finally(() => {
        if (!request.signal.aborted) setLoading(false);
      });
    return () => request.abort();
  }, []);

  async function changeStatus(row: Opportunity, status: Status) {
    if (!commerceSource || saving.has(row.id) || status === row.estado) return;
    const apply = (state: ContactState) =>
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, ...state } : item,
        ),
      );
    setSaving((current) => new Set(current).add(row.id));
    setSaveErrors((current) => ({ ...current, [row.id]: "" }));
    try {
      const { data, error } = await commerceSource.rpc(
        "gestion_editar_estado_oportunidad",
        {
          p_id: row.id,
          p_estado_anterior: row.estado,
          p_estado: status,
        },
      );
      if (!error) {
        apply(data as ContactState);
        return;
      }
      if (error.code === "40001" || error.code === "22023") {
        const current = await commerceSource
          .from("commercial_opportunities")
          .select("estado,contactada_en")
          .eq("id", row.id)
          .single();
        if (current.data) apply(current.data as ContactState);
        throw new Error(
          "Se actualizó el estado de esta empresa. Revisalo antes de cambiarlo.",
        );
      }
      throw new Error("No se pudo guardar el estado. Probá de nuevo.");
    } catch (cause) {
      setSaveErrors((current) => ({
        ...current,
        [row.id]:
          cause instanceof Error
            ? cause.message
            : "No se pudo guardar el estado.",
      }));
    } finally {
      setSaving((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
    }
  }

  const terms = normalize(search.trim()).split(/\s+/).filter(Boolean);
  const filtered = rows.filter((row) => {
    const location = normalize([row.ubicacion, row.pais, row.region].join(" "));
    return terms.every((term) => location.includes(term));
  });

  return (
    <section
      className="card table-card commercial-opportunities"
      aria-label="Oportunidades comerciales"
    >
      <table aria-label="Empresas y oportunidades">
        <thead>
          <tr>
            <th scope="col">Empresa</th>
            <th scope="col">Actividad</th>
            <th scope="col">Correo o canal</th>
            <th scope="col" className="opportunity-location-heading">
              <label>
                Ubicación
                <input
                  type="search"
                  aria-label="Buscar por ubicación"
                  placeholder="Buscar ubicación"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </th>
            <th scope="col">Prioridad</th>
            <th scope="col">Estado</th>
            <th scope="col" className="opportunity-draft-column">
              Borrador
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => {
            const priority = priorities[row.prioridad];
            const isExpanded = expanded === row.id;
            const locked =
              row.estado === "En preparación" || row.estado === "Baja";
            return (
              <Fragment key={row.id}>
                <tr>
                  <td data-label="Empresa">
                    <button
                      className="text-button opportunity-name"
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={
                        isExpanded ? "detalle-" + row.id : undefined
                      }
                      onClick={() => setExpanded(isExpanded ? "" : row.id)}
                    >
                      {row.empresa}
                    </button>
                  </td>
                  <td data-label="Actividad">{row.actividad}</td>
                  <td data-label="Correo o canal">{row.correo || row.canal}</td>
                  <td data-label="Ubicación">
                    <div className="location-label">
                      <CountryFlag place={row.pais} />
                      <div>
                        {row.ubicacion}
                        <small>{row.pais}</small>
                      </div>
                    </div>
                  </td>
                  <td data-label="Prioridad">
                    <strong className={`badge ${priority.color}`}>
                      {priority.label}
                    </strong>
                  </td>
                  <td data-label="Estado">
                    <div>
                      <select
                        className="opportunity-status"
                        aria-label={`Estado de ${row.empresa}`}
                        aria-busy={saving.has(row.id)}
                        disabled={locked || saving.has(row.id)}
                        value={row.estado}
                        onChange={(event) =>
                          void changeStatus(row, event.target.value as Status)
                        }
                      >
                        {locked && (
                          <option value={row.estado}>{row.estado}</option>
                        )}
                        {Object.entries(statuses).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {saveErrors[row.id] && (
                        <small role="alert">{saveErrors[row.id]}</small>
                      )}
                    </div>
                  </td>
                  <td
                    data-label="Borrador"
                    className="opportunity-draft-column"
                  >
                    <button
                      type="button"
                      className="secondary opportunity-draft-button"
                      aria-label={`Ver borrador de correo para ${row.empresa}`}
                      disabled={row.estado === "Baja"}
                      onClick={() => setEmailRow(row)}
                    >
                      <EnvelopeSimple size={22} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="opportunity-detail">
                    <td colSpan={7}>
                      <div id={"detalle-" + row.id}>
                        <dl>
                          <dt>Motivo</dt>
                          <dd>{row.motivo}</dd>
                          <dt>Propuesta para {row.destinatario}</dt>
                          <dd>{row.propuesta}</dd>
                          <dt>Canal de contacto</dt>
                          <dd>{row.canal}</dd>
                          {row.estado === "Sin contactar" && (
                            <>
                              <dt>Próxima acción</dt>
                              <dd>{row.proxima_accion}</dd>
                            </>
                          )}
                          {row.contactada_en && (
                            <>
                              <dt>Contacto registrado</dt>
                              <dd>
                                {new Date(row.contactada_en).toLocaleDateString(
                                  "es-UY",
                                  { timeZone: "America/Montevideo" },
                                )}
                              </dd>
                            </>
                          )}
                        </dl>
                        <a
                          href={row.fuente_comercial}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Fuente comercial
                        </a>
                        {row.fuente_contacto !== row.fuente_comercial && (
                          <a
                            href={row.fuente_contacto}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Fuente del contacto
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {loading ? (
        <div className="empty" role="status">
          Cargando oportunidades…
        </div>
      ) : error ? (
        <div className="empty" role="alert">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty" role="status">
          No hay oportunidades para esa ubicación.
        </div>
      ) : null}
      {emailRow && (
        <OpportunityEmailDraft
          row={emailRow}
          onClose={() => setEmailRow(null)}
        />
      )}
    </section>
  );
}
