import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { TOP_BAR_MESSAGE_COLUMNS, validTopBarLink, type TopBarAction, type TopBarMessageRow } from '../../../shared/top-bar-messages';

type MessageForm = {
  id: string;
  textEs: string;
  textEn: string;
  textPt: string;
  action: TopBarAction;
  actionLabel: string;
  linkUrl: string;
  sortOrder: string;
  enabled: boolean;
};

const actionLabels: Record<TopBarAction, string> = { none: 'Solo texto', subscribe: 'Abrir suscripción', link: 'Enlace' };

const emptyForm = (nextOrder: number): MessageForm => ({
  id: '', textEs: '', textEn: '', textPt: '', action: 'none', actionLabel: '', linkUrl: '', sortOrder: String(nextOrder), enabled: true,
});

/** Mensajes de la barra negra fija de la web: agregar, editar, ordenar, pausar y eliminar. */
export function TopBarMessagesPanel({ onNotice }: { onNotice: (value: string) => void }) {
  const [rows, setRows] = useState<TopBarMessageRow[]>([]);
  const [form, setForm] = useState<MessageForm>(() => emptyForm(10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const nextOrder = (list: TopBarMessageRow[]) => (list.reduce((max, row) => Math.max(max, row.sort_order), 0) + 10);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase.from('site_top_bar_messages').select(TOP_BAR_MESSAGE_COLUMNS)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (loadError) setError(loadError.message);
    else { setRows((data || []) as TopBarMessageRow[]); setError(''); }
    setLoading(false);
    return (data || []) as TopBarMessageRow[];
  }, []);

  useEffect(() => { void load().then(list => setForm(current => current.id ? current : emptyForm(nextOrder(list)))); }, [load]);

  const edit = (row: TopBarMessageRow) => setForm({
    id: row.id, textEs: row.text_es, textEn: row.text_en || '', textPt: row.text_pt || '', action: row.action,
    actionLabel: row.action_label || '', linkUrl: row.link_url || '', sortOrder: String(row.sort_order), enabled: row.enabled,
  });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const textEs = form.textEs.trim();
    const order = Number(form.sortOrder);
    if (!textEs || textEs.length > 160) { setError('Escribí el mensaje en español, de hasta 160 caracteres.'); return; }
    if (form.textEn.length > 160 || form.textPt.length > 160) { setError('Las traducciones pueden tener hasta 160 caracteres.'); return; }
    if (form.action !== 'none' && form.actionLabel.trim().length > 40) { setError('El texto del enlace puede tener hasta 40 caracteres.'); return; }
    if (form.action === 'link' && !validTopBarLink(form.linkUrl)) { setError('El enlace debe empezar con / (página de la web) o con https://.'); return; }
    if (!Number.isInteger(order)) { setError('El orden debe ser un número entero.'); return; }
    const payload = {
      text_es: textEs,
      text_en: form.textEn.trim() || null,
      text_pt: form.textPt.trim() || null,
      action: form.action,
      action_label: form.action === 'none' ? null : form.actionLabel.trim() || null,
      link_url: form.action === 'link' ? form.linkUrl.trim() : null,
      sort_order: order,
      enabled: form.enabled,
    };
    setSaving(true);
    const result = form.id
      ? await supabase.from('site_top_bar_messages').update(payload).eq('id', form.id).select('id').single()
      : await supabase.from('site_top_bar_messages').insert(payload).select('id').single();
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    onNotice(form.id ? 'Mensaje de la barra actualizado.' : 'Mensaje agregado a la barra.');
    const list = await load();
    setForm(emptyForm(nextOrder(list)));
  };

  const toggle = async (row: TopBarMessageRow) => {
    const { error: toggleError } = await supabase.from('site_top_bar_messages').update({ enabled: !row.enabled }).eq('id', row.id);
    if (toggleError) { setError(toggleError.message); return; }
    onNotice(row.enabled ? 'Mensaje pausado.' : 'Mensaje activado.');
    await load();
  };

  const remove = async (row: TopBarMessageRow) => {
    if (!window.confirm(`¿Eliminar el mensaje "${row.text_es}"? No se puede deshacer.`)) return;
    const { error: deleteError } = await supabase.from('site_top_bar_messages').delete().eq('id', row.id);
    if (deleteError) { setError(deleteError.message); return; }
    onNotice('Mensaje eliminado.');
    const list = await load();
    if (form.id === row.id) setForm(emptyForm(nextOrder(list)));
  };

  return (
    <div className="top-bar-messages-workspace">
      <section className="panel" aria-labelledby="top-bar-form-title">
        <div className="panel-heading">
          <div>
            <h2 id="top-bar-form-title">{form.id ? 'Editar mensaje de la barra negra' : 'Mensajes de la barra negra'}</h2>
          </div>
          {form.id && <button type="button" className="secondary-button" onClick={() => setForm(emptyForm(nextOrder(rows)))}>Nuevo</button>}
        </div>
        <form className="discount-form" onSubmit={save}>
          <label><div>Mensaje en español</div><input aria-label="Mensaje en español" required maxLength={160} value={form.textEs} onChange={event => setForm(current => ({ ...current, textEs: event.target.value }))} /></label>
          <label><div>Mensaje en inglés (opcional)</div><input aria-label="Mensaje en inglés" maxLength={160} value={form.textEn} onChange={event => setForm(current => ({ ...current, textEn: event.target.value }))} /></label>
          <label><div>Mensaje en portugués (opcional)</div><input aria-label="Mensaje en portugués" maxLength={160} value={form.textPt} onChange={event => setForm(current => ({ ...current, textPt: event.target.value }))} /></label>
          <label><div>Acción</div>
            <select aria-label="Acción del mensaje" value={form.action} onChange={event => setForm(current => ({ ...current, action: event.target.value as TopBarAction }))}>
              {(Object.keys(actionLabels) as TopBarAction[]).map(action => <option key={action} value={action}>{actionLabels[action]}</option>)}
            </select>
          </label>
          {form.action !== 'none' && <label><div>Texto del enlace (opcional, por defecto "Click aquí")</div><input aria-label="Texto del enlace" maxLength={40} value={form.actionLabel} onChange={event => setForm(current => ({ ...current, actionLabel: event.target.value }))} /></label>}
          {form.action === 'link' && <label><div>Dirección del enlace</div><input aria-label="Dirección del enlace" required placeholder="/catalogo o https://..." value={form.linkUrl} onChange={event => setForm(current => ({ ...current, linkUrl: event.target.value }))} /></label>}
          {form.action === 'subscribe' && <div>Abre el popup de suscripción con 10%. El mensaje se oculta si no hay oferta de bienvenida activa o si la persona ya se suscribió.</div>}
          <label><div>Orden</div><input aria-label="Orden del mensaje" type="number" step="1" value={form.sortOrder} onChange={event => setForm(current => ({ ...current, sortOrder: event.target.value }))} /></label>
          <label className="discount-enabled"><input type="checkbox" checked={form.enabled} onChange={event => setForm(current => ({ ...current, enabled: event.target.checked }))} /><div>Visible en la web</div></label>
          {error && <div className="error" role="alert">{error}</div>}
          <button type="submit" disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Agregar mensaje'}</button>
        </form>
      </section>

      <section className="data-panel" aria-label="Mensajes de la barra">
        {loading ? <div className="loading-inline">Cargando mensajes…</div> : rows.length === 0 ? <div className="discount-group-empty">Todavía no hay mensajes. La barra solo muestra el descuento general cuando está vigente.</div> : (
          <div className="table-wrap"><table className="data-table">
            <thead><tr><th>Orden</th><th>Mensaje</th><th>Acción</th><th>Estado</th><th><div className="sr-only">Acciones</div></th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.id}>
              <td data-label="Orden">{row.sort_order}</td>
              <td data-label="Mensaje"><button type="button" className="discount-code-button" onClick={() => edit(row)}>{row.text_es}</button></td>
              <td data-label="Acción">{actionLabels[row.action]}{row.action === 'link' && row.link_url ? `: ${row.link_url}` : ''}</td>
              <td data-label="Estado"><div className={`discount-status discount-status-${row.enabled ? 'habilitado' : 'deshabilitado'}`}>{row.enabled ? 'Visible' : 'Pausado'}</div></td>
              <td data-label="Acción" className="action-column">
                <button type="button" className="secondary-button" onClick={() => edit(row)}>Editar</button>
                <button type="button" className="secondary-button" onClick={() => void toggle(row)}>{row.enabled ? 'Pausar' : 'Activar'}</button>
                <button type="button" className="secondary-button" onClick={() => void remove(row)}>Eliminar</button>
              </td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
