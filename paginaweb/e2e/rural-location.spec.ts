import { expect, test } from "@playwright/test";

test("el sorteo abre en la nueva dirección y la anterior redirige", async ({ page }) => {
  await page.goto("/sorteo");
  await expect(page).toHaveTitle("MateArte Uruguay | Sorteo");
  await expect(page.getByRole("heading", { name: "Ya estás cerca." })).toBeVisible();
  await expect(page).toHaveURL(/\/sorteo$/);

  await page.goto("/rural");
  await expect(page).toHaveURL(/\/sorteo$/);
  await expect(page.getByRole("heading", { name: "Ya estás cerca." })).toBeVisible();
});

test("país y ciudad se eligen en orden, con Paysandú por defecto", async ({ page }) => {
  await page.goto("/en/sorteo");
  await page.waitForLoadState("networkidle");

  const country = page.getByRole("combobox", { name: "País" });
  const city = page.getByRole("combobox", { name: "Ciudad" });
  await expect(country).toHaveValue("UY");
  await expect(city).toHaveValue("Paysandú");

  await country.selectOption("BR");
  await expect(country).toHaveValue("BR");
  await expect(city).toHaveValue("");
  await page.getByRole("searchbox", { name: "Buscar ciudad" }).fill("Rio de Janeiro");
  await expect(city.locator("option", { hasText: "Rio de Janeiro" })).toBeAttached();
  await city.selectOption({ label: "Rio de Janeiro" });
  await expect(city).toHaveValue("Rio de Janeiro");

  await country.selectOption("UY");
  await expect(city).toHaveValue("Paysandú");
});
