import { describe, expect, it } from 'vitest';
import { allDiscountProducts, discountCategorySubtotals, discountScopeLabels, readDiscountScope, validDiscountScope } from '../../../shared/discount-scope';

describe('discount category scopes', () => {
  it('preserves legacy scopes and separates catalog personalizados from designs', () => {
    const categories = [{ code: 'personalizados', label_es: 'Personalizados' }];
    expect(discountScopeLabels({}, categories)).toEqual(['Todos']);
    expect(discountScopeLabels({ applicability: 'design_items' }, categories)).toEqual(['Mates Personalizados']);
    expect(discountScopeLabels({ applicability: 'categories', category_codes: ['personalizados'], include_design_items: true }, categories)).toEqual(['Personalizados', 'Mates Personalizados']);
    expect(readDiscountScope({ applicability: 'design_items' }).include_design_items).toBe(true);
  });
  it('partitions server-priced catalog items without counting designs twice', () => {
    expect(discountCategorySubtotals([
      { itemType: 'catalog', category: 'mates', unitPriceMinor: 10000, quantity: 2 },
      { itemType: 'catalog', category: 'personalizados', unitPriceMinor: 30000, quantity: 1 },
      { itemType: 'design', category: 'mates', unitPriceMinor: 40000, quantity: 1 },
      { itemType: 'catalog', category: ' MATES ', unitPriceMinor: 5000, quantity: 1 },
    ])).toEqual({ mates: 25000, personalizados: 30000 });
  });
  it('requires a selection and rejects malformed prices', () => {
    expect(validDiscountScope(allDiscountProducts())).toBe(true);
    expect(validDiscountScope({ applicability: 'categories', category_codes: [], include_design_items: false })).toBe(false);
    expect(() => discountCategorySubtotals([{ itemType: 'catalog', category: 'mates', unitPriceMinor: NaN, quantity: 1 }])).toThrow('discount:invalid');
  });
});
