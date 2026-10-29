import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { allDiscountProducts, discountScopeLabels, readDiscountScope, validDiscountScope, type DiscountCategory, type DiscountScope } from '../../../shared/discount-scope';

export function DiscountProductsSelector({ value, categories, label, disabled, onSave }: {
  value: DiscountScope; categories: DiscountCategory[]; label: string; disabled?: boolean;
  onSave: (scope: DiscountScope) => Promise<void> | void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const summary = discountScopeLabels(value, categories).join(', ');
  const close = () => { setPosition(null); trigger.current?.focus(); };
  useEffect(() => {
    if (!position) return;
    panel.current?.querySelector<HTMLInputElement>('input')?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) close(); };
    const outside = (event: PointerEvent) => { if (!saving && !panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(); };
    const move = () => { if (!saving) close(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', move);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', move); };
  }, [position, saving]);
  const open = () => {
    if (position) { close(); return; }
    const rect = trigger.current!.getBoundingClientRect();
    const top = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 360));
    setDraft(readDiscountScope(value)); setError('');
    setPosition({ top, left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)), maxHeight: window.innerHeight - top - 8 });
  };
  const setCategory = (code: string, checked: boolean) => setDraft(current => ({
    applicability: 'categories',
    category_codes: checked ? [...new Set([...current.category_codes, code])] : current.category_codes.filter(item => item !== code),
    include_design_items: current.applicability === 'all_items' ? false : current.include_design_items,
  }));
  const save = async () => {
    setSaving(true); setError('');
    try { await onSave(draft); close(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar. Volvé a intentar.'); }
    finally { setSaving(false); }
  };
  const visibleCategories = categories.filter(category => category.active !== false || draft.category_codes.includes(category.code));
  return <>
    <button ref={trigger} type="button" className="discount-products-trigger" aria-label={label} aria-expanded={Boolean(position)} aria-haspopup="dialog" disabled={disabled} onClick={open} title={summary}>
      <span>{summary || 'Elegir categorías'}</span><span aria-hidden="true">⌄</span>
    </button>
    {position && createPortal(<div className="commerce-tools"><div ref={panel} role="dialog" aria-label={label} className="discount-products-popover" style={position}>
      <strong>Sobre qué productos</strong>
      <div className="discount-products-options">
        <label><input type="checkbox" disabled={saving} checked={draft.applicability === 'all_items'} onChange={event => setDraft(event.target.checked ? allDiscountProducts() : { applicability: 'categories', category_codes: [], include_design_items: false })} /><span>Todos</span></label>
        {visibleCategories.map(category => <label key={category.code}><input type="checkbox" disabled={saving} checked={draft.applicability === 'categories' && draft.category_codes.includes(category.code)} onChange={event => setCategory(category.code, event.target.checked)} /><span>{category.label_es}{category.active === false ? ' (inactiva)' : ''}</span></label>)}
        <label><input type="checkbox" disabled={saving} checked={draft.applicability !== 'all_items' && draft.include_design_items} onChange={event => setDraft(current => ({ applicability: 'categories', category_codes: current.category_codes, include_design_items: event.target.checked }))} /><span>Mates Personalizados</span></label>
      </div>
      {!validDiscountScope(draft) && <small>Seleccioná al menos una categoría o Todos.</small>}
      {error && <div className="error" role="alert">{error}</div>}
      <div className="discount-products-actions"><button type="button" disabled={saving} onClick={close}>Cancelar</button><button type="button" disabled={saving || !validDiscountScope(draft)} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar'}</button></div>
    </div></div>, document.body)}
  </>;
}
