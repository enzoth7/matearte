import { useEffect, useMemo, useState } from 'react';
import { CaretDown, CheckCircle, FloppyDisk, MagnifyingGlass, SlidersHorizontal, WarningCircle, X } from '@phosphor-icons/react';
import {
  editablePricingValues,
  groupPersonalizerPricingDefinitions,
  loadPersonalizerPricing,
  numericPricingValues,
  pricingIssues,
  publishPersonalizerPricingDraft,
  savePersonalizerPricingDraft,
  type PricingRuleDefinition,
  type PersonalizerPricingState,
} from './personalizerPricing';

const priceNumber = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 });

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'No se pudo cargar la configuración.';
}

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function PriceField({ definition, value, published, onChange }: {
  definition: PricingRuleDefinition;
  value: string;
  published: number | undefined;
  onChange: (value: string) => void;
}) {
  const isPercent = definition.value_kind === 'percent';
  const unit = isPercent ? '%' : 'UYU';
  const invalid = value.trim() !== '' && (!Number.isFinite(Number(value.replace(',', '.'))) || Number(value.replace(',', '.')) < 0 || (isPercent && Number(value.replace(',', '.')) > 100));
  const inputId = `personalizer-price-${definition.rule_key.replace(/[^a-z0-9-]/gi, '-')}`;
  const publishedLabel = published == null ? 'Sin valor publicado' : `${priceNumber.format(published)} ${unit}`;

  return <div className={`personalizer-price-field${invalid ? ' personalizer-price-field--invalid' : ''}`}>
    <label htmlFor={inputId}>{definition.label}{definition.required && ' *'}</label>
    <div className="personalizer-price-field__bottom">
      <div className="personalizer-price-field__published">Publicado: <strong>{publishedLabel}</strong></div>
      <div className="personalizer-price-field__control">
        <input
          id={inputId}
          type="number"
          min="0"
          max={isPercent ? 100 : undefined}
          step={isPercent ? '0.01' : '1'}
          inputMode="decimal"
          value={value}
          aria-invalid={invalid}
          aria-required={definition.required}
          onChange={(event) => onChange(event.target.value)}
        />
        <div aria-hidden="true">{unit}</div>
      </div>
    </div>
    {invalid && <small className="personalizer-price-field__error">Ingresá un valor válido{isPercent ? ' entre 0 y 100' : ' mayor o igual a cero'}.</small>}
  </div>;
}

export function PersonalizerPricingView() {
  const [state, setState] = useState<PersonalizerPricingState | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmPublish, setConfirmPublish] = useState(false);

  const applyState = (next: PersonalizerPricingState) => {
    setState(next);
    setValues(editablePricingValues(next));
  };

  const reload = async () => {
    setBusy(true);
    setError('');
    try {
      applyState(await loadPersonalizerPricing());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void loadPersonalizerPricing().then((next) => {
      if (!active) return;
      applyState(next);
    }).catch((reason) => {
      if (active) setError(errorMessage(reason));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const definitions = state?.definitions ?? [];
  const groups = useMemo(() => groupPersonalizerPricingDefinitions(definitions), [definitions]);
  const normalizedQuery = normalizeSearch(query);
  const visibleGroups = groups.map((group) => ({
    ...group,
    definitions: !normalizedQuery || normalizeSearch(group.title).includes(normalizedQuery)
      ? group.definitions
      : group.definitions.filter((definition) => normalizeSearch(`${definition.label} ${definition.rule_key}`).includes(normalizedQuery)),
  })).filter((group) => group.definitions.length);
  const savedValues = useMemo(() => state ? editablePricingValues(state) : {}, [state]);
  const dirty = JSON.stringify(values) !== JSON.stringify(savedValues);
  const draftIssues = pricingIssues(definitions, values, false);
  const publishIssues = pricingIssues(definitions, values, true);
  const currentNumbers = numericPricingValues(values);
  const publishedChangeCount = state ? definitions.filter((definition) =>
    currentNumbers[definition.rule_key] !== (state.published.values[definition.rule_key] ?? null)).length : 0;

  const changeValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setNotice('');
    setError('');
    setConfirmPublish(false);
  };

  const changeQuery = (next: string) => {
    setQuery(next);
    setExpandedGroups({});
  };

  const save = async () => {
    if (!state || busy || draftIssues.length) return;
    setBusy(true);
    setError('');
    try {
      applyState(await savePersonalizerPricingDraft(state, numericPricingValues(values)));
      setNotice('Borrador guardado. Los precios publicados todavía no cambiaron.');
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!state || busy || dirty || publishIssues.length) return;
    setBusy(true);
    setError('');
    try {
      applyState(await publishPersonalizerPricingDraft(state));
      setConfirmPublish(false);
      setNotice('Precios publicados. El Personalizador y el checkout usarán estos valores en la próxima carga.');
    } catch (reason) {
      setConfirmPublish(false);
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <section className="personalizer-pricing personalizer-pricing--loading" aria-label="Cargando configurador"><div className="personalizer-pricing__loading-card"><SlidersHorizontal size={26} /><strong>Cargando configuración del Personalizador</strong></div></section>;
  if (!state) return <section className="personalizer-pricing personalizer-pricing--empty" role="alert"><WarningCircle size={28} /><h2>No se pudo abrir la configuración</h2><div>{error}</div><button type="button" className="secondary" onClick={() => void reload()} disabled={busy}>Reintentar</button></section>;

  const status = dirty ? 'Cambios sin guardar' : publishIssues.length ? `${publishIssues.length} valores pendientes` : 'Borrador guardado';

  return <section className="personalizer-pricing" aria-label="Configurar Personalizador">
    <div className="personalizer-pricing__actions">
      <div className="personalizer-pricing__status"><CheckCircle size={20} aria-hidden="true" /><strong>{status}</strong></div>
      <div className="personalizer-pricing__action-buttons">
        <button type="button" className="secondary" disabled={busy || !dirty || draftIssues.length > 0} onClick={() => void save()}><FloppyDisk size={18} />{busy && dirty ? 'Guardando…' : 'Guardar borrador'}</button>
        <button type="button" className="primary" disabled={busy || dirty || publishIssues.length > 0 || publishedChangeCount === 0} onClick={() => setConfirmPublish(true)}>Publicar precios</button>
      </div>
    </div>

    {error && <div className="personalizer-pricing__message personalizer-pricing__message--error" role="alert">{error} <button type="button" onClick={() => void reload()} disabled={busy}>Recargar</button></div>}
    {notice && <div className="personalizer-pricing__message" role="status">{notice}</div>}
    {draftIssues.length > 0 && <div className="personalizer-pricing__message personalizer-pricing__message--error" role="alert">{draftIssues[0]}</div>}

    <div className="personalizer-pricing__catalog-header">
      <h3>Todos los parámetros</h3>
      <label className="personalizer-pricing__search"><MagnifyingGlass size={19} aria-hidden="true" /><input type="search" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="Buscar un precio…" aria-label="Buscar precios del Personalizador" />{query && <button type="button" onClick={() => changeQuery('')} aria-label="Limpiar búsqueda"><X size={17} /></button>}</label>
    </div>

    {visibleGroups.length ? <div className="personalizer-pricing__groups">
      {visibleGroups.map((group) => {
        const expanded = expandedGroups[group.id] ?? Boolean(normalizedQuery);
        const headingId = `personalizer-group-${group.id}`;
        const fieldsId = `personalizer-group-fields-${group.id}`;
        return <section className="personalizer-pricing__group" key={group.id} aria-labelledby={headingId}>
          <h4 id={headingId}><button type="button" className="personalizer-pricing__group-toggle" aria-expanded={expanded} aria-controls={fieldsId} onClick={() => setExpandedGroups((current) => ({ ...current, [group.id]: !(current[group.id] ?? Boolean(normalizedQuery)) }))}>
            <strong className="personalizer-pricing__group-title">{group.title}</strong>
            <div className="personalizer-pricing__group-meta"><small className="personalizer-pricing__count">{group.definitions.length} {group.definitions.length === 1 ? 'regla' : 'reglas'}</small><CaretDown size={19} aria-hidden="true" /></div>
          </button></h4>
          <div className="personalizer-pricing__fields" id={fieldsId} hidden={!expanded}>{group.definitions.map((definition) => <PriceField key={definition.rule_key} definition={definition} value={values[definition.rule_key] ?? ''} published={state.published.values[definition.rule_key]} onChange={(value) => changeValue(definition.rule_key, value)} />)}</div>
        </section>;
      })}
    </div> : <div className="personalizer-pricing__no-results">No encontramos precios para “{query}”. <button type="button" onClick={() => changeQuery('')}>Ver todos</button></div>}

    {confirmPublish && <div className="personalizer-pricing__confirm" role="dialog" aria-modal="true" aria-labelledby="personalizer-publish-title">
      <div><h3 id="personalizer-publish-title">Publicar precios</h3><div>Se publicarán {publishedChangeCount} cambios. El Personalizador y el checkout usarán estos valores para nuevas compras.</div><div><button type="button" className="secondary" disabled={busy} onClick={() => setConfirmPublish(false)}>Cancelar</button><button type="button" className="primary" disabled={busy} onClick={() => void publish()}>{busy ? 'Publicando…' : 'Confirmar publicación'}</button></div></div>
    </div>}
  </section>;
}
