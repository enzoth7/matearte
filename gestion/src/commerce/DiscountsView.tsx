import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { allDiscountProducts, readDiscountScope, validDiscountScope, type DiscountCategory, type DiscountScope } from '../../../shared/discount-scope';
import { DiscountProductsSelector } from './DiscountProductsSelector';

export type DiscountKind = 'percentage' | 'fixed';
export type CommerceDiscount = DiscountScope & {
  id: string;
  code: string;
  discount_type: DiscountKind;
  value: number;
  valid_from: string;
  valid_until: string;
  enabled: boolean;
  welcome_only: boolean;
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
  welcomeOnly: boolean;
  scope: DiscountScope;
};

const montevideoDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const plusDays = (date: string, days: number) => {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

const displayDate = (date: string) => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return parts ? `${parts[3]}/${parts[2]}/${parts[1]}` : date;
};

const emptyForm = (): DiscountForm => {
  const today = montevideoDate();
  return { id: '', code: '', discountType: 'percentage', value: '', validFrom: today, validUntil: plusDays(today, 30), enabled: true, welcomeOnly: false, scope: allDiscountProducts() };
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

const discountCategory = (discount: CommerceDiscount) => {
  if (discount.code.startsWith('CUMPLE-')) return 'birthday';
  if (discount.welcome_only || discount.valid_until >= plusDays(discount.valid_from, 365)) return 'fixed';
  return 'occasional';
};

export function Discounts({ onNotice }: { onNotice: (value: string) => void }) {
  const [discounts, setDiscounts] = useState<CommerceDiscount[]>([]);
  const [categories, setCategories] = useState<DiscountCategory[]>([]);
  const [categoriesReady, setCategoriesReady] = useState(false);
  const [form, setForm] = useState<DiscountForm>(() => emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setCategoriesReady(false);
    const [discountResult, categoryResult] = await Promise.all([supabase
      .from('commerce_discounts')
      .select('id,code,discount_type,value,valid_from,valid_until,enabled,welcome_only,applicability,category_codes,include_design_items,created_at,updated_at')
      .order('created_at', { ascending: false }),
      supabase.from('commerce_categories').select('code,label_es,active').order('sort_order'),
    ]);
    const { data, error: loadError } = discountResult;
    if (loadError) setError(loadError.message);
    else if (categoryResult.error) setError('No se pudieron cargar las categorías. Actualizá para volver a intentar.');
    else { setDiscounts((data || []) as CommerceDiscount[]); setCategories(categoryResult.data || []); setCategoriesReady(true); setError(''); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => discounts.find(item => item.id === form.id) || null, [discounts, form.id]);
  const discountSections = [
    { id: 'fixed', title: 'Descuentos fijos' },
    { id: 'occasional', title: 'Descuentos ocasionales' },
    { id: 'birthday', title: 'Descuentos de cumple' },
  ].map(section => ({ ...section, items: discounts.filter(discount => discountCategory(discount) === section.id) }));
  const edit = (discount: CommerceDiscount) => setForm({
    id: discount.id,
    code: discount.code,
    discountType: discount.discount_type,
    value: discount.discount_type === 'fixed' ? String(Number(discount.value) / 100) : String(discount.value),
    validFrom: discount.valid_from,
    validUntil: discount.valid_until,
    enabled: discount.enabled,
    welcomeOnly: Boolean(discount.welcome_only),
    scope: readDiscountScope(discount),
  });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    if (!validDiscountScope(form.scope)) { setError('Seleccioná los productos del descuento.'); setSaving(false); return; }
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
    if (form.welcomeOnly && (form.discountType !== 'percentage' || enteredValue !== 10)) {
      setError('El beneficio de primera compra debe ser del 10%.');
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
      welcome_only: form.welcomeOnly,
      ...form.scope,
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

  const saveScope = async (discount: CommerceDiscount, scope: DiscountScope) => {
    const { data, error: saveError } = await supabase.from('commerce_discounts').update(scope).eq('id', discount.id).select('id').single();
    if (saveError || !data) throw new Error('No se pudieron guardar los productos. Volvé a intentar.');
    setDiscounts(current => current.map(item => item.id === discount.id ? { ...item, ...scope } : item));
    setForm(current => current.id === discount.id ? { ...current, scope } : current);
    onNotice(`Productos de ${discount.code} actualizados.`);
  };

  return (
    <div className="discounts-workspace">
      <section className="panel discount-form-panel" aria-labelledby="discount-form-title">
        <div className="panel-heading">
          <div><h2 id="discount-form-title">{selected ? 'Editar descuento' : 'Nuevo descuento'}</h2></div>
          {selected && <button type="button" className="secondary-button" onClick={() => setForm(emptyForm())}>Nuevo</button>}
        </div>
        <form onSubmit={save} className="discount-form">
          <label className="discount-code-field">
            <div>Código</div>
            <div className="discount-code-control">
              <input aria-label="Código" required minLength={4} maxLength={32} value={form.code} onChange={event => setForm(current => ({ ...current, code: normalizeAdminDiscountCode(event.target.value) }))}/>
              <button type="button" className="secondary-button" onClick={() => setForm(current => ({ ...current, code: generateDiscountCode() }))}>Generar</button>
            </div>
          </label>
          <label><div>Tipo</div><select aria-label="Tipo" value={form.discountType} onChange={event => setForm(current => ({ ...current, discountType: event.target.value as DiscountKind, value: '' }))}><option value="percentage">Porcentaje</option><option value="fixed">Monto fijo</option></select></label>
          <label><div>{form.discountType === 'percentage' ? 'Porcentaje' : 'Monto en UYU'}</div><input aria-label={form.discountType === "percentage" ? "Porcentaje" : "Monto en UYU"} required type="number" min="0.01" max={form.discountType === 'percentage' ? '99.99' : undefined} step={form.discountType === 'percentage' ? '0.01' : '1'} value={form.value} onChange={event => setForm(current => ({ ...current, value: event.target.value }))}/></label>
          <div className="discount-date-grid">
            <label><div>Válido desde</div><input aria-label="Válido desde" required type="date" value={form.validFrom} onChange={event => setForm(current => ({ ...current, validFrom: event.target.value }))}/></label>
            <label><div>Válido hasta</div><input aria-label="Válido hasta" required type="date" value={form.validUntil} onChange={event => setForm(current => ({ ...current, validUntil: event.target.value }))}/></label>
          </div>
          <div className="discount-form-products"><div>Sobre qué productos</div><DiscountProductsSelector value={form.scope} categories={categories} label="Productos del descuento" disabled={!categoriesReady || loading || saving} onSave={scope => setForm(current => ({ ...current, scope }))} /></div>
          <label className="discount-enabled"><input type="checkbox" checked={form.enabled} onChange={event => setForm(current => ({ ...current, enabled: event.target.checked }))}/><div>Habilitado para nuevos pagos</div></label>
          <label className="discount-enabled"><input type="checkbox" checked={form.welcomeOnly} onChange={event => setForm(current => ({ ...current, welcomeOnly: event.target.checked }))}/><div>Solo primera compra con suscripción confirmada</div></label>
          {error && <div className="error" role="alert">{error}</div>}
          <button type="submit" disabled={saving || loading || !categoriesReady}>{saving ? 'Guardando…' : selected ? 'Guardar cambios' : 'Crear descuento'}</button>
        </form>
      </section>

      <section className="discount-list-panel" aria-label="Descuentos creados">
        {loading ? <div className="loading-inline">Cargando descuentos…</div> : discountSections.map(section => (
          <section className="discount-group" key={section.id} aria-labelledby={`discount-group-${section.id}`}>
            <div className="discount-group-heading"><h2 id={`discount-group-${section.id}`}>{section.title}</h2><strong aria-label={`${section.items.length} descuentos`}>{section.items.length}</strong></div>
            {section.items.length ? <div className="table-wrap"><table className="data-table discount-table"><thead><tr><th>Código</th><th>Beneficio</th><th>Vigencia</th><th>Productos</th><th>Estado</th><th><div className="sr-only">Acciones</div></th></tr></thead><tbody>
              {section.items.map(discount => <tr key={discount.id}>
                <td data-label="Código"><button type="button" className="discount-code-button" title={discount.code} onClick={() => edit(discount)}>{discount.code}</button></td>
                <td data-label="Beneficio"><div className="discount-benefit"><span>{displayValue(discount)}</span>{discount.welcome_only && <span>Primera compra</span>}</div></td>
                <td data-label="Vigencia"><div className="discount-period"><span>{displayDate(discount.valid_from)}</span><span>— {displayDate(discount.valid_until)}</span></div></td>
                <td data-label="Productos"><DiscountProductsSelector value={readDiscountScope(discount)} categories={categories} label={`Productos de ${discount.code}`} disabled={!categoriesReady} onSave={scope => saveScope(discount, scope)} /></td>
                <td data-label="Estado"><div className={`discount-status discount-status-${discountStatus(discount).toLowerCase()}`}>{discountStatus(discount)}</div></td>
                <td data-label="Acción" className="action-column"><button type="button" className="secondary-button" onClick={() => void toggle(discount)}>{discount.enabled ? 'Deshabilitar' : 'Habilitar'}</button></td>
              </tr>)}
            </tbody></table></div> : <div className="discount-group-empty">Sin descuentos en esta categoría.</div>}
          </section>
        ))}
      </section>
    </div>
  );
}
