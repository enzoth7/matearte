import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const BUCKET = 'site-announcements';
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const STOREFRONT_ORIGIN = (import.meta.env.NEXT_PUBLIC_SITE_URL || '')
  .trim().replace(/^["']|["']$/g, '').replace(/\\[rn]+$/, '').replace(/\/$/, '');

export type SiteAnnouncement = {
  id: string;
  image_path: string;
  original_name: string;
  alt_text: string;
  mime_type: string;
  byte_size: number;
  valid_from: string;
  valid_until: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

type AnnouncementForm = {
  id: string;
  altText: string;
  validFrom: string;
  validUntil: string;
  enabled: boolean;
};

export const montevideoDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const plusDays = (date: string, days: number) => {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

const emptyForm = (): AnnouncementForm => {
  const today = montevideoDate();
  return { id: '', altText: 'Aviso de Matearte', validFrom: today, validUntil: plusDays(today, 7), enabled: true };
};

export function announcementStatus(
  announcement: Pick<SiteAnnouncement, 'enabled' | 'valid_from' | 'valid_until'>,
  today = montevideoDate(),
) {
  if (!announcement.enabled) return 'Deshabilitado';
  if (today < announcement.valid_from) return 'Programado';
  if (today > announcement.valid_until) return 'Vencido';
  return 'Visible ahora';
}

const publicImageUrl = (path: string) => path.startsWith('/')
  ? `${STOREFRONT_ORIGIN}${path}`
  : supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

export function Announcements({ onNotice }: { onNotice: (value: string) => void }) {
  const [announcements, setAnnouncements] = useState<SiteAnnouncement[]>([]);
  const [form, setForm] = useState<AnnouncementForm>(() => emptyForm());
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(() => announcements.find(item => item.id === form.id) || null, [announcements, form.id]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('site_announcements')
      .select('id,image_path,original_name,alt_text,mime_type,byte_size,valid_from,valid_until,enabled,created_at,updated_at')
      .order('created_at', { ascending: false });
    if (loadError) setError(loadError.message);
    else { setAnnouncements((data || []) as SiteAnnouncement[]); setError(''); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!file) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const reset = () => { setForm(emptyForm()); setFile(null); setError(''); };

  const edit = (announcement: SiteAnnouncement) => {
    setForm({
      id: announcement.id,
      altText: announcement.alt_text,
      validFrom: announcement.valid_from,
      validUntil: announcement.valid_until,
      enabled: announcement.enabled,
    });
    setFile(null);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const chooseFile = (next: File | null) => {
    setError('');
    if (!next) { setFile(null); return; }
    if (!ACCEPTED_TYPES.includes(next.type)) {
      setError('Usá una imagen JPG, PNG o WebP.');
      return;
    }
    if (next.size > MAX_BYTES) {
      setError('La imagen no puede superar 8 MB.');
      return;
    }
    setFile(next);
    if (form.altText === 'Aviso de Matearte') {
      setForm(current => ({ ...current, altText: next.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }));
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!selected && !file) { setError('Seleccioná la imagen del aviso.'); return; }
    if (!form.validFrom || !form.validUntil || form.validUntil < form.validFrom) {
      setError('La fecha final debe ser igual o posterior a la fecha inicial.');
      return;
    }
    const altText = form.altText.trim();
    if (!altText) { setError('Escribí una descripción breve de la imagen.'); return; }

    setSaving(true);
    if (selected) {
      const { error: updateError } = await supabase.from('site_announcements').update({
        alt_text: altText,
        valid_from: form.validFrom,
        valid_until: form.validUntil,
        enabled: form.enabled,
      }).eq('id', selected.id);
      if (updateError) setError(updateError.message);
      else {
        onNotice('Aviso actualizado.');
        reset();
        await load();
      }
      setSaving(false);
      return;
    }

    const extension = file!.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const imagePath = `${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${extension}`;
    const uploaded = await supabase.storage.from(BUCKET).upload(imagePath, file!, {
      cacheControl: '31536000', contentType: file!.type, upsert: false,
    });
    if (uploaded.error) {
      setError(uploaded.error.message);
      setSaving(false);
      return;
    }
    const inserted = await supabase.from('site_announcements').insert({
      image_path: imagePath,
      original_name: file!.name,
      alt_text: altText,
      mime_type: file!.type,
      byte_size: file!.size,
      valid_from: form.validFrom,
      valid_until: form.validUntil,
      enabled: form.enabled,
    });
    if (inserted.error) {
      await supabase.storage.from(BUCKET).remove([imagePath]);
      setError(inserted.error.message);
    } else {
      onNotice('Aviso publicado.');
      reset();
      await load();
    }
    setSaving(false);
  };

  const toggle = async (announcement: SiteAnnouncement) => {
    setError('');
    const { error: toggleError } = await supabase.from('site_announcements')
      .update({ enabled: !announcement.enabled }).eq('id', announcement.id);
    if (toggleError) setError(toggleError.message);
    else {
      onNotice(announcement.enabled ? 'Aviso deshabilitado.' : 'Aviso habilitado.');
      await load();
    }
  };

  const currentPreview = previewUrl || (selected ? publicImageUrl(selected.image_path) : '');

  return <div className="announcements-workspace">
    <section className="panel announcement-form-panel" aria-labelledby="announcement-form-title">
      <div className="panel-heading">
        <div>
          <h2 id="announcement-form-title">{selected ? 'Editar aviso' : 'Nuevo aviso'}</h2>
          <p>La imagen aparecerá al entrar al inicio durante las fechas indicadas.</p>
        </div>
        {selected && <button type="button" className="secondary-button" onClick={reset}>Nuevo</button>}
      </div>
      <form className="announcement-form" onSubmit={save}>
        {!selected && <label className="announcement-upload">
          <span>Imagen</span>
          <input aria-label="Imagen del aviso" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => chooseFile(event.target.files?.[0] || null)} />
          <small>JPG, PNG o WebP · máximo 8 MB.</small>
        </label>}
        {currentPreview && <div className="announcement-preview"><img src={currentPreview} alt={form.altText || 'Vista previa del aviso'} /></div>}
        <label><span>Descripción accesible</span><input aria-label="Descripción accesible" required maxLength={240} value={form.altText} onChange={event => setForm(current => ({ ...current, altText: event.target.value }))} /></label>
        <div className="announcement-date-grid">
          <label><span>Mostrar desde</span><input aria-label="Mostrar desde" required type="date" value={form.validFrom} onChange={event => setForm(current => ({ ...current, validFrom: event.target.value }))} /></label>
          <label><span>Mostrar hasta</span><input aria-label="Mostrar hasta" required type="date" value={form.validUntil} onChange={event => setForm(current => ({ ...current, validUntil: event.target.value }))} /></label>
        </div>
        <label className="announcement-enabled"><input type="checkbox" checked={form.enabled} onChange={event => setForm(current => ({ ...current, enabled: event.target.checked }))} /><span>Habilitado</span></label>
        {error && <div className="error" role="alert">{error}</div>}
        <button type="submit" disabled={saving}>{saving ? 'Guardando…' : selected ? 'Guardar cambios' : 'Publicar aviso'}</button>
      </form>
    </section>

    <section className="data-panel announcement-list-panel" aria-labelledby="announcement-list-title">
      <div className="data-panel-header"><h2 id="announcement-list-title">Avisos creados</h2><span>{announcements.length}</span></div>
      {loading ? <div className="loading-inline">Cargando avisos…</div> : announcements.length ? <div className="announcement-list">
        {announcements.map(announcement => {
          const status = announcementStatus(announcement);
          return <article className="announcement-card" key={announcement.id}>
            <img src={publicImageUrl(announcement.image_path)} alt="" />
            <div className="announcement-card-copy">
              <div><strong>{announcement.original_name}</strong><span className={`announcement-status announcement-status-${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</span></div>
              <p>{announcement.alt_text}</p>
              <small>{announcement.valid_from} — {announcement.valid_until}</small>
              <div className="announcement-card-actions">
                <button type="button" className="secondary-button" onClick={() => edit(announcement)}>Editar</button>
                <button type="button" className="secondary-button" onClick={() => void toggle(announcement)}>{announcement.enabled ? 'Deshabilitar' : 'Habilitar'}</button>
              </div>
            </div>
          </article>;
        })}
      </div> : <div className="empty-state">Todavía no hay avisos para la tienda.</div>}
    </section>
  </div>;
}
