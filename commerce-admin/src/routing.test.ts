import { describe, expect, it } from 'vitest';
import { calculateAdjustedCatalogPrice, getTabFromUrl } from './App';

describe('calculateAdjustedCatalogPrice', () => {
  it('aplica el porcentaje sobre el precio base y redondea al peso', () => {
    expect(calculateAdjustedCatalogPrice(200000, 13.64)).toBe(227300);
    expect(calculateAdjustedCatalogPrice(500000, 13.64)).toBe(568200);
  });

  it('restaura exactamente el precio base cuando está desactivado', () => {
    expect(calculateAdjustedCatalogPrice(200000, 13.64, false)).toBe(200000);
  });
});

describe('getTabFromUrl', () => {
  it('resuelve rutas directas de pestañas estándar', () => {
    expect(getTabFromUrl('/orders')).toBe('orders');
    expect(getTabFromUrl('/personalized')).toBe('personalized');
    expect(getTabFromUrl('/catalog')).toBe('catalog');
    expect(getTabFromUrl('/list')).toBe('list');
    expect(getTabFromUrl('/international-shipping')).toBe('international_shipping');
    expect(getTabFromUrl('/international_shipping')).toBe('international_shipping');
    expect(getTabFromUrl('/rates')).toBe('rates');
    expect(getTabFromUrl('/settings')).toBe('settings');
  });

  it('resuelve sinónimos en español', () => {
    expect(getTabFromUrl('/pedidos')).toBe('orders');
    expect(getTabFromUrl('/personalizados')).toBe('personalized');
    expect(getTabFromUrl('/pedidos-personalizados')).toBe('personalized');
    expect(getTabFromUrl('/catalogo')).toBe('catalog');
    expect(getTabFromUrl('/lista')).toBe('list');
    expect(getTabFromUrl('/envios-internacionales')).toBe('international_shipping');
    expect(getTabFromUrl('/envios_internacionales')).toBe('international_shipping');
    expect(getTabFromUrl('/cotizaciones')).toBe('rates');
    expect(getTabFromUrl('/configuracion')).toBe('settings');
  });

  it('soporta query param ?tab=...', () => {
    expect(getTabFromUrl('/', '?tab=orders')).toBe('orders');
    expect(getTabFromUrl('/', '?tab=pedidos')).toBe('orders');
    expect(getTabFromUrl('/', '?tab=personalized')).toBe('personalized');
  });

  it('tolera barras iniciales, finales y mayúsculas/minúsculas', () => {
    expect(getTabFromUrl('///ORDERS///')).toBe('orders');
    expect(getTabFromUrl('Personalizados')).toBe('personalized');
  });

  it('retorna catalog por defecto ante rutas desconocidas o raíz', () => {
    expect(getTabFromUrl('/')).toBe('catalog');
    expect(getTabFromUrl('')).toBe('catalog');
    expect(getTabFromUrl('/ruta-inexistente')).toBe('catalog');
    expect(getTabFromUrl('/shipping')).toBe('catalog');
    expect(getTabFromUrl('/envios')).toBe('catalog');
  });
});

describe('catalogColorLabels', () => {
  it('contiene las etiquetas de color definidas y exportadas', async () => {
    const { catalogColorLabels } = await import('./App');
    expect(catalogColorLabels.marron).toBe('Marrón');
    expect(catalogColorLabels.negro).toBe('Negro');
    expect(catalogColorLabels.natural).toBe('Natural');
    expect(catalogColorLabels['cuero-crudo']).toBe('Cuero crudo');
    expect(catalogColorLabels.rojo).toBe('Rojo');
    expect(catalogColorLabels.blanco).toBe('Blanco');
    expect(catalogColorLabels.rosado).toBe('Rosado');
    expect(catalogColorLabels.gris).toBe('Gris');
    expect(catalogColorLabels.dorado).toBe('Dorado');
    expect(catalogColorLabels.celeste).toBe('Celeste');
    expect(catalogColorLabels.azul).toBe('Azul');
    expect(catalogColorLabels.beige).toBe('Beige');
  });
});
