import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { usePricing } from "../context/PricingContext";
import {
  getPricingAdminSession,
  loadPricingAdminState,
  saveAndPublishPricing,
  signInPricingAdmin,
  signOutPricingAdmin,
  type PricingAdminState,
  type PricingRuleDefinition,
} from "../lib/pricingAdmin";
import {
  getDashboardSectionForDefinition,
  getNumericPricingValues,
  PRICING_FAMILY_LABELS,
  validatePricingValues,
  type EditablePricingValues,
  type PricingDashboardSection,
} from "./pricingDashboardUtils";

type EditableValues = EditablePricingValues;
type DashboardSection = PricingDashboardSection;

const SECTIONS: Array<{ id: DashboardSection; label: string }> = [
  { id: "camionero", label: "Camionero" },
  { id: "imperial", label: "Imperial" },
  { id: "torpedo", label: "Torpedo" },
  { id: "criollo", label: "Criollo" },
  { id: "extras", label: "Adicionales" },
];

function shortRuleLabel(definition: PricingRuleDefinition) {
  const label = definition.label.split(" · ").at(-1) ?? definition.label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function toEditableValues(state: PricingAdminState): EditableValues {
  return Object.fromEntries(state.definitions.map((definition) => [
    definition.rule_key,
    state.draft.values[definition.rule_key]?.toString() ?? "",
  ]));
}

function NavIcon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{children}</svg>;
}

function PriceTagIcon() {
  return <NavIcon><path d="M4 7.5V4h3.5L20 16.5 16.5 20 4 7.5Z" /><circle cx="7.5" cy="7.5" r="1.25" /></NavIcon>;
}

function ExtrasIcon() {
  return <NavIcon><path d="M5 7h14M5 12h14M5 17h14" /><circle cx="9" cy="7" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="11" cy="17" r="1.5" /></NavIcon>;
}

function ExternalIcon() {
  return <NavIcon><path d="M14 5h5v5M19 5l-8 8" /><path d="M17 13v5H6V7h5" /></NavIcon>;
}

function UserIcon() {
  return <NavIcon><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6" /></NavIcon>;
}

function SignOutIcon() {
  return <NavIcon><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></NavIcon>;
}

interface PriceInputProps {
  definition: PricingRuleDefinition;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  label?: string;
}

function PriceInput({ definition, value, onChange, compact = false, label }: PriceInputProps) {
  const inputId = `price-${definition.rule_key.replace(/[^a-z0-9]+/gi, "-")}`;
  const normalized = Number(value.replace(",", "."));
  const invalid = value.trim() !== "" && (!Number.isFinite(normalized) || normalized < 0);
  return (
    <label className={`pricing-field ${compact ? "pricing-field--compact" : ""}`} htmlFor={inputId}>
      <span>{label ?? definition.label}</span>
      <span className="pricing-field__control">
        <input
          id={inputId}
          type="number"
          min="0"
          max={definition.value_kind === "percent" ? 100 : undefined}
          step={definition.value_kind === "percent" ? "0.01" : "1"}
          inputMode="decimal"
          value={value}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
        <b>{definition.value_kind === "percent" ? "%" : "UYU"}</b>
      </span>
    </label>
  );
}

function PricingLogin({ onAuthenticated }: { onAuthenticated: (state: PricingAdminState) => void }) {
  const [username, setUsername] = useState("user");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await signInPricingAdmin(username, password);
      onAuthenticated(result.state);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="pricing-login-page" id="main-content">
      <form className="pricing-login" onSubmit={submit}>
        <img src="/logoma.jpg" alt="MateArte Arte y Tradición" />
        <span className="pricing-eyebrow">Control interno</span>
        <h1>Administración de precios</h1>
        <p>Ingresá para editar el catálogo que utiliza el visualizador.</p>
        <label htmlFor="pricing-username">Usuario</label>
        <input id="pricing-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
        <label htmlFor="pricing-password">Contraseña</label>
        <input id="pricing-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error && <p className="pricing-form-error" role="alert">{error}</p>}
        <button type="submit" disabled={submitting || !username.trim() || !password}>{submitting ? "Ingresando…" : "Ingresar"}</button>
        <a href="/">Volver al visualizador</a>
      </form>
    </main>
  );
}

interface FamilyEditorProps {
  familyId: string;
  definitions: PricingRuleDefinition[];
  values: EditableValues;
  onChange: (key: string, value: string) => void;
}

function FamilyEditor({ familyId, definitions, values, onChange }: FamilyEditorProps) {
  const base = definitions.find((item) => item.rule_type === "family" && item.family_id === familyId);

  return (
    <section className="pricing-family-editor" aria-labelledby={`pricing-${familyId}`}>
      <header className="pricing-section-heading">
        <h2 id={`pricing-${familyId}`}>{PRICING_FAMILY_LABELS[familyId]}</h2>
        <p>Definí el precio base de esta familia. Los cueros y grabados se administran en Adicionales.</p>
      </header>
      {base ? (
        <div className="pricing-family-base">
          <PriceInput definition={base} label="Precio base" value={values[base.rule_key] ?? ""} onChange={(value) => onChange(base.rule_key, value)} />
          {!values[base.rule_key]?.trim() && <small>Precio pendiente</small>}
        </div>
      ) : <p className="pricing-form-error">No se encontró el campo de precio base.</p>}
    </section>
  );
}

function ExtrasTable({ title, definitions, values, onChange }: { title: string; definitions: PricingRuleDefinition[]; values: EditableValues; onChange: (key: string, value: string) => void }) {
  return (
    <section className="pricing-extras-section pricing-extras-section--boxed" aria-labelledby={`extras-${title.toLowerCase().replace(" ", "-")}`}>
      <h3 id={`extras-${title.toLowerCase().replace(" ", "-")}`}>{title}</h3>
      <div className="pricing-table-wrap">
        <table className="pricing-extras-table">
          <thead><tr><th scope="col">Concepto</th><th scope="col">Importe</th></tr></thead>
          <tbody>{definitions.map((definition) => <tr key={definition.rule_key}><th scope="row">{shortRuleLabel(definition)}</th><td><PriceInput compact definition={definition} label={definition.value_kind === "percent" ? "Porcentaje" : "Precio"} value={values[definition.rule_key] ?? ""} onChange={(value) => onChange(definition.rule_key, value)} /></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function ExtrasEditor({ definitions, values, onChange }: Omit<FamilyEditorProps, "familyId">) {
  const customization = definitions.filter((item) => item.rule_type === "customization");
  const commission = definitions.filter((item) => item.rule_type === "commission");
  const leathers = definitions.filter((item) => item.rule_key.startsWith("leather:"));
  const silver = definitions.filter((item) => item.rule_key === "metal:plata-900");
  const laser = customization.filter((item) => item.customization_id?.startsWith("laser:"));
  const bronze = customization.filter((item) => item.customization_id?.startsWith("bronze-applique:"));
  return (
    <section className="pricing-family-editor" aria-labelledby="pricing-extras">
      <header className="pricing-section-heading"><h2 id="pricing-extras">Adicionales</h2><p>Cueros, metales, técnicas de grabado y medios de pago.</p></header>
      <div className="pricing-extras-list">
        <ExtrasTable title="Cueros" definitions={leathers} values={values} onChange={onChange} />
        <ExtrasTable title="Plata 900" definitions={silver} values={values} onChange={onChange} />
        <ExtrasTable title="Láser" definitions={laser} values={values} onChange={onChange} />
        <ExtrasTable title="Aplique de bronce" definitions={bronze} values={values} onChange={onChange} />
        <ExtrasTable title="Mercado Pago" definitions={commission} values={values} onChange={onChange} />
      </div>
    </section>
  );
}

export function PricingDashboard() {
  const { refresh: refreshPublicPricing } = usePricing();
  const [adminState, setAdminState] = useState<PricingAdminState | null>(null);
  const [values, setValues] = useState<EditableValues>({});
  const [section, setSection] = useState<DashboardSection>("camionero");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);

  useEffect(() => {
    let active = true;
    void getPricingAdminSession().then(async (session) => {
      if (!session) return;
      try {
        const state = await loadPricingAdminState();
        if (active) setAdminState(state);
      } catch {
        await signOutPricingAdmin();
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (adminState) setValues(toEditableValues(adminState)); }, [adminState]);

  const issues = useMemo(() => adminState ? validatePricingValues(adminState.definitions, values) : [], [adminState, values]);
  const savedValues = useMemo(() => adminState ? toEditableValues(adminState) : {}, [adminState]);
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(savedValues), [savedValues, values]);
  const errorCounts = useMemo(() => {
    if (!adminState) return new Map<DashboardSection, number>();
    const definitionsByKey = new Map(adminState.definitions.map((definition) => [definition.rule_key, definition]));
    const counts = new Map<DashboardSection, number>();
    issues.forEach((issue) => {
      const definition = definitionsByKey.get(issue.key);
      const target = definition ? getDashboardSectionForDefinition(definition) : "extras";
      counts.set(target, (counts.get(target) ?? 0) + 1);
    });
    return counts;
  }, [adminState, issues]);

  const changeValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setMessage(null);
    setError(null);
  };

  const applyPrices = async () => {
    if (!adminState) return;
    setBusy(true);
    setError(null);
    try {
      const nextState = await saveAndPublishPricing(adminState, getNumericPricingValues(values));
      setAdminState(nextState);
      setConfirmApply(false);
      setMessage("Precios actualizados");
      await refreshPublicPricing(true);
    } catch (reason) {
      const messageText = reason instanceof Error ? reason.message : "No se pudieron actualizar los precios.";
      setConfirmApply(false);
      if (/otra sesión/i.test(messageText)) {
        try {
          const latest = await loadPricingAdminState();
          setAdminState(latest);
          setError("Otra sesión modificó los precios. Recargamos los valores actuales para evitar que se sobrescriban.");
        } catch {
          setError(messageText);
        }
      } else {
        setError(messageText);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className="pricing-loading" id="main-content">Verificando acceso…</main>;
  if (!adminState) return <PricingLogin onAuthenticated={(state) => { setAdminState(state); setLoading(false); }} />;

  return (
    <div className="pricing-dashboard">
      <a className="brand-skip-link" href="#main-content">Saltar al contenido</a>
      <aside className="pricing-sidebar">
        <header className="pricing-sidebar__brand"><img src="/logoma.jpg" alt="MateArte Arte y Tradición" /><strong>MateArte</strong><small>Control de precios</small></header>
        <nav className="pricing-sidebar__nav" aria-label="Secciones de precios">
          {SECTIONS.map((item) => {
            const sectionErrors = errorCounts.get(item.id) ?? 0;
            return <button key={item.id} type="button" className={section === item.id ? "is-active" : ""} aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}>{item.id === "extras" ? <ExtrasIcon /> : <PriceTagIcon />}<span>{item.label}</span>{sectionErrors > 0 && <b aria-label={`${sectionErrors} errores`}>{sectionErrors}</b>}</button>;
          })}
          <a href="/"><ExternalIcon /><span>Ver visualizador</span></a>
        </nav>
        <footer className="pricing-sidebar__footer">
          <div><UserIcon /><strong>user</strong></div>
          <button type="button" onClick={() => void signOutPricingAdmin().then(() => setAdminState(null))}><SignOutIcon /><span>Cerrar sesión</span></button>
        </footer>
      </aside>

      <div className="pricing-workspace">
        <header className="pricing-page-header">
          <div><h1>Precios del visualizador</h1><p>Editá los importes del catálogo y aplicalos cuando estén listos.</p></div>
          <div className="pricing-page-actions">{dirty && <span>Cambios sin aplicar</span>}<button type="button" disabled={!dirty || issues.length > 0 || busy} onClick={() => setConfirmApply(true)}>{busy ? "Aplicando…" : "Guardar y aplicar"}</button></div>
        </header>

        <div className="pricing-feedback" aria-live="polite">
          {message && <p className="pricing-success">{message}</p>}
          {error && <p className="pricing-form-error" role="alert">{error}</p>}
          {!error && issues.length > 0 && <p className="pricing-form-error" role="alert"><strong>{issues.length} {issues.length === 1 ? "precio necesita" : "precios necesitan"} revisión.</strong> {issues[0].message}.</p>}
        </div>

        <main id="main-content" className="pricing-dashboard__content">
          {section === "extras" ? <ExtrasEditor definitions={adminState.definitions} values={values} onChange={changeValue} /> : <FamilyEditor familyId={section} definitions={adminState.definitions} values={values} onChange={changeValue} />}
        </main>
      </div>

      {confirmApply && (
        <div className="brand-modal pricing-confirmation" role="dialog" aria-modal="true" aria-labelledby="apply-pricing-title">
          <div><h2 id="apply-pricing-title">¿Guardar y aplicar estos precios?</h2><p>Los nuevos importes quedarán disponibles para todos los usuarios del visualizador.</p><div className="brand-modal__actions"><button type="button" className="brand-button brand-button--secondary" onClick={() => setConfirmApply(false)}>Cancelar</button><button type="button" className="brand-button" disabled={busy} onClick={() => void applyPrices()}>{busy ? "Aplicando…" : "Confirmar"}</button></div></div>
        </div>
      )}
    </div>
  );
}
