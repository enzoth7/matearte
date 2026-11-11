import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("los accesos consignatarios se administran desde Consignaciones y nacen pausados", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.contacts.push({ id: "contact-paysandu", wholesale_name: "Local Paysandú" });
  tables.wholesale_consignments.push({ id: "consignment-paysandu", order_id: "order-paysandu",
    contact_id: "contact-paysandu", currency: "UYU", exchange_rate: 1, created_at: "2026-11-10T12:00:00Z" });
  const actions: Record<string, unknown>[] = [];
  await page.route("**/functions/v1/gestion-users", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (!["listConsignees", "createConsignee", "setConsigneeActive", "resetConsigneePassword"].includes(String(body.action))) return route.fallback();
    actions.push(body);
    const result = body.action === "listConsignees" ? { users: [] }
      : body.action === "createConsignee" ? { user: { userId: "portal-1", contactId: body.contactId,
        displayName: body.displayName, username: body.username, active: false } }
      : body.action === "setConsigneeActive" ? { userId: "portal-1", active: body.active }
      : { userId: "portal-1" };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
  });

  await page.goto("/administracion/usuarios");
  await expect(page.getByRole("tab", { name: "Consignatarios" })).toHaveCount(0);
  await page.goto("/consignaciones/usuarios");
  const table = page.getByRole("table");
  await expect(table.getByRole("columnheader")).toHaveText(["Cliente", "Usuario", "Contraseña", "Activo/Inactivo"]);
  const row = table.getByRole("row", { name: /Local Paysandú/ });
  await expect(row).toContainText("Sin acceso");
  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await page.locator(".consignee-users-table-wrap").evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
  await row.getByRole("button", { name: "Crear usuario" }).click();
  const createDialog = page.getByRole("dialog", { name: "Nuevo usuario consignatario" });
  await expect(createDialog.getByRole("combobox", { name: "Cliente" })).toHaveValue("contact-paysandu");
  await createDialog.getByRole("textbox", { name: "Usuario", exact: true }).fill("local.paysandu");
  await createDialog.getByRole("textbox", { name: "Contraseña", exact: true }).fill("clave-segura-2026");
  await createDialog.getByRole("textbox", { name: "Confirmar contraseña" }).fill("clave-segura-2026");
  await createDialog.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByText("Usuario creado inactivo. Activá el acceso después de conciliar el saldo.")).toBeVisible();
  await expect(row).toContainText("local.paysandu");
  await expect(row).toContainText("Inactivo");
  expect(actions.find((action) => action.action === "createConsignee")).toMatchObject({
    contactId: "contact-paysandu", displayName: "Local Paysandú", username: "local.paysandu",
  });
  await row.getByRole("button", { name: "Activar" }).click();
  await expect(page.getByText("Acceso activado.")).toBeVisible();
  await expect(row).toContainText("Activo");
  expect(actions.find((action) => action.action === "setConsigneeActive")).toMatchObject({
    userId: "portal-1", active: true,
  });
  await row.getByRole("button", { name: "Cambiar contraseña" }).click();
  const resetDialog = page.getByRole("dialog", { name: "Cambiar contraseña de local.paysandu" });
  await resetDialog.getByRole("textbox", { name: "Nueva contraseña" }).fill("otra-clave-2026");
  await resetDialog.getByRole("textbox", { name: "Confirmar contraseña" }).fill("otra-clave-2026");
  await resetDialog.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByText("Contraseña actualizada.")).toBeVisible();
  expect(actions.find((action) => action.action === "resetConsigneePassword")).toMatchObject({
    userId: "portal-1", password: "otra-clave-2026",
  });
});

test("la subpestaña responde a permisos internos sin leyendas de exclusividad", async ({ page }) => {
  await mockCommerce(page, { accessUserId: "t2", allowedPaths: ["/inicio/resumen", "/consignaciones/usuarios"] });
  await page.route("**/functions/v1/gestion-users", async (route) => {
    if (route.request().postDataJSON()?.action !== "listConsignees") return route.fallback();
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"users":[]}' });
  });
  await page.goto("/consignaciones/usuarios");
  await expect(page.getByRole("heading", { name: "Primero registrá una consignación" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Usuarios consignatarios" })).toBeVisible();
  await expect(page.getByText("Solo Richard")).toHaveCount(0);
});

test("un error de carga ofrece reintento sin mostrar el formulario", async ({ page }) => {
  await mockCommerce(page);
  await page.route("**/functions/v1/gestion-users", async (route) => {
    if (route.request().postDataJSON()?.action !== "listConsignees") return route.fallback();
    await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Error del servicio"}' });
  });
  await page.goto("/consignaciones/usuarios");
  await expect(page.getByRole("heading", { name: "No se pudieron cargar los accesos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});
