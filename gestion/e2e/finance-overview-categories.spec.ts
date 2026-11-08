import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("el resumen recorre meses anteriores y agrupa ingresos y egresos por categoría", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.purchases.push({ id: "purchase-october", purchased_on: "2026-10-10", paid_on: "2026-10-10",
    due_on: null, description: "Cuero", category: "Insumos", amount_minor: 250000, currency: "UYU", status: "pagada" });
  tables.finance_monthly_openings.push({ month: "2026-10-01", amount_minor: 100000 });
  tables.expense_categories.push({ id: "category-new", name: "Nueva categoría", kind: "compra", active: true });
  tables.finance_summary_adjustments.push({ month: "2026-10-01", withdrawals_minor: 5000, contributions_minor: 0 });

  await page.goto("/finanzas/resumen");
  await expect(page.getByRole("heading", { name: "Resumen financiero", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Mes del resumen")).toHaveValue("2026-11");
  await page.getByRole("button", { name: "Ver mes anterior" }).click();
  await expect(page.getByLabel("Mes del resumen")).toHaveValue("2026-10");
  await expect(page.getByRole("button", { name: "Mes actual" })).toHaveCount(0);
  await expect(page.getByText("De nov. 2026 a oct. 2027, importes en UYU")).toHaveCount(0);
  await expect(page.locator(".finance-row-label", { hasText: "Saldo inicial" })).toBeVisible();
  await expect(page.locator(".finance-row-label", { hasText: "Nueva categoría" })).toBeVisible();
  await expect(page.locator(".finance-row-label", { hasText: "Retiros" })).toBeVisible();
  await expect(page.locator(".finance-cell.withdrawals").nth(1)).toContainText("50");
  await expect(page.locator(".finance-row-label", { hasText: "Ventas web" })).toBeVisible();
  await expect(page.locator(".finance-row-label", { hasText: "Insumos" })).toBeVisible();
  await expect(page.locator(".finance-row-label", { hasText: "Saldo final" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver mes anterior" })).toBeDisabled();
});

test("noviembre conserva el cierre de octubre si no tiene saldo inicial manual", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.purchases.push({ id: "expense-october-carry", purchased_on: "2026-10-08", paid_on: "2026-10-08",
    due_on: null, description: "Cuero", category: "Insumos", amount_minor: 10000,
    currency: "UYU", status: "pagada" });
  await page.goto("/finanzas/resumen");
  await expect(page.locator(".finance-amount.opening").first()).toContainText("4.001");
  await page.getByRole("button", { name: "Ver mes anterior" }).click();
  await expect(page.locator(".finance-amount.cumulative").first()).toContainText("4.001");
  tables.finance_monthly_openings.push({ month: "2026-11-01", amount_minor: 900000 });
  await page.goto("/finanzas/resumen");
  await expect(page.locator(".finance-amount.opening").first()).toContainText("9.000");
});

test("las categorías del resumen abren los movimientos del mes seleccionado", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.finance_manual_incomes.push(
    { id: "other-october", received_on: "2026-10-07", category: "Otros", description: "Ingreso de octubre", amount_minor: 10000, currency: "UYU" },
    { id: "other-november", received_on: "2026-11-07", category: "Otros", description: "Ingreso de noviembre", amount_minor: 20000, currency: "UYU" },
  );
  tables.purchases.push(
    { id: "expense-october", purchased_on: "2026-10-08", paid_on: "2026-10-08", due_on: null,
      description: "Cuero de octubre", category: "Insumos", amount_minor: 30000, currency: "UYU", status: "pagada" },
    { id: "expense-november", purchased_on: "2026-11-08", paid_on: "2026-11-08", due_on: null,
      description: "Cuero de noviembre", category: "Insumos", amount_minor: 40000, currency: "UYU", status: "pagada" },
  );
  await page.goto("/finanzas/resumen");
  await page.getByRole("button", { name: "Ver mes anterior" }).click();
  await page.locator(".finance-row-label", { hasText: /^Otros$/ }).getByRole("button", { name: "Otros" }).click();
  await expect(page).toHaveURL(/\/finanzas\/ingresos\?mes=2026-10&detalle=1&categoria=Otros/);
  await expect(page.getByLabel("Mes")).toHaveValue("2026-10");
  await expect(page.getByRole("row").filter({ hasText: "Ingreso de octubre" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Ingreso de noviembre" })).toHaveCount(0);

  await page.goto("/finanzas/resumen");
  await page.getByRole("button", { name: "Ver mes anterior" }).click();
  await page.locator(".finance-row-label", { hasText: /^Insumos$/ }).getByRole("button", { name: "Insumos" }).click();
  await expect(page).toHaveURL(/\/finanzas\/egresos\?mes=2026-10&detalle=1&categoria=Insumos/);
  await expect(page.getByLabel("Mes")).toHaveValue("2026-10");
  await expect(page.getByRole("row").filter({ hasText: "Cuero de octubre" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Cuero de noviembre" })).toHaveCount(0);
  await page.getByRole("button", { name: "Quitar filtro" }).click();
  await expect(page.getByRole("heading", { name: "Realizados" })).toBeVisible();

  await page.goto("/finanzas/resumen");
  await page.getByRole("button", { name: "Ver mes anterior" }).click();
  await page.locator(".finance-row-label.income").getByRole("button", { name: "Ingresos" }).click();
  await expect(page).toHaveURL(/\/finanzas\/ingresos\?mes=2026-10&detalle=1$/);
  await expect(page.getByRole("row").filter({ hasText: "Ingreso de octubre" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "#9001" })).toBeVisible();
});

test("una fila de ventas abre los cobros del mes sin habilitar nuevas ventas en Ingresos", async ({ page }) => {
  await mockCommerce(page);
  await page.goto("/finanzas/resumen");
  await page.getByRole("button", { name: "Ver mes anterior" }).click();
  await page.locator(".finance-row-label", { hasText: /^Ventas web$/ }).getByRole("button", { name: "Ventas web" }).click();
  await expect(page).toHaveURL(/\/finanzas\/ingresos\?mes=2026-10&detalle=1&categoria=Ventas%20web/);
  await expect(page.getByLabel("Mes")).toHaveValue("2026-10");
  await expect(page.getByRole("heading", { name: "Ingresos del mes" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "#9001" })).toContainText("4.101");
  await expect(page.getByRole("button", { name: "Agregar ingreso" })).toHaveCount(0);
});

test("Egresos guarda el saldo de arranque como línea separada de los gastos pagados", async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.purchases.push({ id: "expense-november", purchased_on: "2026-11-05", paid_on: "2026-11-05",
    due_on: null, description: "Insumos", category: "Insumos", amount_minor: 10000, currency: "UYU", status: "pagada" });
  await page.goto("/finanzas/egresos");
  await expect(page.getByText("Saldo final del mes anterior")).toBeVisible();
  await page.getByRole("button", { name: "Cargar saldo" }).click();
  await page.getByLabel("Saldo de arranque en UYU").fill("5000");
  await page.getByRole("button", { name: "Guardar saldo" }).click();
  await expect.poll(() => writes.some((write) => write.table === "finance_monthly_openings" && write.body.amount_minor === 500000)).toBe(true);
  await expect(page.getByText("Pagado en noviembre de 2026").locator("..")).not.toContainText("5.000");
  expect(tables.finance_monthly_openings).toHaveLength(1);
  await page.goto("/finanzas/resumen");
  await expect(page.locator(".finance-cell.cumulative").nth(1)).toContainText("4.900");
});

test("el selector de meses queda debajo de los indicadores y con las flechas alineadas", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.purchases.push({ id: "expense-october", purchased_on: "2026-10-05", paid_on: "2026-10-05",
    due_on: null, description: "Cuero", category: "Insumos", amount_minor: 10000, currency: "UYU", status: "pagada" });
  await page.goto("/finanzas/resumen");
  const kpis = await page.locator(".finance-highlights").boundingBox();
  const month = await page.getByLabel("Mes del resumen").boundingBox();
  const previous = await page.getByRole("button", { name: "Ver mes anterior" }).boundingBox();
  const next = await page.getByRole("button", { name: "Ver mes siguiente" }).boundingBox();
  expect(kpis && month && previous && next).toBeTruthy();
  expect(month!.y).toBeGreaterThan(kpis!.y + kpis!.height);
  expect(Math.abs(month!.y + month!.height / 2 - (previous!.y + previous!.height / 2))).toBeLessThan(3);
  expect(Math.abs(month!.y + month!.height / 2 - (next!.y + next!.height / 2))).toBeLessThan(3);
});

test("registra la venta mayorista histórica en octubre sin repetirla en noviembre", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.order_lines.push({ line_id: "line-october", order_id: "PED-OCTOBER", created_at: "2026-10-10T12:00:00Z",
    completed_at: null, customer: "Mayorista", model: "Criollo", variant: "Natural", quantity: 1,
    status: "Completado", order_type: "normal", unit_price_arg: 10000, unit_price_uyu: 300,
    exchange_rate: 0.03, total_arg: 10000, total_uyu: 300 });
  tables.wholesale_order_records.push({ id: "sale-october", reference_code: "PED-OCTOBER", channel: "Mayorista", total_minor: 30000,
    customer_name: "Mayorista", contact_id: null });
  tables.wholesale_order_payment_openings.push({ sale_id: "sale-october", collected_minor: 25000,
    collected_arg_minor: 833300, paid_in_full_without_price: false, finance_paid_at_order: true });
  tables.wholesale_order_receipts.push({ id: "receipt-november", sale_id: "sale-october", amount_minor: 5000,
    source_amount_minor: 166700, currency: "ARS", payment_method: "Transferencia", paid_on: "2026-11-06" });
  await page.goto("/finanzas/resumen");
  await page.getByRole("button", { name: "Ver mes anterior" }).click();
  const sales = page.locator(".finance-row-label", { hasText: "Ventas mayoristas" });
  await expect(sales.locator("xpath=following-sibling::div[1]")).toContainText("300");
  await expect(page.getByText("Ajuste de caja mayorista")).toHaveCount(0);
});

test("guarda un ajuste mensual y actualiza el saldo final", async ({ page }) => {
  const { writes } = await mockCommerce(page, { writable: true });
  await page.goto("/finanzas/resumen");
  await page.getByRole("button", { name: "Editar ajuste de nov. 2026" }).click();
  await page.getByLabel("Importe en UYU, positivo o negativo").fill("-150");
  await page.getByRole("button", { name: "Guardar ajuste" }).click();
  await expect.poll(() => writes.some((write) => write.table === "finance_monthly_adjustments" && write.body.amount_minor === -15000)).toBe(true);
  await expect(page.locator(".finance-amount.manual-adjustment").first()).toContainText("150");
  await expect(page.locator(".finance-row-label", { hasText: "Saldo final" })).toBeVisible();
});

test("muestra las nuevas categorías y suma un ingreso adicional en el mes cobrado", async ({ page }) => {
  const { writes } = await mockCommerce(page, { writable: true });
  await page.goto("/finanzas/resumen");
  await expect(page.locator(".finance-row-label", { hasText: "Ingresos extraordinarios" })).toBeVisible();
  await expect(page.locator(".finance-row-label", { hasText: "Devolución impuestos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar ingreso" })).toHaveCount(0);
  await page.goto("/finanzas/ingresos");
  await expect(page.getByLabel("Fecha de cobro")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar ingreso" }).click();
  await expect(page.getByRole("dialog", { name: "Agregar ingreso" })).toBeVisible();
  await page.getByLabel("Fecha de cobro").fill("2026-11-05");
  await page.getByLabel("Categoría", { exact: true }).selectOption("Devolución impuestos");
  await page.getByLabel("Concepto").fill("Devolución DGI");
  await page.getByLabel("Importe", { exact: true }).fill("1250");
  await page.getByRole("button", { name: "Guardar ingreso" }).click();
  await expect.poll(() => writes.some((write) => write.table === "finance_manual_incomes" && write.body.amount_minor === 125000)).toBe(true);
  await expect(page.getByRole("row").filter({ hasText: "Devolución DGI" })).toContainText("1.250");
  await page.getByRole("button", { name: "Agregar ingreso" }).click();
  await page.getByRole("button", { name: "Nueva categoría" }).click();
  await page.getByLabel("Nueva categoría de ingreso").fill("Intereses");
  await page.getByRole("button", { name: "Agregar categoría" }).click();
  await expect(page.getByLabel("Categoría", { exact: true })).toHaveValue("Intereses");
  await page.goto("/finanzas/resumen");
  await expect(page.locator(".finance-row-label", { hasText: "Devolución impuestos" }).locator("xpath=following-sibling::div[1]"))
    .toContainText("1.250");
  await expect(page.locator(".finance-row-label", { hasText: "Intereses" })).toBeVisible();
});

test("registra un ingreso USD con su cotización y lo convierte en el resumen", async ({ page }) => {
  const { writes } = await mockCommerce(page, { writable: true });
  await page.goto("/finanzas/ingresos");
  await page.getByRole("button", { name: "Agregar ingreso" }).click();
  await page.getByLabel("Fecha de cobro").fill("2026-11-05");
  await page.getByLabel("Categoría", { exact: true }).selectOption("Otros");
  await page.getByLabel("Concepto").fill("Ingreso en dólares");
  await page.getByLabel("Importe", { exact: true }).fill("100");
  await page.getByLabel("Moneda").selectOption("USD");
  await expect(page.getByLabel("Cotización, UYU por USD")).toHaveValue("40.25");
  await page.getByRole("button", { name: "Guardar ingreso" }).click();
  await expect.poll(() => writes.some((write) => write.table === "finance_manual_incomes" &&
    write.body.currency === "USD" && write.body.exchange_rate_to_uyu === 40.25 && write.body.amount_minor === 10000)).toBe(true);
  await expect(page.getByRole("row").filter({ hasText: "Ingreso en dólares" })).toContainText("USD");
  await page.goto("/finanzas/resumen");
  await expect(page.locator(".finance-row-label", { hasText: "Otros" }).first().locator("xpath=following-sibling::div[1]"))
    .toContainText("4.025");
});

test("registra un egreso ARS con cotización guardada", async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.commerce_exchange_rates.push({ currency_code: "ARS", rate_to_uyu: 0.03 });
  tables.expense_categories.push({ id: "insumos", name: "Insumos", kind: "compra", active: true });
  await page.goto("/finanzas/egresos");
  await page.getByRole("button", { name: "Agregar egreso" }).click();
  await page.getByLabel("Concepto").fill("Compra argentina");
  await page.getByLabel("Categoría", { exact: true }).selectOption("Insumos");
  await page.getByLabel("Importe", { exact: true }).fill("1000");
  await page.getByLabel("Moneda").selectOption("ARS");
  await expect(page.getByLabel("Cotización, UYU por ARS")).toHaveValue("0.03");
  await page.getByRole("button", { name: "Guardar egreso" }).click();
  await expect.poll(() => writes.some((write) => write.table === "purchases" &&
    write.body.currency === "ARS" && write.body.exchange_rate_to_uyu === 0.03 && write.body.amount_minor === 100000)).toBe(true);
  await expect(page.getByRole("row").filter({ hasText: "Compra argentina" })).toContainText("ARS");
  await page.goto("/finanzas/resumen");
  await expect(page.locator(".finance-row-label", { hasText: "Insumos" }).first().locator("xpath=following-sibling::div[1]"))
    .toContainText("30");
});

test("distingue saldos positivos y negativos y unifica el estilo de las filas", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.finance_manual_incomes.push(
    { id: "income-october", received_on: "2026-10-05", category: "Otros", description: "Ingreso de octubre", amount_minor: 100000 },
    { id: "income-november", received_on: "2026-11-05", category: "Otros", description: "Ingreso de noviembre", amount_minor: 10000 },
  );
  tables.purchases.push(
    { id: "expense-october", purchased_on: "2026-10-06", paid_on: "2026-10-06", due_on: null,
      description: "Gasto de octubre", category: "Otros", amount_minor: 50000, currency: "UYU", status: "pagada" },
    { id: "expense-november", purchased_on: "2026-11-06", paid_on: "2026-11-06", due_on: null,
      description: "Gasto de noviembre", category: "Otros", amount_minor: 10000000, currency: "UYU", status: "pagada" },
  );
  await page.goto("/finanzas/resumen");
  await page.getByRole("button", { name: "Ver mes anterior" }).click();
  await expect(page.locator(".finance-amount.result").nth(0)).toHaveClass(/finance-positive/);
  await expect(page.locator(".finance-amount.result").nth(1)).toHaveClass(/finance-negative/);
  await expect(page.locator(".finance-amount.cumulative").nth(0)).toHaveClass(/finance-positive/);
  await expect(page.locator(".finance-amount.cumulative").nth(1)).toHaveClass(/finance-negative/);
  await expect(page.locator(".finance-amount.opening").nth(1)).toHaveClass(/finance-positive/);
  await expect(page.locator(".finance-amount.opening").nth(2)).toHaveClass(/finance-negative/);
  await expect(page.locator(".finance-amount.result").nth(0)).toHaveCSS("color", "rgb(182, 239, 197)");
  await expect(page.locator(".finance-amount.result").nth(1)).toHaveCSS("color", "rgb(255, 199, 186)");
  await expect(page.locator(".finance-amount.opening").nth(1)).toHaveCSS("color", "rgb(182, 239, 197)");
  await expect(page.locator(".finance-amount.cumulative").nth(1)).toHaveCSS("color", "rgb(255, 199, 186)");
  await expect(page.locator(".finance-row-label.opening")).toHaveCSS("background-color", "rgb(121, 76, 50)");
  await expect(page.locator(".finance-row-label.cumulative")).toHaveCSS("background-color", "rgb(121, 76, 50)");
  await expect(page.locator(".finance-amount.opening").nth(0)).toHaveCSS("background-color", "rgb(121, 76, 50)");
  await expect(page.locator(".finance-amount.cumulative").nth(0)).toHaveCSS("background-color", "rgb(121, 76, 50)");
  await expect(page.locator(".finance-row-label.withdrawals")).toHaveCSS("background-color", "rgb(246, 242, 236)");
  await expect(page.locator(".finance-row-label.manual-adjustment")).toHaveCSS("background-color", "rgb(246, 242, 236)");
});
