import { Fragment, useEffect, useState } from 'react';
import { commerceSource } from './commerceSource';
import { auditActions, auditDateBoundary, auditDifference, auditFieldLabel, auditTime, auditValue, type AuditContext, type AuditEvent, type AuditGroup } from './auditLogs';
import './auditLogs.css';

function AuditDetail({ group }: { group: string }) {
 const [events, setEvents] = useState<AuditEvent[]>([]);
 const [error, setError] = useState('');
 useEffect(() => {
   let cancelled = false;
   void commerceSource!.rpc('gestion_logs_detail', { p_group: group }).then(({ data, error }) => {
     if (cancelled) return;
     if (error) setError('No se pudo cargar el detalle. Cerrá y volvé a abrir el evento.');
     else setEvents(data || []);
   });
   return () => { cancelled = true; };
 }, [group]);
 if (error) return <p role="alert">{error}</p>;
 if (!events.length) return <p role="status">Cargando detalle…</p>;
 return <div className="audit-details">{events.map(event => <section key={event.id}>
   <h3>{auditActions[event.operation]}: {event.entity_type}</h3>
   <p>{event.reference}</p><small>{auditTime(event.occurred_at)}, {event.actor_name}</small>
   {event.entity_type === 'Pedido' && <p className="audit-hint">En ventas con seña, el importe registrado del pedido corresponde al cobro inicial. Los precios de los artículos y los cobros posteriores se muestran por separado.</p>}
   {event.changed_fields.length > 0 && <div className="audit-table-wrap"><table><thead><tr><th>Campo</th><th>Antes</th><th>Después</th><th>Diferencia</th></tr></thead><tbody>{event.changed_fields.map(key => <tr key={key}>
     <th>{auditFieldLabel(key, event)}</th><td><pre>{auditValue(event.before_values[key], key, event)}</pre></td><td><pre>{auditValue(event.after_values[key], key, event)}</pre></td><td>{auditDifference(event, key) || '—'}</td>
   </tr>)}</tbody></table></div>}
 </section>)}</div>;
}

export function AuditLogs({ pendingActivation = false }: { pendingActivation?: boolean }) {
 const [context, setContext] = useState<AuditContext | null>(null);
 const [userId, setUserId] = useState('');
 const [datePreset, setDatePreset] = useState('');
 const [operation, setOperation] = useState('');
 const [search, setSearch] = useState(''), [query, setQuery] = useState('');
 const [page, setPage] = useState(0), [revision, setRevision] = useState(0);
 const [groups, setGroups] = useState<AuditGroup[]>([]), [total, setTotal] = useState(0);
 const [expanded, setExpanded] = useState<string | null>(null);
 const [loading, setLoading] = useState(true), [error, setError] = useState('');
 useEffect(() => {
   if (pendingActivation) { setLoading(false); setContext(null); return; }
   let cancelled = false;
   setLoading(true);
   void commerceSource!.rpc('gestion_logs_context').then(({ data, error }) => {
     if (cancelled) return;
     if (error) { setError('No se pudo cargar Logs.'); setLoading(false); return; }
     const next = data as AuditContext;
     setContext(next);
     if (!next.canViewLogs) setLoading(false);
   });
   return () => { cancelled = true; };
 }, [pendingActivation]);
 useEffect(() => {
   if (!context?.canViewLogs) return;
   let cancelled = false;
   setLoading(true); setError(''); setExpanded(null);
   const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
   const daysAgo = (days: number) => { const value = new Date(`${today}T12:00:00Z`); value.setUTCDate(value.getUTCDate() - days); return value.toISOString().slice(0, 10); };
   const from = datePreset === 'today' ? today : datePreset === 'yesterday' ? daysAgo(1) : datePreset === '7' ? daysAgo(6) : datePreset === '30' ? daysAgo(29) : '';
   const until = datePreset === 'yesterday' ? daysAgo(1) : datePreset ? today : '';
   void commerceSource!.rpc('gestion_logs_list', {
     p_users: userId ? [userId] : null, p_from: auditDateBoundary(from), p_until: auditDateBoundary(until, true),
     p_operation: operation && operation !== 'money' ? operation : null, p_money_only: operation === 'money', p_search: query, p_page: page,
   }).then(({ data, error }) => {
     if (cancelled) return;
     setLoading(false);
     if (error) { setGroups([]); setError('No se pudo leer el historial. Podés volver a actualizar.'); }
     else { setGroups(data.groups || []); setTotal(data.total || 0); }
   });
   return () => { cancelled = true; };
 }, [context, userId, datePreset, operation, query, page, revision]);
 const resetPage = () => { setPage(0); setExpanded(null); };
 return <div className="audit-page">
   {pendingActivation && <section className="audit-notice" role="status"><h3>Pendiente de activación</h3><p>El registro todavía no está activo en la base de datos conectada.</p></section>}
   {context && !context.canViewLogs ? <p role="alert">No tenés acceso a Logs.</p> : context?.canViewLogs && <>
     <div className="audit-list-heading"><span>{loading ? 'Cargando…' : `${total} registros`}</span><button type="button" onClick={() => setRevision(v => v + 1)}>Actualizar</button></div>
     <div className="audit-table-scroll"><table className="audit-list"><thead><tr>
       <th><label className="audit-column-select"><select aria-label="Filtrar fecha y hora" value={datePreset} onChange={event => { setDatePreset(event.target.value); resetPage(); }}><option value="">Fecha y hora</option><option value="today">Hoy</option><option value="yesterday">Ayer</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option></select><span aria-hidden="true">⌄</span></label></th>
       <th><label className="audit-column-select"><select aria-label="Filtrar usuario" value={userId} onChange={event => { setUserId(event.target.value); resetPage(); }}><option value="">Usuario</option>{(context.users || []).map(user => <option value={user.id} key={user.id}>{user.name}</option>)}</select><span aria-hidden="true">⌄</span></label></th>
       <th><label className="audit-column-select"><select aria-label="Filtrar acción" value={operation} onChange={event => { setOperation(event.target.value); resetPage(); }}><option value="">Acción</option>{Object.entries(auditActions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="money">Cambios de importes</option></select><span aria-hidden="true">⌄</span></label></th>
       <th><form className="audit-reference-search" onSubmit={event => { event.preventDefault(); setQuery(search); resetPage(); }}><input type="search" aria-label="Buscar referencia o producto" value={search} onChange={event => { setSearch(event.target.value); if (!event.target.value) { setQuery(''); resetPage(); } }} placeholder="Referencia" /><button type="submit" aria-label="Buscar referencia">⌕</button></form></th>
       <th>Origen</th><th>Detalle</th></tr></thead><tbody>
       {!loading && !error && groups.length === 0 && <tr><td className="audit-empty" colSpan={6}>No hay registros para esta selección.</td></tr>}
       {groups.map(group => <Fragment key={group.group_id}><tr className={group.attention ? 'audit-row audit-attention' : 'audit-row'}><td><time>{auditTime(group.occurred_at)}</time></td><td><strong>{group.actor_name}</strong></td><td>{group.operations.map(action => auditActions[action] || action).join(', ')}{group.attention && <span className="audit-alert-label">Cambio de importe o eliminación</span>}</td><td className="audit-reference">{group.reference}</td><td>{group.source}</td><td><button type="button" className="audit-open" aria-expanded={expanded === group.group_id} onClick={() => setExpanded(current => current === group.group_id ? null : group.group_id)}>{expanded === group.group_id ? 'Ocultar' : `Ver cambios (${group.event_count})`}</button></td></tr>{expanded === group.group_id && <tr className="audit-expanded"><td colSpan={6}><AuditDetail group={group.group_id} /></td></tr>}</Fragment>)}
     </tbody></table></div>
     <nav className="audit-pagination" aria-label="Páginas del historial"><button disabled={loading || page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {page + 1} de {Math.max(1, Math.ceil(total / 50))}</span><button disabled={loading || (page + 1) * 50 >= total} onClick={() => setPage(p => p + 1)}>Siguiente</button></nav>
   </>}
   {loading && <p role="status">Cargando historial…</p>}{error && <p role="alert">{error}</p>}
 </div>;
}
