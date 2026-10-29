import { pageNumber, queryErrorMessage, readAll, readPage, summarizeLocalSales, type LocalSale, type QueryResult } from "./queries.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
async function rejects(work: () => Promise<unknown>, message: string) {
  try { await work(); } catch (error) {
    if (error instanceof Error && error.message.includes(message)) return;
    throw error;
  }
  throw new Error("Expected rejection");
}
const ok = <T>(data: T[], count = data.length): QueryResult<T> => ({ data, count, error: null, status: 200 });

Deno.test("Richard: page 1 returns the 31 sales instead of skipping the first 50", async () => {
  const sales = Array.from({ length: 31 }, (_, id) => ({ id }));
  const calls: number[][] = [];
  const response = await readPage((start, end) => {
    calls.push([start, end]);
    return Promise.resolve(ok(sales.slice(start, end + 1), 31));
  }, 1, 50);
  equal(calls, [[0, 49]]);
  equal(response.data?.length, 31);
  equal(response.count, 31);
  equal(pageNumber(0), 1);
});

Deno.test("a page past the last sale is empty with a count, not a permission error", async () => {
  const calls: number[][] = [];
  const response = await readPage((start, end) => {
    calls.push([start, end]);
    return Promise.resolve(start === 0 ? ok([{ id: 1 }], 31) : { data: null, count: null, error: { code: "PGRST103" }, status: 416 });
  }, 2, 50);
  equal(calls, [[50, 99], [0, 0]]);
  equal(response.data, []);
  equal(response.count, 31);
  equal(response.error, null);
  equal(response.outOfRange, true);
});

Deno.test("an empty source is a successful empty page", async () => {
  const response = await readPage(() => Promise.resolve(ok([])), 1, 50);
  equal(response.data, []);
  equal(response.outOfRange, false);
});

Deno.test("real permission errors are preserved and never retried as empty pages", async () => {
  let calls = 0;
  const response = await readPage(() => { calls++; return Promise.resolve({ data: null, count: null, error: { code: "42501" }, status: 403 }); }, 1, 20);
  equal(calls, 1);
  equal(queryErrorMessage(response.error!), "La cuenta no tiene permiso para consultar esta fuente.");
  if (queryErrorMessage({ code: "PGRST000" }).includes("no tiene permiso")) throw new Error("Transport error mistaken for permission error");
});

Deno.test("summaries read beyond 50/500 rows before computing a total", async () => {
  const rows = Array.from({ length: 731 }, (_, id) => ({ id }));
  equal((await readAll((start, end) => Promise.resolve(ok(rows.slice(start, end + 1), rows.length)))).length, 731);
});

Deno.test("summaries reject oversized, incomplete, changing and forbidden results", async () => {
  await rejects(() => readAll(() => Promise.resolve(ok([], 10001))), "demasiados");
  await rejects(() => readAll(() => Promise.resolve(ok([], 31))), "incompleta");
  await rejects(() => readAll((start) => Promise.resolve(ok(Array.from({ length: 500 }, (_, i) => i), start ? 601 : 600))), "cambiaron");
  await rejects(() => readAll(() => Promise.resolve({ data: null, count: null, error: { code: "42501" } })), "permiso");
});

const sale = (values: Partial<LocalSale> = {}): LocalSale => ({ id: "paid", channel: "Local", currency: "UYU", total_minor: 10000, deposit_minor: null, payment_method: "Efectivo", ...values });
Deno.test("paid sales, explicit deposits and legacy Seña match Gestión without double counting", () => {
  const sales = [sale(), sale({ id: "deposit", total_minor: 2000, deposit_minor: 2000 }), sale({ id: "legacy", total_minor: 1000, payment_method: "Seña" })];
  const groups = summarizeLocalSales(sales, [{ sale_id: "deposit", line_total_minor: 5000 }, { sale_id: "legacy", line_total_minor: 6000 }], [{ sale_id: "deposit", amount_minor: 3000 }, { sale_id: "legacy", amount_minor: 2000 }]);
  equal(groups, [{ canal: "Local", moneda: "UYU", ventas: 3, vendido_minor: 21000, cobro_inicial_minor: 13000, cobros_posteriores_minor: 5000, cobrado_minor: 18000, saldo_pendiente_minor: 3000, excedente_cobrado_minor: 0, ventas_con_saldo: 1 }]);
});

Deno.test("currencies and channels stay separate; overpayments never cancel another customer's debt", () => {
  const groups = summarizeLocalSales([sale(), sale({ id: "debt", total_minor: 0, deposit_minor: 0 }), sale({ id: "ars", currency: "ARS" }), sale({ id: "fair", channel: "Feria" })], [{ sale_id: "debt", line_total_minor: 5000 }], [{ sale_id: "paid", amount_minor: 7000 }]);
  equal(groups.length, 3);
  const local = groups.find((group) => group.canal === "Local" && group.moneda === "UYU")!;
  equal(local.saldo_pendiente_minor, 5000);
  equal(local.excedente_cobrado_minor, 7000);
  equal(summarizeLocalSales([], [], []), []);
});

Deno.test("invalid monetary data fails instead of returning a plausible wrong total", () => {
  let failed = false;
  try { summarizeLocalSales([sale({ total_minor: NaN })], [], []); } catch { failed = true; }
  equal(failed, true);
});
