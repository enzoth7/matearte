import { describe, expect, it } from 'vitest';
import { getTabFromUrl } from './App';

describe('getTabFromUrl', () => {
  it('resuelve rutas directas de pestañas estándar', () => {
    expect(getTabFromUrl('/orders')).toBe('orders');
    expect(getTabFromUrl('/personalized')).toBe('personalized');
    expect(getTabFromUrl('/catalog')).toBe('catalog');
    expect(getTabFromUrl('/list')).toBe('list');
    expect(getTabFromUrl('/shipping')).toBe('shipping');
    expect(getTabFromUrl('/rates')).toBe('rates');
    expect(getTabFromUrl('/settings')).toBe('settings');
  });

  it('resuelve sinónimos en español', () => {
    expect(getTabFromUrl('/pedidos')).toBe('orders');
    expect(getTabFromUrl('/personalizados')).toBe('personalized');
    expect(getTabFromUrl('/pedidos-personalizados')).toBe('personalized');
    expect(getTabFromUrl('/catalogo')).toBe('catalog');
    expect(getTabFromUrl('/lista')).toBe('list');
    expect(getTabFromUrl('/envios')).toBe('shipping');
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
  });
});
