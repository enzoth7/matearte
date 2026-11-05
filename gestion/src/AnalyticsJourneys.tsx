import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { callAnalytics } from './analyticsApi';
import { compareAnalyticsChange, shiftAnalyticsDay } from './analyticsComparison';
import './analyticsJourneys.css';

type Journey = 'catalog' | 'custom';
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
const percent = (value: number, base: number) => base > 0 ? `${Math.round(value / base * 100)} %` : 'Sin muestra';
const duration = (ms: number) => ms < 60000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60000)} min`;

export function AnalyticsJourneys() {
  const [days, setDays] = useState(90);
  const [device, setDevice] = useState('');
  const [journey, setJourney] = useState('');
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
    void callAnalytics<Report>('report', { start, end, device: device || null, journey: journey || null })
      .then((value) => { if (active) { setReport(value); setError(''); } })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [start, end, device, journey, refresh]);
  const selected: Journey[] = journey ? [journey as Journey] : ['catalog', 'custom'];
  const vercel = useMemo(() => {
    const rows = report?.vercel.filter((row) => row.status === 'complete') || [];
    return { web: rows.filter((row) => row.site === 'web').reduce((sum, row) => sum + (row.pageviews || 0), 0), personalizer: rows.filter((row) => row.site === 'personalizer').reduce((sum, row) => sum + (row.pageviews || 0), 0), complete: rows.length, expected: days * 2 };
  }, [report, days]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      await callAnalytics('markChange', { changedOn, description, journey: affected });
      setDescription(''); setRefresh((value) => value + 1); setError('');
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  };
  return <div className="analytics-journeys">
    <header className="analytics-head"><div><p className="analytics-eyebrow">Analítica</p><h1>Recorridos hasta el carrito</h1><p>Sesiones identificadas con un código aleatorio que alcanzaron cada paso. Los tiempos cuentan solo mientras la pantalla estuvo visible.</p></div></header>
    <div className="analytics-filters">
      <label>Período <select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 días completos</option><option value={30}>30 días completos</option><option value={90}>90 días completos</option></select></label>
      <label>Dispositivo <select value={device} onChange={(event) => setDevice(event.target.value)}><option value="">Todos</option><option value="mobile">Móvil</option><option value="tablet">Tableta</option><option value="desktop">Escritorio</option></select></label>
      <label>Recorrido <select value={journey} onChange={(event) => setJourney(event.target.value)}><option value="">Ambos</option><option value="catalog">Catálogo</option><option value="custom">Personalizado</option></select></label>
    </div>
    {error && <p className="analytics-error" role="alert">{error}</p>}
    {loading && <p role="status">Cargando recorridos...</p>}
    {!loading && report && <>
      <p className="analytics-window">Del {start} al {end}. Los recorridos propios empiezan el {report.activated_on || 'día de activación'}.</p>
      <div className="analytics-maps">{selected.map((key) => <section className="analytics-card" key={key} aria-label={key === 'catalog' ? 'Recorrido del catálogo' : 'Recorrido personalizado'}>
        <h2>{key === 'catalog' ? 'Compra desde el catálogo' : 'Compra personalizada'}</h2>
        <p>La meta es ver el carrito con al menos un artículo de este recorrido.</p>
        <ol className="analytics-steps">{maps[key].map(({ step, label }, index) => {
          const reached = report.steps.find((row) => row.journey === key && row.step === step)?.sessions || 0;
          const prior = index ? report.steps.find((row) => row.journey === key && row.step === maps[key][index - 1].step)?.sessions || 0 : 0;
          const samples = report.daily.filter((row) => row.journey === key && row.step === step && row.day >= start && row.day <= end);
          const screens = samples.reduce((sum, row) => sum + row.screen_samples, 0);
          const visible = samples.reduce((sum, row) => sum + Number(row.visible_ms), 0);
          const scroll25 = samples.reduce((sum, row) => sum + row.scroll_25, 0);
          const scroll50 = samples.reduce((sum, row) => sum + row.scroll_50, 0);
          const scroll75 = samples.reduce((sum, row) => sum + row.scroll_75, 0);
          const scroll90 = samples.reduce((sum, row) => sum + row.scroll_90, 0);
          return <li key={step}><div className="analytics-step-top"><strong>{label}</strong><span>{count(reached)} sesiones</span></div><div className="analytics-step-bar"><span style={{ width: `${Math.min(100, reached / Math.max(1, report.steps.find((row) => row.journey === key && row.step === 'entry')?.sessions || 1) * 100)}%` }} /></div><p>{index ? `Avance ${percent(reached, prior)}, abandono observado ${percent(Math.max(0, prior - reached), prior)}` : 'Inicio del recorrido'}{screens ? `, tiempo visible promedio ${duration(visible / screens)}, muestra ${count(screens)} pantallas. Desplazamiento: 25 % ${percent(scroll25, screens)}, 50 % ${percent(scroll50, screens)}, 75 % ${percent(scroll75, screens)}, 90 % ${percent(scroll90, screens)}` : ', sin muestra de tiempo todavía'}</p></li>;
        })}</ol>
      </section>)}</div>
      <div className="analytics-context"><section className="analytics-card"><h2>Contexto de Vercel</h2><p>Vistas de página archivadas, sin sumar visitantes únicos diarios.</p><div className="analytics-context-values"><span>Web <strong>{count(vercel.web)}</strong></span><span>Personalizador <strong>{count(vercel.personalizer)}</strong></span></div><small>{vercel.complete} de {vercel.expected} registros diarios disponibles. Los días pendientes no cuentan como cero.</small></section>
      <section className="analytics-card"><h2>GA4 y Clarity</h2>{report.ga4.status === 'ready' ? <p>GA4: {count(report.ga4.sessions || 0)} sesiones, {count(report.ga4.pageViews || 0)} vistas, {duration((report.ga4.engagementSeconds || 0) * 1000 / Math.max(1, report.ga4.activeUsers || 0))} de interacción por usuario activo, {count(report.ga4.scrolledUsers || 0)} personas llegaron al 90 %.</p> : <p>{report.ga4.status === 'error' ? 'GA4 no respondió. Revisá su conexión.' : 'GA4 pendiente de conectar.'}</p>}{report.clarityUrl ? <a href={report.clarityUrl} target="_blank" rel="noreferrer">Abrir mapas y grabaciones en Clarity</a> : <p>Clarity pendiente de conectar.</p>}</section></div>
      <section className="analytics-card analytics-changes"><h2>Cambios y comparación</h2><p>Se comparan los 14 días completos anteriores y posteriores. Se excluye el día del cambio. La diferencia observada no demuestra su causa.</p>
        <form onSubmit={(event) => void submit(event)}><label>Fecha <input type="date" max={today} value={changedOn} onChange={(event) => setChangedOn(event.target.value)} required /></label><label>Parte afectada <select value={affected} onChange={(event) => setAffected(event.target.value)}><option value="both">Ambos recorridos</option><option value="catalog">Catálogo</option><option value="custom">Personalizador</option></select></label><label className="analytics-description">Descripción <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} minLength={3} placeholder="Ejemplo: cambiamos el botón de entrada" required /></label><button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Marcar cambio'}</button></form>
        {report.changes.length ? <ul>{report.changes.map((change) => { const result = compareAnalyticsChange(change, report.daily, report.activated_on, today); return <li key={change.id}><strong>{change.changed_on}: {change.description}</strong><span>{change.journey === 'both' ? 'Ambos' : change.journey === 'catalog' ? 'Catálogo' : 'Personalizador'}</span><p>{result.status === 'pending' ? 'Comparación pendiente: faltan días completos o datos anteriores a la activación.' : `Llegada al carrito: ${percent(result.before.cart, result.before.entry)} antes (${count(result.before.entry)} entradas), ${percent(result.after.cart, result.after.entry)} después (${count(result.after.entry)} entradas). Diferencia observada: ${result.difference >= 0 ? '+' : ''}${result.difference.toFixed(1)} puntos porcentuales.`}</p></li>; })}</ul> : <p>Todavía no hay cambios marcados en este período.</p>}
      </section>
    </>}
  </div>;
}
