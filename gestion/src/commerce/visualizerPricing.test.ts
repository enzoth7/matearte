import { describe, expect, it } from 'vitest';
import { editablePricingValues, groupVisualizerPricingDefinitions, numericPricingValues, parsePricingState, pricingIssues } from './visualizerPricing';

const payload = {
  definitions: [
    { rule_key: 'family:imperial', rule_type: 'family', label: 'Imperial', value_kind: 'uyu', family_id: 'imperial', texture_id: null, customization_id: null, required: true, active: true, sort_order: 1 },
    { rule_key: 'commission:mercadopago', rule_type: 'commission', label: 'Mercado Pago', value_kind: 'percent', family_id: null, texture_id: null, customization_id: null, required: true, active: true, sort_order: 2 },
  ],
  draft: { id: 'draft-id', version: 2, updatedAt: '2026-10-20T10:00:00Z', publishedAt: null, values: { 'family:imperial': 1400 } },
  published: { id: 'published-id', version: 1, updatedAt: '2026-10-19T10:00:00Z', publishedAt: '2026-10-19T10:00:00Z', values: { 'family:imperial': 1200, 'commission:mercadopago': 6 } },
};

describe('configuración de precios del Visualizador en Gestión', () => {
  it('lee el mismo contrato de borrador y publicado sin completar valores faltantes', () => {
    const state = parsePricingState(payload);
    expect(editablePricingValues(state)).toEqual({ 'family:imperial': '1400', 'commission:mercadopago': '' });
    expect(state.published.values['family:imperial']).toBe(1200);
  });

  it('permite guardar borradores incompletos pero no publicarlos', () => {
    const state = parsePricingState(payload);
    const values = editablePricingValues(state);
    expect(pricingIssues(state.definitions, values, false)).toEqual([]);
    expect(pricingIssues(state.definitions, values, true)).toEqual(['Falta Mercado Pago']);
  });

  it('rechaza negativos y porcentajes fuera de rango', () => {
    const state = parsePricingState(payload);
    expect(pricingIssues(state.definitions, { 'family:imperial': '-2', 'commission:mercadopago': '101' }, false)).toEqual([
      'Imperial tiene un valor inválido',
      'Mercado Pago no puede superar 100%',
    ]);
  });

  it('mantiene decimales y vacíos al enviar el borrador', () => {
    expect(numericPricingValues({ a: '12,50', b: '' })).toEqual({ a: 12.5, b: null });
  });

  it('incluye cada regla activa una sola vez, incluso nuevas reglas no clasificadas', () => {
    const definitions = [
      ...parsePricingState(payload).definitions,
      { ...parsePricingState(payload).definitions[0], rule_key: 'leather:raw', label: 'Cuero crudo', family_id: null, rule_type: 'texture' as const, sort_order: 3 },
      { ...parsePricingState(payload).definitions[0], rule_key: 'customization:laser:rim_text', label: 'Texto láser', family_id: null, customization_id: 'laser:rim_text', rule_type: 'customization' as const, sort_order: 4 },
      { ...parsePricingState(payload).definitions[0], rule_key: 'new:rule', label: 'Nueva regla', family_id: null, rule_type: 'texture' as const, sort_order: 5 },
    ];
    const groups = groupVisualizerPricingDefinitions(definitions);
    expect(groups.flatMap((group) => group.definitions.map((definition) => definition.rule_key)).sort()).toEqual(definitions.map((definition) => definition.rule_key).sort());
    expect(groups.find((group) => group.id === 'otras-reglas')?.definitions[0].rule_key).toBe('new:rule');
  });
});
