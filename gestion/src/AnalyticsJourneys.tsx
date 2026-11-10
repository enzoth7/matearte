import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { callAnalytics } from './analyticsApi';
import { compareAnalyticsChange, shiftAnalyticsDay } from './analyticsComparison';
import { Stats } from './ui';
import './analyticsJourneys.css';

type Journey = 'catalog' | 'custom';
export type AnalyticsSection = 'journeys' | 'ga4' | 'clarity' | 'vercel' | 'changes';
type Step = { journey: Journey; step: string; sessions: number };
type Daily = { day: string; journey: Journey; step: string; sessions: number; screen_samples: number; visible_ms: number; scroll_25: number; scroll_50: number; scroll_75: number; scroll_90: number };
type VercelDay = { day: string; site: 'web' | 'personalizer'; status: 'complete' | 'pending'; pageviews: number | null; daily_visitors: number | null; pages: { route: string; pageviews: number }[]; error: string | null };
type Change = { id: string; changed_on: string; journey: Journey | 'both'; description: string };
type Report = { steps: Step[]; daily: Daily[]; vercel: VercelDay[]; changes: Change[]; activated_on: string | null; ga4: { status: string; activeUsers?: number; sessions?: number; pageViews?: number; engagementSeconds?: number; scrolledUsers?: number }; clarityUrl: string };

const maps: Record<Journey, { step: string; label: string }[]> = {
  catalog: [{ step: 'entry', label: 'Entrada a la web' }, { step: 'catalog', label: 'Catálogo' }, { step: 'product', label: 'Producto' }, { step: 'cart', label: 'Carrito con artículo' }],
  custom: [{ step: 'entry', label: 'Entrada a la web' }, { step: 'custom_page', label: 'Página de personalizados' }, { step: 'personalizer_open', label: 'Personalizador abierto' }, { step: 'mate_selected', label: 'Mate elegido' }, { step: 'design_started', label: 'Diseño iniciado' }, { step: 'summary', label: 'Resumen' }, { step: 'cart', label: 'Carrito con artículo' }],
};
const shift = shiftAnalyticsDay;
const todayUy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const count = (value: number) => Math.round(value).toLocaleString('es-UY');
const percent = (value: number, base: number) => base > 0 ? Math.round(value / base * 100) + ' %' : 'Sin muestra';
const duration = (ms: number) => ms < 60000 ? Math.round(ms / 1000) + ' s' : Math.round(ms / 60000) + ' min';
const dateLabel = (day: string) => new Intl.DateTimeFormat('es-UY', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(day + 'T12:00:00Z'));

function JourneyPanel({ report, selected, start, end }: { report: Report; selected: Journey; start: string; end: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const steps = maps[selected].map(({ step, label }, index) => {
    const reached = report.steps.find((row) => row.journey === selected && row.step === step)?.sessions || 0;
    const prior = index ? report.steps.find((row) => row.journey === selected && row.step === maps[selected][index - 1].step)?.sessions || 0 : 0;
    const samples = report.daily.filter((row) => row.journey === selected && row.step === step && row.day >= start && row.day <= end);
    return {
      step, label, reached, prior, index,
      screens: samples.reduce((sum, row) => sum + row.screen_samples, 0),
      visible: samples.reduce((sum, row) => sum + Number(row.visible_ms), 0),
      scroll: [25, 50, 75, 90].map((threshold) => samples.reduce((sum, row) => sum + row[('scroll_' + threshold) as 'scroll_25'], 0)),
    };
  });
  const entry = steps[0].reached;
  const cart = steps.at(-1)?.reached || 0;
  const largestDrop = steps.slice(1).filter((step) => step.prior > 0)
    .sort((left, right) => (right.prior - right.reached) / right.prior - (left.prior - left.reached) / left.prior)[0];
  return <>
    <div className="analytics-kpis">
      <Stats layout="hero" items={[
        { label: 'Llegaron al carrito', value: count(cart), tone: 'green', solid: true, note: 'Con al menos un artículo de este recorrido' },
        { label: 'Mayor abandono', value: largestDrop ? percent(Math.max(0, largestDrop.prior - largestDrop.reached), largestDrop.prior) : '—', tone: 'red', solid: true, note: largestDrop ? 'Antes de ' + largestDrop.label.toLowerCase() : 'Faltan pasos medidos' },
        { label: 'Tasa de llegada', value: percent(cart, entry), tone: 'yellow', note: 'Sobre las entradas' },
        { label: 'Entradas', value: count(entry), tone: 'brown', note: 'Sesiones que iniciaron el recorrido' },
      ]} />
    </div>
    <section className="analytics-card analytics-funnel" aria-label={selected === 'catalog' ? 'Recorrido del catálogo' : 'Recorrido personalizado'}>
      <div className="analytics-section-heading"><h2>{selected === 'catalog' ? 'Compra desde el catálogo' : 'Compra personalizada'}</h2></div>
      <div className="analytics-help">Cada barra muestra qué parte de las entradas alcanzó ese paso. El avance compara con el paso anterior.</div>
      <ol className="analytics-steps">{steps.map(({ step, label, reached, prior, index, screens, visible, scroll }) => {
        const isOpen = expanded === step;
        const detailId = 'analytics-scroll-' + selected + '-' + step;
        return <li key={step}>
          <div className="analytics-step-main">
            <div className="analytics-step-index">{String(index + 1).padStart(2, '0')}</div>
            <div className="analytics-step-body">
              <div className="analytics-step-top"><strong>{label}</strong><div>{count(reached)} {reached === 1 ? 'sesión' : 'sesiones'}</div></div>
              <div className="analytics-step-bar" aria-hidden="true"><div style={{ width: Math.min(100, reached / Math.max(1, entry) * 100) + '%' }} /></div>
              <div className="analytics-step-meta"><div>{index ? 'Avance ' + percent(reached, prior) : 'Inicio del recorrido'}</div>{index > 0 && <div>Abandono observado {percent(Math.max(0, prior - reached), prior)}</div>}<div>{screens ? 'Visible ' + duration(visible / screens) + ' en ' + count(screens) + ' pantallas' : 'Sin muestra de tiempo'}</div></div>
              {screens > 0 && <><button type="button" className="analytics-detail-toggle" aria-expanded={isOpen} aria-controls={detailId} onClick={() => setExpanded(isOpen ? null : step)}>{isOpen ? 'Ocultar desplazamiento' : 'Ver desplazamiento'}</button><div id={detailId} className="analytics-scroll-detail" hidden={!isOpen}><div>Porcentaje de pantallas medidas que alcanzó cada profundidad:</div><div>{[25, 50, 75, 90].map((threshold, i) => <div key={threshold}><strong>{threshold} %</strong><b>{percent(scroll[i], screens)}</b></div>)}</div></div></>}
            </div>
          </div>
        </li>;
      })}</ol>
    </section>
  </>;
}

export function AnalyticsJourneys({ section }: { section: AnalyticsSection }) {
  const [selectedJourney, setSelectedJourney] = useState<Journey>('catalog');
  const [days, setDays] = useState(90);
  const [device, setDevice] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [description, setDescription] = useState('');
  const [changedOn, setChangedOn] = useState(todayUy());
  const [affected, setAffected] = useState('both');
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const today = todayUy();
  const end = shift(today, -1), start = shift(end, 1 - days);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void callAnalytics<Report>('report', { start, end, device: device || null, journey: null, section })
      .then((value) => { if (active) { setReport(value); setError(''); } })
      .catch((reason) => { if (active) { setReport(null); setError(reason.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [start, end, device, section, refresh]);

  const vercel = useMemo(() => {
    const rows = report?.vercel.filter((row) => row.status === 'complete') || [];
    return { web: rows.filter((row) => row.site === 'web').reduce((sum, row) => sum + (row.pageviews || 0), 0), personalizer: rows.filter((row) => row.site === 'personalizer').reduce((sum, row) => sum + (row.pageviews || 0), 0), complete: rows.length, expected: days * 2 };
  }, [report, days]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await callAnalytics('markChange', { changedOn, description, journey: affected });
      setDescription('');
      setRefresh((value) => value + 1);
      setError('');
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  };
  return <div className="analytics-journeys">
    <div className="analytics-toolbar"><label>Período <select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 días completos</option><option value={30}>30 días completos</option><option value={90}>90 días completos</option></select></label>{section === 'journeys' && <label>Dispositivo <select value={device} onChange={(event) => setDevice(event.target.value)}><option value="">Todos</option><option value="mobile">Móvil</option><option value="tablet">Tableta</option><option value="desktop">Escritorio</option></select></label>}<div>Del {dateLabel(start)} al {dateLabel(end)}</div></div>
    {error && <div className="analytics-error" role="alert"><div>{error}</div><button type="button" onClick={() => setRefresh((value) => value + 1)}>Reintentar</button></div>}
    {loading && <div role="status" className="analytics-loading-state">Cargando datos de Analítica...</div>}
    {!loading && report && <div className="analytics-panel">
      {section === 'journeys' && <>
        <div className="analytics-panel-intro"><div><h2>Avance por recorrido</h2><div>Una sesión cuenta cuando alcanza cada paso. El tiempo incluye solo los momentos con la pantalla visible.</div></div></div>
        <div className="analytics-journey-switch" role="group" aria-label="Recorrido">
          <button type="button" aria-pressed={selectedJourney === 'catalog'} onClick={() => setSelectedJourney('catalog')}>Catálogo</button>
          <button type="button" aria-pressed={selectedJourney === 'custom'} onClick={() => setSelectedJourney('custom')}>Personalizador</button>
        </div>
        <JourneyPanel key={selectedJourney} report={report} selected={selectedJourney} start={start} end={end} />
      </>}
      {section === 'ga4' && <>
        <div className="analytics-panel-intro">
          <div><h2>Google Analytics 4</h2><div>Interacción general de la web y el personalizador durante el período elegido.</div></div>
          <a className="analytics-open-link" href="https://analytics.google.com/analytics/web/" target="_blank" rel="noreferrer">Abrir Google Analytics</a>
        </div>
        {report.ga4.status === 'ready' ? <>
          <div className="analytics-kpis"><Stats layout="hero" items={[
            { label: 'Sesiones', value: count(report.ga4.sessions || 0), tone: 'green', solid: true },
            { label: 'Vistas de página', value: count(report.ga4.pageViews || 0), tone: 'brown' },
            { label: 'Interacción media', value: report.ga4.activeUsers ? duration((report.ga4.engagementSeconds || 0) * 1000 / report.ga4.activeUsers) : '—', tone: 'yellow', note: 'Por usuario activo' },
            { label: 'Llegaron al 90 %', value: count(report.ga4.scrolledUsers || 0), tone: 'brown', note: 'Usuarios con desplazamiento profundo' },
          ]} /></div>
          <div className="analytics-source-note">{count(report.ga4.activeUsers || 0)} usuarios activos. GA4 mide ambos sitios y puede diferir de los recorridos propios. El filtro de dispositivo se aplica solo a Recorridos.</div>
        </> : <section className="analytics-card analytics-empty">
          <h3>{report.ga4.status === 'error' ? 'No se pudieron cargar los datos de GA4' : 'GA4 todavía no está conectado'}</h3>
          <div>{report.ga4.status === 'error' ? 'Actualizá para volver a consultar la conexión.' : 'Las métricas aparecerán acá cuando la conexión esté disponible.'}</div>
        </section>}
      </>}
      {section === 'clarity' && <>
        <div className="analytics-panel-intro"><h2>Microsoft Clarity</h2></div>
        <section className="analytics-card analytics-source-card">
          <div><div>Observá clics, desplazamiento y sesiones concretas.</div>{report.clarityUrl ? <a className="analytics-open-link" href={report.clarityUrl} target="_blank" rel="noreferrer">Abrir Clarity</a> : <div>Clarity pendiente de conectar.</div>}</div>
        </section>
      </>}
      {section === 'vercel' && <>
        <div className="analytics-panel-intro"><h2>Vercel Web Analytics</h2></div>
        <div className="analytics-kpis analytics-kpis-three"><Stats layout="hero" items={[
          { label: 'Vistas de la web', value: count(vercel.web), tone: 'green', solid: true },
          { label: 'Vistas del personalizador', value: count(vercel.personalizer), tone: 'yellow' },
          { label: 'Registros disponibles', value: count(vercel.complete) + ' de ' + count(vercel.expected), tone: 'brown', note: 'Dos sitios por día' },
        ]} /></div>
        <div className="analytics-source-note">Los días pendientes no cuentan como cero. Las visitas de días distintos no se suman como visitantes únicos del período. El panel de Marketing conserva su Analytics habitual.</div>
      </>}
      {section === 'changes' && <><div className="analytics-panel-intro"><div><h2>Cambios y comparación</h2><div>Marcá una modificación para comparar los 14 días completos anteriores y posteriores. Se excluye el día del cambio.</div></div></div><section className="analytics-card analytics-changes"><h3>Marcar un cambio</h3><form onSubmit={(event) => void submit(event)}><label>Fecha <input type="date" max={today} value={changedOn} onChange={(event) => setChangedOn(event.target.value)} required /></label><label>Parte afectada <select value={affected} onChange={(event) => setAffected(event.target.value)}><option value="both">Ambos recorridos</option><option value="catalog">Catálogo</option><option value="custom">Personalizador</option></select></label><label className="analytics-description">Descripción <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} minLength={3} placeholder="Ejemplo: cambiamos el botón de entrada" required /></label><button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Marcar cambio'}</button></form><div className="analytics-source-note">La diferencia observada no demuestra por sí sola la causa del cambio.</div>{report.changes.length ? <ul>{report.changes.map((change) => { const result = compareAnalyticsChange(change, report.daily, report.activated_on, today); return <li key={change.id}><strong>{dateLabel(change.changed_on)}: {change.description}</strong><div>{change.journey === 'both' ? 'Ambos' : change.journey === 'catalog' ? 'Catálogo' : 'Personalizador'}</div><div>{result.status === 'pending' ? 'Comparación pendiente: faltan días completos o datos anteriores a la activación.' : 'Llegada al carrito: ' + percent(result.before.cart, result.before.entry) + ' antes (' + count(result.before.entry) + ' entradas), ' + percent(result.after.cart, result.after.entry) + ' después (' + count(result.after.entry) + ' entradas). Diferencia observada: ' + (result.difference >= 0 ? '+' : '') + result.difference.toFixed(1) + ' puntos porcentuales.'}</div></li>; })}</ul> : <div className="analytics-empty-copy">Todavía no hay cambios marcados en este período.</div>}</section></>}
    </div>}
  </div>;
}
