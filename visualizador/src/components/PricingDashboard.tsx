import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { mateDecisionCatalog, type MateFamilyDefinition } from "../catalog/mateDecisionCatalog";
import { getTexturePricingRuleKeys } from "../catalog/pricingCatalog";
import { usePricing } from "../context/PricingContext";
import {
  getPricingAdminSession,
  loadPricingAdminState,
  publishPricingDraft,
  savePricingDraft,
  signInPricingAdmin,
  signOutPricingAdmin,
  type PricingAdminState,
  type PricingRuleDefinition,
} from "../lib/pricingAdmin";
import {
  getDashboardSectionForDefinition,
  getNumericPricingValues,
  validatePricingValues,
  type EditablePricingValues,
  type PricingDashboardSection,
} from "./pricingDashboardUtils";

type EditableValues = EditablePricingValues;
type DashboardSection = PricingDashboardSection;

const SECTIONS: Array<{ id: DashboardSection; label: string }> = [
  ...mateDecisionCatalog.map((family) => ({ id: family.id, label: family.label })),
  { id: "extras", label: "Adicionales" },
];

const TECHNIQUE_META = [
  { id: "laser", title: "Láser" },
  { id: "bronze-applique", title: "Aplique de bronce" },
  { id: "alpaca-applique", title: "Aplique de alpaca" },
] as const;

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
  const invalid = value.trim() !== "" && (!Number.isFinite(normalized) || normalized < 0 || (definition.value_kind === "percent" && normalized > 100));
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
        <img src="/assets/marca/LogoOriginal.jpg" alt="MateArte Arte y Tradición" />
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

function FamilyEditor({ family, definitions, values, onChange }: {
  family: MateFamilyDefinition;
  definitions: PricingRuleDefinition[];
  values: EditableValues;
  onChange: (key: string, value: string) => void;
}) {
  const definitionsByKey = new Map(definitions.map((definition) => [definition.rule_key, definition]));
  const base = definitionsByKey.get(family.pricingRuleKeys[0]);
  const editableTrees = family.textures.map((texture) => ({
    texture,
    definitions: getTexturePricingRuleKeys(texture)
      .map((key) => definitionsByKey.get(key))
      .filter((definition): definition is PricingRuleDefinition => Boolean(definition?.family_id === family.id)),
  })).filter((tree) => tree.definitions.length > 0);

  return (
    <section className="pricing-family-editor" aria-labelledby={`pricing-${family.id}`}>
      <header className="pricing-section-heading">
        <h2 id={`pricing-${family.id}`}>{family.label}</h2>
      </header>

      <div className="pricing-family-base">
        {base
          ? <PriceInput definition={base} label="Precio base de la familia" value={values[base.rule_key] ?? ""} onChange={(value) => onChange(base.rule_key, value)} />
          : <p className="pricing-form-error">No se encontró el precio base de {family.label}.</p>}
      </div>

      {editableTrees.length > 0 && <div className="pricing-texture-list">
        {editableTrees.map(({ texture, definitions: treeDefinitions }, index) => (
          <details className="pricing-texture" key={texture.id} open={index === 0}>
            <summary><span>{texture.label}</span></summary>
            <div className="pricing-texture__body">
              <div className="pricing-rule-grid">{treeDefinitions.map((definition) => <PriceInput key={definition.rule_key} definition={definition} value={values[definition.rule_key] ?? ""} onChange={(value) => onChange(definition.rule_key, value)} />)}</div>
            </div>
          </details>
        ))}
      </div>}
    </section>
  );
}

function ExtrasTable({ title, definitions, values, onChange }: {
  title: string;
  definitions: PricingRuleDefinition[];
  values: EditableValues;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <section className="pricing-extras-section pricing-extras-section--boxed">
      <header><h3>{title}</h3></header>
      <div className="pricing-table-wrap">
        <table className="pricing-extras-table">
          <thead><tr><th scope="col">Concepto</th><th scope="col">Importe</th></tr></thead>
          <tbody>
            {definitions.map((definition) => <tr key={definition.rule_key}><th scope="row">{definition.label}</th><td><PriceInput compact definition={definition} label={definition.value_kind === "percent" ? "Porcentaje" : "Precio"} value={values[definition.rule_key] ?? ""} onChange={(value) => onChange(definition.rule_key, value)} /></td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ExtrasEditor({ definitions, values, onChange }: {
  definitions: PricingRuleDefinition[];
  values: EditableValues;
  onChange: (key: string, value: string) => void;
}) {
  const leathers = definitions.filter((definition) => definition.rule_key.startsWith("leather:"));
  const metals = definitions.filter((definition) => definition.rule_key.startsWith("metal:") && !definition.family_id);
  const commission = definitions.filter((definition) => definition.rule_type === "commission");

  return (
    <section className="pricing-family-editor" aria-labelledby="pricing-extras">
      <header className="pricing-section-heading"><h2 id="pricing-extras">Adicionales</h2></header>
      <div className="pricing-extras-list">
        <ExtrasTable title="Cueros compartidos" definitions={leathers} values={values} onChange={onChange} />
        <ExtrasTable title="Metales compartidos" definitions={metals} values={values} onChange={onChange} />
        {TECHNIQUE_META.map((technique) => (
          <ExtrasTable
            key={technique.id}
            title={technique.title}
            definitions={definitions.filter((definition) => definition.customization_id?.startsWith(`${technique.id}:`))}
            values={values}
            onChange={onChange}
          />
        ))}
        <ExtrasTable title="Medio de pago" definitions={commission} values={values} onChange={onChange} />
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
  const [confirmPublish, setConfirmPublish] = useState(false);

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

  const publishIssues = useMemo(() => adminState ? validatePricingValues(adminState.definitions, values) : [], [adminState, values]);
  const draftIssues = useMemo(() => adminState ? validatePricingValues(adminState.definitions, values, false) : [], [adminState, values]);
  const savedValues = useMemo(() => adminState ? toEditableValues(adminState) : {}, [adminState]);
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(savedValues), [savedValues, values]);
  const publishedChangeCount = useMemo(() => {
    if (!adminState) return 0;
    const numericValues = getNumericPricingValues(values);
    return adminState.definitions.filter((definition) => numericValues[definition.rule_key] !== (adminState.published.values[definition.rule_key] ?? null)).length;
  }, [adminState, values]);
  const errorCounts = useMemo(() => {
    if (!adminState) return new Map<DashboardSection, number>();
    const definitionsByKey = new Map(adminState.definitions.map((definition) => [definition.rule_key, definition]));
    const counts = new Map<DashboardSection, number>();
    publishIssues.forEach((issue) => {
      const definition = definitionsByKey.get(issue.key);
      const target = definition ? getDashboardSectionForDefinition(definition) : "extras";
      counts.set(target, (counts.get(target) ?? 0) + 1);
    });
    return counts;
  }, [adminState, publishIssues]);

  const changeValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setMessage(null);
    setError(null);
  };

  const saveDraft = async () => {
    if (!adminState || draftIssues.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      const nextState = await savePricingDraft(adminState, getNumericPricingValues(values));
      setAdminState(nextState);
      setMessage("Borrador guardado");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el borrador.");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!adminState || dirty || publishIssues.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      const nextState = await publishPricingDraft(adminState);
      setAdminState(nextState);
      setConfirmPublish(false);
      setMessage("Precios publicados");
      await refreshPublicPricing(true);
    } catch (reason) {
      setConfirmPublish(false);
      setError(reason instanceof Error ? reason.message : "No se pudieron publicar los precios.");
    } finally {
      setBusy(false);
    }
  };

  const reload = async () => {
    setBusy(true);
    setError(null);
    try {
      setAdminState(await loadPricingAdminState());
      setMessage("Datos recargados");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron recargar los precios.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className="pricing-loading" id="main-content">Cargando panel…</main>;
  if (!adminState) return <PricingLogin onAuthenticated={(state) => { setAdminState(state); setError(null); }} />;

  const selectedFamily = section === "extras" ? null : mateDecisionCatalog.find((family) => family.id === section) ?? null;

  return (
    <div className="pricing-dashboard">
      <a className="brand-skip-link" href="#main-content">Saltar al contenido</a>
      <aside className="pricing-sidebar">
        <header className="pricing-sidebar__brand"><img src="/assets/marca/LogoOriginal.jpg" alt="MateArte Arte y Tradición" /><strong>MateArte</strong><small>Control de precios</small></header>
        <nav className="pricing-sidebar__nav" aria-label="Secciones de precios">
          {SECTIONS.map((item) => {
            const sectionErrors = errorCounts.get(item.id) ?? 0;
            return <button key={item.id} type="button" className={section === item.id ? "is-active" : ""} aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}>{item.id === "extras" ? <ExtrasIcon /> : <PriceTagIcon />}<span>{item.label}</span>{sectionErrors > 0 && <b aria-label={`${sectionErrors} precios pendientes`}>{sectionErrors}</b>}</button>;
          })}
          <a href="/" target="_blank" rel="noreferrer"><ExternalIcon /><span>Abrir visualizador</span></a>
        </nav>
        <footer className="pricing-sidebar__footer"><div><UserIcon /><span>Administrador</span></div><button type="button" onClick={() => void signOutPricingAdmin().then(() => setAdminState(null))}><SignOutIcon /><span>Cerrar sesión</span></button></footer>
      </aside>

      <main className="pricing-workspace" id="main-content">
        <header className="pricing-page-header">
          <div><h1>Precios</h1></div>
          <div className="pricing-page-actions">
            <span>{dirty ? "Cambios sin guardar" : publishIssues.length > 0 ? `${publishIssues.length} valores pendientes` : "Borrador guardado"}</span>
            <button type="button" className="pricing-action-secondary" disabled={busy || !dirty || draftIssues.length > 0} onClick={() => void saveDraft()}>{busy && dirty ? "Guardando…" : "Guardar borrador"}</button>
            <button type="button" disabled={busy || dirty || publishIssues.length > 0 || publishedChangeCount === 0} onClick={() => setConfirmPublish(true)}>Publicar</button>
          </div>
        </header>

        <div className="pricing-feedback" aria-live="polite">
          {error && <p className="pricing-form-error" role="alert">{error} <button type="button" onClick={() => void reload()}>Recargar</button></p>}
          {message && <p className="pricing-success">{message}</p>}
          {draftIssues.length > 0 && <p className="pricing-form-error" role="alert">{draftIssues[0].message}</p>}
        </div>

        <div className="pricing-dashboard__content">
          {selectedFamily
            ? <FamilyEditor family={selectedFamily} definitions={adminState.definitions} values={values} onChange={changeValue} />
            : <ExtrasEditor definitions={adminState.definitions} values={values} onChange={changeValue} />}
        </div>
      </main>

      {confirmPublish && (
        <div className="brand-modal pricing-confirmation" role="dialog" aria-modal="true" aria-labelledby="publish-prices-title">
          <div><h2 id="publish-prices-title">Publicar precios</h2><p>Se publicarán {publishedChangeCount} cambios. El visualizador y el checkout empezarán a usar estos valores.</p><div className="brand-modal__actions"><button type="button" className="brand-button brand-button--secondary" disabled={busy} onClick={() => setConfirmPublish(false)}>Cancelar</button><button type="button" className="brand-button" disabled={busy} onClick={() => void publish()}>{busy ? "Publicando…" : "Confirmar publicación"}</button></div></div>
        </div>
      )}
    </div>
  );
}
