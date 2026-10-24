import { test, expect } from '@playwright/test';
import { mockCommerce } from './commerce-fixture';
import { defaultCatalogTaxonomy } from '../../shared/catalog-taxonomy';

test('categorías, opciones y reglas se entienden por separado en escritorio y móvil', async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.commerce_categories = structuredClone(defaultCatalogTaxonomy.categories);
  tables.commerce_attribute_definitions = structuredClone(defaultCatalogTaxonomy.attributes);
  tables.commerce_attribute_options = structuredClone(defaultCatalogTaxonomy.options);
  tables.commerce_category_attributes = structuredClone(defaultCatalogTaxonomy.rules);
  await page.goto('/productos/categorias');

  const navigation = page.getByRole('navigation', { name: 'Organización del catálogo' });
  await expect(navigation.getByRole('button')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'Familias y subcategorías' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Atributos y opciones' })).toHaveCount(0);
  await page.getByRole('complementary', { name: 'Lista de categorías' }).getByRole('button', { name: /Carteras/ }).click();
  await expect(page.getByRole('heading', { name: 'Carteras', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/taxonomy-categories-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '+ Agregar categoría' }).click();
  await expect(page.getByRole('heading', { name: 'Nueva categoría' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await navigation.getByRole('button', { name: /Atributos y opciones/ }).click();
  await expect(page.getByRole('heading', { name: 'Atributos y opciones' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Familias y subcategorías' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Opciones de Color' })).toBeVisible();
  await page.screenshot({ path: 'test-results/taxonomy-attributes-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '+ Agregar opción' }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre de la opción' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).last().click();
  await page.getByRole('complementary', { name: 'Lista de atributos' }).getByRole('button', { name: /Talle/ }).click();
  await expect(page.getByRole('heading', { name: 'Opciones de Talle' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Lista de atributos' }).getByRole('button', { name: /Talle/ })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/taxonomy-talle-desktop.png', fullPage: true });

  await navigation.getByRole('button', { name: /Reglas por categoría/ }).click();
  await expect(page.getByRole('heading', { name: 'Reglas por categoría' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Familias y subcategorías' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Categoría a configurar' })).toHaveValue('carteras');
  await page.screenshot({ path: 'test-results/taxonomy-rules-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '+ Agregar regla' }).click();
  await expect(page.getByRole('heading', { name: 'Nueva regla para Carteras' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/taxonomy-rules-mobile.png', fullPage: true });
  await navigation.getByRole('button', { name: /Categorías/ }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/taxonomy-categories-mobile.png', fullPage: true });
  await navigation.getByRole('button', { name: /Atributos y opciones/ }).click();
  await expect(page.getByRole('heading', { name: 'Opciones de Talle' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Atributo', exact: true })).toHaveValue('talle');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/taxonomy-talle-mobile.png', fullPage: true });
});
