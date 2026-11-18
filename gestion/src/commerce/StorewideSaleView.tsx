import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import {
  DEFAULT_STOREWIDE_SALE, montevideoToday, readStorewideSale, salePriceMinor, STOREWIDE_SALE_COLUMNS, storewideSaleState,
  type StorewideSaleSettings, type StorewideSaleState,
} from '../../../shared/storewide-sale';

const stateLabel: Record<StorewideSaleState, string> = { off: 'Apagado', scheduled: 'Programado', active: 'Vigente', expired: 'Vencido' };
const stateClass: Record<StorewideSaleState, string> = { off: 'deshabilitado', scheduled: 'programado', active: 'habilitado', expired: 'vencido' };
const money = (minor: number) => `${new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(minor / 100)} UYU`;

/** Descuento general: tacha el precio anterior en toda la web y se cobra el precio rebajado. */
export function StorewideSalePanel({ onNotice }: { onNotice: (value: string) => void }) {
  const [saved, setSaved] = useState<StorewideSaleSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [percent, setPercent] = useState(String(DEFAULT_STOREWIDE_SALE.storewide_sale_percent));
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const apply = useCallback((value: StorewideSaleSettings) => {
    setSaved(value);
    setEnabled(value.storewide_sale_enabled);
    setPercent(String(value.storewide_sale_percent));
    setValidFrom(value.storewide_sale_valid_from || '');
    setValidUntil(value.storewide_sale_valid_until || '');
  }, []);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.from('commerce_settings').select(STOREWIDE_SALE_COLUMNS).eq('singleton', true).single();
    if (loadError) { setError(loadError.message); return; }
    setError('');
    apply(readStorewideSale(data as Partial<StorewideSaleSettings>));
  }, [apply]);

  useEffect(() => { void load(); }, [load]);

  const parsedPercent = Number(percent.replace(',', '.'));
  const validPercent = Number.isFinite(parsedPercent) && parsedPercent > 0 && parsedPercent < 100;
  const draft: StorewideSaleSettings = {
    storewide_sale_enabled: enabled,
    storewide_sale_percent: validPercent ? Math.round(parsedPercent * 100) / 100 : DEFAULT_STOREWIDE_SALE.storewide_sale_percent,
    storewide_sale_valid_from: validFrom || null,
    storewide_sale_valid_until: validUntil || null,
  };
  const currentState = saved ? storewideSaleState(saved, montevideoToday()) : 'off';
  const dirty = Boolean(saved) && JSON.stringify(draft) !== JSON.stringify(saved);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!validPercent) { setError('Ingresá un porcentaje mayor a 0 y menor a 100.'); return; }
    if (validFrom && validUntil && validUntil < validFrom) { setError('La fecha final debe ser igual o posterior a la fecha inicial.'); return; }
    setSaving(true);
    const { data, error: saveError } = await supabase.from('commerce_settings').update(draft).eq('singleton', true).select(STOREWIDE_SALE_COLUMNS).single();
    setSaving(false);
    if (saveError || !data) { setError(saveError?.message || 'No se pudo guardar el descuento general.'); return; }
    const next = readStorewideSale(data as Partial<StorewideSaleSettings>);
    apply(next);
    onNotice(next.storewide_sale_enabled ? 'Descuento general guardado. La web lo muestra en menos de un minuto.' : 'Descuento general apagado.');
  };

  return (
    <section className="panel storewide-sale-panel" aria-labelledby="storewide-sale-title">
      <div className="panel-heading">
        <div>
          <h2 id="storewide-sale-title">Descuento general en la web</h2>
          <div>Tacha el precio anterior y muestra el precio con descuento en todos los productos, en el carrito y en el pago. El aviso de la barra negra se maneja aparte, en Marketing, Avisos.</div>
        </div>
        <div className={`discount-status discount-status-${stateClass[currentState]}`}>{stateLabel[currentState]}</div>
      </div>
      <form onSubmit={save} className="discount-form">
        <label>
          <div>Porcentaje</div>
          <input aria-label="Porcentaje del descuento general" required type="number" min="0.01" max="99.99" step="0.01" value={percent} onChange={event => setPercent(event.target.value)} />
        </label>
        <div className="discount-date-grid">
          <label><div>Válido desde (opcional)</div><input aria-label="Descuento general válido desde" type="date" value={validFrom} onChange={event => setValidFrom(event.target.value)} /></label>
          <label><div>Válido hasta (opcional)</div><input aria-label="Descuento general válido hasta" type="date" value={validUntil} onChange={event => setValidUntil(event.target.value)} /></label>
        </div>
        <label className="discount-enabled">
          <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />
          <div>Habilitado en la web</div>
        </label>
        {validPercent && <div>Ejemplo: un producto de {money(220000)} pasa a {money(salePriceMinor(220000, draft.storewide_sale_percent))}.</div>}
        <div>No se acumula con códigos, con el descuento por transferencia ni con el mayorista: se cobra el precio más bajo para el cliente. Los códigos solo se usan cuando descuentan más que este descuento. Las ventas cargadas en Gestión no cambian.</div>
        {error && <div className="error" role="alert">{error}</div>}
        <button type="submit" disabled={saving || !saved || !dirty}>{saving ? 'Guardando…' : 'Guardar descuento general'}</button>
      </form>
    </section>
  );
}
