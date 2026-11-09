import { amountMinor, expenseId, expenseRow, nonNegativeMinor, sameExpense } from "./financeWrites.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function rejects(work: () => unknown) {
  try { work(); } catch { return; }
  throw new Error("Expected validation error");
}

Deno.test("bank amounts become exact minor units and reject invalid values", () => {
  equal(amountMinor("7982"), 798200);
  equal(amountMinor("1,86"), 186);
  equal(amountMinor("0.01"), 1);
  for (const value of ["0", "-1", "1.234", "1,000.00", "1e3", "abc"]) rejects(() => amountMinor(value));
});

Deno.test("zero cost and signed monthly amounts retain cents", () => {
  equal(nonNegativeMinor("0"), 0);
  equal(nonNegativeMinor("0,00"), 0);
  equal(nonNegativeMinor("1.25"), 125);
  rejects(() => nonNegativeMinor("-1"));
});

Deno.test("foreign-currency expenses require the movement rate", () => {
  const input = { clave_movimiento: "bank-ref-ars", fecha: "2026-11-08", descripcion: "Insumo", categoria: "Otros",
    importe: "1500.00", moneda: "ARS" as const, estado: "pagada" as const, cotizacion_uyu: 0.0265 };
  equal(expenseRow(input, "id").exchange_rate_to_uyu, 0.0265);
  rejects(() => expenseRow({ ...input, cotizacion_uyu: undefined }, "id"));
});

Deno.test("transaction IDs are stable per Richard and movement key", async () => {
  const a = await expenseId("richard", "bank-ref-123");
  equal(a, await expenseId("richard", "bank-ref-123"));
  if (a === await expenseId("richard", "bank-ref-124")) throw new Error("Different movements shared an ID");
  if (a === await expenseId("enzo", "bank-ref-123")) throw new Error("Different users shared an ID");
});

Deno.test("retries compare the saved movement without changing its fields", () => {
  const input = { clave_movimiento: "bank-ref-123", fecha: "2026-11-04", descripcion: "Peaje", categoria: "Envíos y logística", importe: "300", moneda: "UYU" as const, estado: "pagada" as const };
  const row = expenseRow(input, "id");
  equal(row.amount_minor, 30000);
  equal(row.paid_on, "2026-11-04");
  equal(sameExpense(row, expenseRow(input, "id")), true);
  equal(sameExpense(row, expenseRow({ ...input, importe: "301" }, "id")), false);
  rejects(() => expenseRow({ ...input, estado: "pendiente", fecha_pago: "2026-11-04" }, "id"));
});
