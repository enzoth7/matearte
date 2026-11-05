import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mockCommerce } from "./commerce-fixture";

test("convierte fotos a WebP y vectores SVG antes de publicar", async ({ page }) => {
  const { default: UTIF } = await import("utif");
  const pixels = new Uint8Array(4 * 4 * 4);
  for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
  const tiffBytes = Array.from(new Uint8Array(UTIF.encodeImage(pixels.buffer, 4, 4)));
  await page.goto("/");
  const result = await page.evaluate(async (tiffSource) => {
    const { preparePersonalizerIcon } = await import("/src/commerce/personalizerIconConversion.ts");
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white";
    context.fillRect(0, 0, 300, 300);
    context.fillStyle = "black";
    context.fillRect(60, 60, 180, 180);
    const jpegBlob = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/jpeg")!);
    const photo = new File([jpegBlob], "foto.jpg", { type: "image/jpeg" });
    const webp = await preparePersonalizerIcon(photo, "webp");
    const svg = await preparePersonalizerIcon(photo, "svg");
    const sourceSvg = new File(['<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><script>alert(1)</script><circle cx="150" cy="150" r="80" fill="black"/></svg>'], "logo.svg", { type: "image/svg+xml" });
    const cleanSvg = await preparePersonalizerIcon(sourceSvg, "svg");
    const tiff = await preparePersonalizerIcon(new File([new Uint8Array(tiffSource)], "imagen.tiff", { type: "image/tiff" }), "webp");
    const svgUrl = URL.createObjectURL(svg.file);
    const rendered = new Image();
    await new Promise<void>((resolve, reject) => {
      rendered.onload = () => resolve();
      rendered.onerror = () => reject(new Error("El SVG convertido no se puede mostrar."));
      rendered.src = svgUrl;
    });
    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = 300;
    previewCanvas.height = 300;
    const previewContext = previewCanvas.getContext("2d")!;
    previewContext.drawImage(rendered, 0, 0);
    const center = Array.from(previewContext.getImageData(150, 150, 1, 1).data);
    const corner = Array.from(previewContext.getImageData(10, 10, 1, 1).data);
    URL.revokeObjectURL(svgUrl);
    const webpHeader = new TextDecoder().decode((await webp.file.arrayBuffer()).slice(0, 12));
    return {
      webpName: webp.file.name,
      webpHeader,
      svgName: svg.file.name,
      svgText: await svg.file.text(),
      cleanSvgText: await cleanSvg.file.text(),
      tiffType: tiff.file.type,
      center,
      corner,
    };
  }, tiffBytes);

  expect(result.webpName).toBe("foto.webp");
  expect(result.webpHeader).toMatch(/^RIFF.{4}WEBP$/);
  expect(result.svgName).toBe("foto.svg");
  expect(result.svgText).toContain("<path");
  expect(result.svgText).not.toContain("<image");
  expect(result.cleanSvgText).toContain("<circle");
  expect(result.cleanSvgText).not.toContain("script");
  expect(result.tiffType).toBe("image/webp");
  expect(result.center[3]).toBe(255);
  expect(result.center[0]).toBe(0);
  expect(result.corner[3]).toBe(0);
});

test("prepara WebP y SVG automáticamente al seleccionar un ícono", async ({ page }) => {
  await mockCommerce(page, { writable: true });
  await page.goto("/productos/personalizador");
  await page.getByRole("navigation", { name: "Configuración del Personalizador" }).getByRole("button", { name: "Íconos" }).click();
  const view = page.getByRole("region", { name: "Íconos del Personalizador" });
  const fileInput = view.locator('input[type="file"]');
  await expect(view.getByText("Convertir a")).toHaveCount(0);
  await fileInput.setInputFiles({
    name: "logo.webp",
    mimeType: "image/webp",
    buffer: readFileSync(join(process.cwd(), "..", "personalizador", "public", "assets", "personalizacion", "iconos", "Huella.webp")),
  });
  await expect(view.getByText(/^Listo: logo\.webp/)).toBeVisible();
  await expect(view.getByRole("img", { name: "Vista previa del ícono nuevo" })).toBeVisible();
  await fileInput.setInputFiles({
    name: "marca.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="black"/></svg>'),
  });
  await expect(view.getByText(/^Listo: marca\.svg/)).toBeVisible();
  await view.getByRole("textbox", { name: "Nombre" }).fill("Marca");
  await expect(view.getByRole("button", { name: "Publicar ícono" })).toBeEnabled();
});
