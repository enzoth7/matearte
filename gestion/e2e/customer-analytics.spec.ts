import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

const local = (id: string, name: string, extra: Record<string, unknown>) => ({
  id, full_name: name, email: null, phone: null, city: null, country: null, department: null, birth_date: null,
  first_purchase_date: null, last_purchase_date: null, source_user_id: null, notes: "", created_at: "2026-10-20T10:00:00Z", ...extra,
});

test("Análisis de clientes muestra país, provincia, edades y calidad de datos de la base", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.local_sales_customers.push(
    local("c1", "Ana Argentina", { country: "Argentina", department: "Buenos Aires", birth_date: "1990-03-03" }),
    local("c2", "Beto Argentino", { country: "AR", department: "buenos aires", birth_date: "2001-06-06" }),
    local("c3", "Carla Argentina", { country: "Argentina", department: "Córdoba" }),
    local("c6", "Fede Argentino", { country: "Argentina" }),
    local("c4", "Dario Uruguayo", { country: "Uruguay", department: "Paysandú", birth_date: "1975-01-01" }),
    local("c5", "Eva Sin Datos", {}),
  );
  await page.goto("/clientes/analitica");
  await expect(page.getByRole("link", { name: "Análisis de clientes" }).or(page.getByRole("button", { name: "Análisis de clientes" })).first()).toBeVisible();
  const view = page.getByLabel("Análisis de la base de clientes");
  await expect(view).toContainText("Clientes");

  const countries = view.getByLabel("Clientes por país");
  await expect(countries.locator("li").nth(0)).toContainText("Argentina");
  await expect(countries.locator("li").nth(0)).toContainText("4");
  await expect(countries.locator("li").nth(1)).toContainText("Uruguay");
  await expect(countries.locator("li").last()).toContainText("Sin especificar");

  // La provincia se arma para el país con más clientes que tiene provincia cargada.
  await expect(view.getByRole("heading", { name: "Provincias de Argentina" })).toBeVisible();
  const provinces = view.getByLabel("Provincias de Argentina");
  await expect(provinces.locator("li").nth(0)).toContainText("Buenos Aires");
  await expect(provinces.locator("li").nth(0)).toContainText("2");
  await expect(view).toContainText("3 de 4 clientes de Argentina tienen dato de provincia");
  await view.getByLabel("País para ver el detalle por provincia").selectOption("Uruguay");
  await expect(view.getByRole("heading", { name: "Departamentos de Uruguay" })).toBeVisible();
  await expect(view.getByLabel("Departamentos de Uruguay")).toContainText("Paysandú");

  await expect(view.getByRole("img", { name: "Clientes por rango de edad" })).toBeVisible();
  await expect(view).toContainText("Solo 4 de 7 clientes");
  await expect(view.getByLabel("Datos cargados por cliente")).toContainText("Fecha de nacimiento");
});

test("Análisis de clientes no rompe con una base vacía", async ({ page }) => {
  await mockCommerce(page, { writable: true });
  await page.goto("/clientes/analitica");
  await expect(page.getByLabel("Análisis de la base de clientes")).toBeVisible();
});
