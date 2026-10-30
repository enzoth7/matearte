import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("el resumen del mate se ve y se descarga antes de registrar la venta, sin datos del cliente", async ({ page }) => {
  const { writes, tables } = await mockCommerce(page, { writable: true });
  tables.visualizer_icons = [];
  tables.visualizer_hidden_builtin_icons = [];
  await page.goto("/comercial/registrar-min");
  await page.getByRole("tab", { name: "Personalizados" }).click();
  await page.getByLabel("Categoría de artículo").selectOption("mate");
  await page.getByLabel("Modelo", { exact: true }).selectOption("imperial");
  await page.locator(".local-custom-builder").getByLabel("Cuero o textura", { exact: true }).selectOption("liso");
  await page.getByRole("button", { name: /Agregar personalizado/ }).click();
  const card = page.locator(".local-personalization-card");
  await card.getByRole("navigation").getByRole("button", { name: /Virola/ }).click();
  await page.getByLabel("Texto de virola de Mate Imperial personalizado").fill("ENZO");
  await card.getByRole("navigation").getByRole("button", { name: /Fleje/ }).click();
  await page.getByLabel("Técnica de fleje de Mate Imperial personalizado").selectOption("bronze-applique");
  await page.getByLabel("Texto del frente del fleje de Mate Imperial personalizado").fill("FRENTE");
  await page.getByLabel("Texto del dorso del fleje de Mate Imperial personalizado").fill("REVERSO");
  await page.getByRole("button", { name: "Agregar nuevo cliente" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Nombre privado");

  await card.getByRole("button", { name: "Ver resumen" }).click();
  const dialog = page.getByRole("dialog", { name: "Vista previa para compartir" });
  const sheet = dialog.getByLabel("Resumen del mate personalizado");
  await expect(sheet).toContainText("Mate Imperial personalizado");
  await expect(sheet).toContainText("ENZO");
  await expect(sheet).toContainText("FRENTE");
  await expect(sheet).toContainText("REVERSO");
  await expect(sheet).not.toContainText("Nombre privado");
  await expect(sheet.getByRole("heading", { name: "Fleje · frente" })).toBeVisible();
  const mateImage = sheet.getByRole("img", { name: /Referencia del mate completo/ });
  await expect.poll(() => mateImage.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await mateImage.evaluate(image => image.getBoundingClientRect().height)).toBeLessThan(260);
  expect(writes.filter(write => write.table === "gestion_create_local_sale_with_items")).toHaveLength(0);
  await dialog.screenshot({ path: "artifacts/resumen-mate-previo.png" });

  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Descargar imagen para compartir" }).click();
  const image = await download;
  expect(image.suggestedFilename()).toMatch(/^vista-previa-.*\.png$/);
  await image.saveAs("artifacts/resumen-mate-descargado.png");
});
