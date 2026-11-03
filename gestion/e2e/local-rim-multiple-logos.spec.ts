import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

const logoFile = (number: number) => ({
  name: `logo-${number}.svg`, mimeType: "image/svg+xml",
  buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" rx="15" fill="navy"/><text x="50" y="60" text-anchor="middle" fill="white">${number}</text></svg>`),
});

for (const [model, shape] of [["imperial", ""], ["torpedo", ""], ["camionero", ""], ["criollo", "imperial"], ["criollo", "torpedo"], ["criollo", "camionero"]]) {
  test(`varios logos en virola de ${model} ${shape}: carga, edición y resumen`, async ({ page }) => {
    const { writes, tables } = await mockCommerce(page, { writable: true });
    tables.visualizer_icons = [];
    tables.visualizer_hidden_builtin_icons = [];
    await page.goto("/comercial/registrar-min");
    await page.getByRole("tab", { name: "Personalizados" }).click();
    await page.getByLabel("Categoría de artículo").selectOption("mate");
    const builder = page.locator(".local-custom-builder");
    await builder.getByLabel("Modelo", { exact: true }).selectOption(model);
    if (shape) await builder.getByLabel("Forma del criollo").selectOption(shape);
    await builder.getByLabel("Cuero o textura", { exact: true }).selectOption("liso");
    await builder.getByRole("button", { name: "Agregar personalizado" }).click();
    const card = page.locator(".local-personalization-card");
    await card.getByLabel(/^Contenido de virola/).selectOption("logo");
    const upload = card.getByLabel(/^Logo de virola/);
    await expect(upload).toHaveAttribute("multiple", "");
    const count = model === "imperial" ? 16 : 3;
    await upload.setInputFiles(Array.from({ length: count }, (_, index) => logoFile(index + 1)));
    const preview = card.getByLabel(/^Vista editable de la virola/);
    const images = preview.locator('image[href^="blob:"]');
    await expect(images).toHaveCount(count);
    await upload.setInputFiles(logoFile(2));
    await expect(images).toHaveCount(count + 1);
    await card.getByRole("button", { name: /^Quitar logo 1 de la virola:/ }).click();
    await expect(images).toHaveCount(count);
    await card.getByRole("button", { name: /^Quitar logo 2 de la virola:/ }).click();
    await card.getByRole("button", { name: /^Agregar logo 2 en la virola:/ }).click();
    await card.getByLabel("Tamaño del elemento").fill("0.8");
    await card.getByLabel("Giro del elemento").fill("25");

    if (model === "imperial") {
      await upload.setInputFiles([logoFile(10), { name: "invalido.txt", mimeType: "text/plain", buffer: Buffer.from("texto") }]);
      await expect(page.getByText(/Cada logo debe ser PNG/)).toBeVisible();
      await expect(images).toHaveCount(count);
      await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
      await expect(page.getByText("Borrador guardado en este navegador.")).toBeVisible();
      await page.reload();
      await page.getByRole("button", { name: "Retomar borrador" }).click();
      await expect(images).toHaveCount(count);
      await expect(card.getByRole("button", { name: /^Agregar logo 1 en la virola:/ })).toBeVisible();
      await card.getByRole("button", { name: /^Quitar logo 2 de la virola:/ }).click();
      await card.getByRole("button", { name: /^Agregar logo 2 en la virola:/ }).click();
      await expect(card.getByLabel("Tamaño del elemento")).toHaveValue("0.8");
      await expect(card.getByLabel("Giro del elemento")).toHaveValue("25");
      await card.locator(".local-design-editor").screenshot({ path: "artifacts/virola-varios-logos.png" });
    }

    await card.getByRole("button", { name: "Ver resumen" }).click();
    const summary = page.getByRole("dialog", { name: "Vista previa para compartir" });
    await expect(summary.locator('[data-local-preview="virola"] image[href^="blob:"]')).toHaveCount(count);
    await summary.locator(".local-mate-summary-actions").getByRole("button", { name: "Cerrar", exact: true }).click();

    if (model === "imperial") {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(card.getByRole("button", { name: /^Quitar logo 17 de la virola:/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await card.locator(".local-design-editor").screenshot({ path: "artifacts/virola-varios-logos-mobile.png" });
      await page.setViewportSize({ width: 1440, height: 1100 });
      await card.getByRole("navigation").getByRole("button", { name: /Materiales/ }).click();
      for (const [label, value] of [["Color", "natural"], ["Interior", "calabaza"], ["Tamaño", "grande"], ["Virola", "imperial"], ["Diseño del fleje", "liso"], ["Posamate", "sin-posamate"], ["Pie", "comun"]]) await card.getByLabel(label, { exact: true }).selectOption(value);
      await card.getByRole("navigation").getByRole("button", { name: /Virola/ }).click();
      await card.getByLabel(/^Técnica de virola/).selectOption("bronze-applique");
      await page.getByRole("button", { name: "Guardar venta", exact: true }).click();
      await expect.poll(() => writes.some(write => write.table === "gestion_create_local_sale_with_items")).toBe(true);
      const saved = writes.find(write => write.table === "gestion_create_local_sale_with_items")!.body.p_items[0].customization;
      expect(saved.configuration.rim.icons).toHaveLength(count);
      expect(saved.assets).toHaveLength(count);
      expect(new Set(saved.assets.map((asset: any) => asset.object_path)).size).toBe(count);
      expect(saved.configuration.rim.icons.some((icon: any) => icon.transform.scale === .8 && icon.transform.rotation === 25)).toBe(true);
      expect(saved.localPricing.items).toContainEqual(expect.objectContaining({ ruleKey: "customization:bronze-applique:rim_image", quantity: count }));
    }
  });
}
