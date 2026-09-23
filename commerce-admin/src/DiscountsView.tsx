import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

export type DiscountKind = 'percentage' | 'fixed';
export type CommerceDiscount = {
  id: string;
  code: string;
  discount_type: DiscountKind;
  value: number;
  valid_from: string;
  valid_until: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

type DiscountForm = {
  id: string;
  code: string;
  discountType: DiscountKind;
  value: string;
  validFrom: string;
  validUntil: string;
  enabled: boolean;
};

const montevideoDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const plusDays = (date: string, days: number) => {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

const emptyForm = (): DiscountForm => {
  const today = montevideoDate();
  return { id: '', code: '', discountType: 'percentage', value: '', validFrom: today, validUntil: plusDays(today, 30), enabled: true };
};

export const normalizeAdminDiscountCode = (value: string) => value
  .toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);

export function discountStatus(discount: Pick<CommerceDiscount, 'enabled' | 'valid_from' | 'valid_until'>, today = montevideoDate()) {
  if (!discount.enabled) return 'Deshabilitado';
  if (today < discount.valid_from) return 'Programado';
  if (today > discount.valid_until) return 'Vencido';
  return 'Habilitado';
}

export function generateDiscountCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `MATE-${Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')}`;
}

const displayValue = (discount: CommerceDiscount) => discount.discount_type === 'percentage'
  ? `${Number(discount.value).toLocaleString('es-UY')}%`
  : new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(Number(discount.value) / 100);

export function Discounts({ onNotice }: { onNotice: (value: string) => void }) {
  const [discounts, setDiscounts] = useState<CommerceDiscount[]>([]);
  const [form, setForm] = useState<DiscountForm>(() => emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('commerce_discounts')
      .select('id,code,discount_type,value,valid_from,valid_until,enabled,created_at,updated_at')
      .order('created_at', { ascending: false });
    if (loadError) setError(loadError.message);
    else { setDiscounts((data || []) as CommerceDiscount[]); setError(''); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => discounts.find(item => item.id === form.id) || null, [discounts, form.id]);
  const edit = (discount: CommerceDiscount) => setForm({
    id: discount.id,
    code: discount.code,
    discountType: discount.discount_type,
    value: discount.discount_type === 'fixed' ? String(Number(discount.value) / 100) : String(discount.value),
    validFrom: discount.valid_from,
    validUntil: discount.valid_until,
    enabled: discount.enabled,
  });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const code = normalizeAdminDiscountCode(form.code);
    const enteredValue = Number(form.value.replace(',', '.'));
    if (!/^[A-Z0-9][A-Z0-9_-]{3,31}$/.test(code)) {
      setError('El código debe tener entre 4 y 32 caracteres: letras, números, guion o guion bajo.');
      setSaving(false);
      return;
    }
    if (!Number.isFinite(enteredValue) || enteredValue <= 0 || (form.discountType === 'percentage' && enteredValue >= 100)) {
      setError(form.discountType === 'percentage' ? 'Ingresá un porcentaje mayor a 0 y menor a 100.' : 'Ingresá un monto mayor a 0.');
      setSaving(false);
      return;
    }
    if (!form.validFrom || !form.validUntil || form.validUntil < form.validFrom) {
      setError('La fecha final debe ser igual o posterior a la fecha inicial.');
      setSaving(false);
      return;
    }
    const payload = {
      code,
      discount_type: form.discountType,
      value: form.discountType === 'fixed' ? Math.round(enteredValue * 100) : enteredValue,
      valid_from: form.validFrom,
      valid_until: form.validUntil,
      enabled: form.enabled,
    };
    const result = form.id
      ? await supabase.from('commerce_discounts').update(payload).eq('id', form.id)
      : await supabase.from('commerce_discounts').insert(payload);
    if (result.error) {
      setError(result.error.code === '23505' ? 'Ya existe un descuento con ese código.' : result.error.message);
    } else {
      onNotice(form.id ? `Descuento ${code} actualizado.` : `Descuento ${code} creado.`);
      setForm(emptyForm());
      await load();
    }
    setSaving(false);
  };

  const toggle = async (discount: CommerceDiscount) => {
    setError('');
    const { error: toggleError } = await supabase.from('commerce_discounts').update({ enabled: !discount.enabled }).eq('id', discount.id);
    if (toggleError) setError(toggleError.message);
    else {
      onNotice(`${discount.code} ${discount.enabled ? 'deshabilitado' : 'habilitado'}.`);
      await load();
    }
  };

  return (
    <div className="discounts-workspace">
      <section className="panel discount-form-panel" aria-labelledby="discount-form-title">
        <div className="panel-heading">
          <div><p className="eyebrow">Promociones</p><h2 id="discount-form-title">{selected ? 'Editar descuento' : 'Nuevo descuento'}</h2></div>
          {selected && <button type="button" className="secondary-button" onClick={() => setForm(emptyForm())}>Nuevo</button>}
        </div>
        <form onSubmit={save} className="discount-form">
          <label className="discount-code-field">
            <span>Código</span>
            <span className="discount-code-control">
              <input required minLength={4} maxLength={32} value={form.code} onChange={event => setForm(current => ({ ...current, code: normalizeAdminDiscountCode(event.target.value) }))}/>
              <button type="button" className="secondary-button" onClick={() => setForm(current => ({ ...current, code: generateDiscountCode() }))}>Generar</button>
            </span>
          </label>
          <label><span>Tipo</span><select value={form.discountType} onChange={event => setForm(current => ({ ...current, discountType: event.target.value as DiscountKind, value: '' }))}><option value="percentage">Porcentaje</option><option value="fixed">Monto fijo</option></select></label>
          <label><span>{form.discountType === 'percentage' ? 'Porcentaje' : 'Monto en UYU'}</span><input required type="number" min="0.01" max={form.discountType === 'percentage' ? '99.99' : undefined} step={form.discountType === 'percentage' ? '0.01' : '1'} value={form.value} onChange={event => setForm(current => ({ ...current, value: event.target.value }))}/></label>
          <div className="discount-date-grid">
            <label><span>Válido desde</span><input required type="date" value={form.validFrom} onChange={event => setForm(current => ({ ...current, validFrom: event.target.value }))}/></label>
            <label><span>Válido hasta</span><input required type="date" value={form.validUntil} onChange={event => setForm(current => ({ ...current, validUntil: event.target.value }))}/></label>
          </div>
          <label className="discount-enabled"><input type="checkbox" checked={form.enabled} onChange={event => setForm(current => ({ ...current, enabled: event.target.checked }))}/><span>Habilitado para nuevos pagos</span></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={saving}>{saving ? 'Guardando…' : selected ? 'Guardar cambios' : 'Crear descuento'}</button>
        </form>
      </section>

      <section className="data-panel discount-list-panel" aria-labelledby="discount-list-title">
        <div className="data-panel-header"><div><p className="eyebrow">Códigos</p><h2 id="discount-list-title">Descuentos creados</h2></div><span>{discounts.length}</span></div>
        {loading ? <p className="loading-inline">Cargando descuentos…</p> : discounts.length ? (
          <div className="table-wrap"><table className="data-table discount-table"><thead><tr><th>Código</th><th>Beneficio</th><th>Vigencia</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>
            {discounts.map(discount => <tr key={discount.id}>
              <td><button type="button" className="discount-code-button" onClick={() => edit(discount)}>{discount.code}</button></td>
              <td>{displayValue(discount)}</td>
              <td>{discount.valid_from} — {discount.valid_until}</td>
              <td><span className={`discount-status discount-status-${discountStatus(discount).toLowerCase()}`}>{discountStatus(discount)}</span></td>
              <td className="action-column"><button type="button" className="secondary-button" onClick={() => void toggle(discount)}>{discount.enabled ? 'Deshabilitar' : 'Habilitar'}</button></td>
            </tr>)}
          </tbody></table></div>
        ) : <p className="empty-state">Todavía no hay códigos de descuento.</p>}
      </section>
    </div>
  );
}
