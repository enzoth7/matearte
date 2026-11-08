import { describe, expect, it } from "vitest";
import { seedFixture as seed } from "./testing/fixture";
import { buildFinanceProjection } from "./financeProjection";
import { buildExpenseForecast, buildRevenueForecast } from "./revenueForecast";
import { seed as emptyState, paid, balance, type Order } from "./data";

describe("proyección financiera mensual", () => {
  it("incluye ingresos adicionales una sola vez en el mes cobrado y en su categoría", () => {
    const months = buildFinanceProjection(emptyState(), { asOf: "2026-11-08", startMonth: "2026-10",
      manualIncomes: [{ id: "devolucion-1", receivedOn: "2026-10-12", category: "Devolución impuestos",
        description: "Devolución", amountMinor: 125000, currency: "UYU", exchangeRateToUyu: null }] });
    expect(months[0].incomeCategories["Devolución impuestos"]).toBe(1250);
    expect(months[0].actualIncome).toBe(1250);
    expect(months[0].result).toBe(1250);
    expect(months[1].incomeCategories["Devolución impuestos"]).toBeUndefined();
  });
  it("convierte un ingreso adicional en dólares con su cotización registrada", () => {
    const months = buildFinanceProjection(emptyState(), { asOf: "2026-11-08", startMonth: "2026-11",
      manualIncomes: [{ id: "extra-usd", receivedOn: "2026-11-08", category: "Otros",
        description: "Ingreso exterior", amountMinor: 10000, currency: "USD", exchangeRateToUyu: 40 }] });
    expect(months[0].incomeCategories.Otros).toBe(4000);
    expect(months[0].income).toBe(4000);
  });
  it("separa cobros, cuentas por cobrar, pagos y cuentas por pagar", () => {
    const months = buildFinanceProjection(seed(), { asOf: "2026-10-13" });
    expect(months).toHaveLength(12);
    expect(months[0].key).toBe("2026-10");
    expect(months[11].key).toBe("2027-09");
    expect(months[0].actualIncome).toBe(63025);
    expect(months[0].receivable).toBe(13105);
    expect(months[0].actualExpense).toBe(14500);
    expect(months[0].payable).toBe(68000);
    expect(months[0].result).toBe(-6370);
    expect(months[1].estimatedIncome).toBe(buildRevenueForecast(seed(), { asOf: "2026-10-13" }).months[1].linear);
    expect(months[1].estimatedExpense).toBe(buildExpenseForecast(seed(), { asOf: "2026-10-13" }).months[1].linear);
    expect(months[0].opening).toBe(buildFinanceProjection(seed(),
      { asOf: "2026-10-13", startMonth: "2026-09" })[0].cumulative);
    expect(months[1].opening).toBe(months[0].cumulative);
    expect(months.every((month) => Number.isFinite(month.opening) && Number.isFinite(month.cumulative))).toBe(true);
    expect(months[1].cumulative).toBe(months[0].cumulative + months[1].result);
    for (const month of months) {
      expect(month.income).toBe(month.actualIncome + month.receivable + month.estimatedIncome);
      expect(month.expense).toBe(month.actualExpense + month.payable + month.estimatedExpense);
      expect(month.result).toBe(month.income - month.expense);
      expect(month.cumulative).toBe(month.opening + month.result);
    }
    expect(new Set(months.slice(1).map((month) => month.estimatedIncome)).size).toBeGreaterThan(1);
    expect(new Set(months.slice(1).map((month) => month.estimatedExpense)).size).toBeGreaterThan(1);
  });

  it("actualiza la estimación sin convertirla en movimiento realizado", () => {
    const baseline = buildFinanceProjection(seed(), { asOf: "2026-10-13", growthPercent: 0 });
    const growing = buildFinanceProjection(seed(), { asOf: "2026-10-13", growthPercent: 5, openingBalance: 2000 });
    expect(growing[0].actualIncome).toBe(baseline[0].actualIncome);
    expect(growing[1].estimatedIncome).toBeGreaterThan(baseline[1].estimatedIncome);
    expect(growing[0].cumulative).toBe(baseline[0].cumulative + 2000);
  });

  it("no duplica los egresos futuros ya registrados dentro del costo estimado", () => {
    const state = seed();
    state.expenses.push({
      id: "future-paid", name: "Compra prevista", amount: 10000,
      date: "2026-11-15", paid: true, category: "Compras",
    });
    const november = buildFinanceProjection(state, { asOf: "2026-10-13" })[1];
    const expected = buildExpenseForecast(state, { asOf: "2026-10-13" }).months[1].linear;
    expect(november.actualExpense).toBe(10000);
    expect(november.estimatedExpense).toBe(expected - 10000);
    expect(november.expense).toBe(expected);
  });

  it("descuenta el dinero a favor del cobro futuro sin volver a registrar el ingreso", () => {
    const state = emptyState();
    const base: Order = {
      id: "pedido-octubre", source: "local", contactId: "cliente-1", customerId: "cliente-1",
      productId: "mate", quantity: 1, unitPrice: 100, channel: "Local", date: "2026-10-01",
      due: "2026-10-20", production: "No aplica", delivery: "Pendiente", method: "Retiro",
      design: false, approved: true,
    };
    state.orders = [base, { ...base, id: "pedido-noviembre", date: "2026-11-01", due: "2026-11-20" }];
    state.accountReceipts = [{ id: "entrega-1", contactId: "cliente-1", amountMinor: 6000,
      sourceAmountMinor: 6000, currency: "UYU", paymentMethod: "Efectivo", paidOn: "2026-10-05", note: null }];
    state.payments = [{ id: "entrega-1", orderId: "", contactId: "cliente-1", accountReceiptId: "entrega-1",
      amount: 60, date: "2026-10-05", method: "Efectivo" }];
    const months = buildFinanceProjection(state, { asOf: "2026-10-13" });
    expect(months[0].actualIncome).toBe(60);
    expect(months[0].receivable).toBe(40);
    expect(months[1].receivable).toBe(100);
    expect(months[0].actualIncome + months[0].receivable).toBe(100);
  });

  it("registra un fiado local por categorías como ingreso solo al cobrarlo", () => {
    const state = emptyState();
    const order: Order = {
      id: "fiado-categorias", source: "local", customerId: "cliente-1", contactId: "cliente-1",
      productId: "categoria", quantity: 1, unitPrice: 0, totalAmount: 600,
      depositAmount: 0, paymentMethod: "Cuenta corriente", channel: "Local", date: "2026-11-08",
      due: "", production: "No aplica", delivery: "Pendiente", method: "No aplica",
      design: false, approved: true,
      items: [{ id: "categoria", productId: "categoria", title: "Mates personalizados", sku: "",
        quantity: 1, unitPrice: 600, amount: 600, family: "Mates personalizados", variant: "",
        rim: "", leather: "", productionStatus: "completed", reviewStatus: null,
        orderType: "credit_category" }],
    };
    state.orders = [order];
    state.payments = [{ id: "local-receipt:cobro-1", orderId: order.id, amount: 150,
      date: "2026-11-08", method: "Efectivo" }];
    const november = buildFinanceProjection(state, { asOf: "2026-11-08" })[0];
    expect(balance(state, order)).toBe(450);
    expect(november.actualIncome).toBe(150);
    expect(november.receivable).toBe(0);
    expect(november.incomeCategories["Ventas locales"]).toBe(150);
    expect(november.income).toBe(150);
  });

  it("aplica el saldo de una entrega al pedido mayorista identificado en la base", () => {
    const state = emptyState();
    const order: Order = {
      id: "grupo-mayorista", wholesaleSaleId: "pedido-en-base", source: "wholesale",
      contactId: "cliente-1", customerId: "cliente-1", wholesaleOpeningPaid: 0, wholesaleOpeningPaidArg: 0,
      wholesaleTotalArg: 100, wholesaleTotalUyu: 100,
      productId: "mate", quantity: 1, unitPrice: 100, channel: "Mayorista", date: "2026-10-01",
      due: "2026-10-20", production: "Pendiente", delivery: "Pendiente", method: "Envío",
      design: false, approved: true,
    };
    state.orders = [order];
    state.accountAllocations = [{ id: "asignacion-1", receiptId: "entrega-1", orderId: "pedido-en-base",
      amountMinor: 4000, sourceAmountMinor: 4000, allocatedAt: "2026-10-05T12:00:00Z" }];
    expect(paid(state, order)).toBe(40);
    expect(balance(state, order)).toBe(60);
    expect(buildFinanceProjection(state, { asOf: "2026-10-13" })[0].receivable).toBe(60);
  });

  it("permite recorrer meses pasados sin llevar cuentas por cobrar actuales al pasado", () => {
    const state = seed();
    const months = buildFinanceProjection(state, { asOf: "2026-11-08", startMonth: "2026-09" });
    expect(months[0].key).toBe("2026-09");
    expect(months[2].key).toBe("2026-11");
    expect(months[0].receivable).toBe(0);
    expect(months[1].payable).toBe(0);
    expect(months[0].estimatedIncome).toBe(0);
    expect(months[1].estimatedExpense).toBe(0);
    for (const month of months) {
      expect(Object.values(month.incomeCategories).reduce((sum, amount) => sum + amount, 0)).toBe(month.income);
      expect(Object.values(month.expenseCategories).reduce((sum, amount) => sum + amount, 0)).toBe(month.expense);
    }
  });

  it("usa el saldo cargado para iniciar el mes sin sumarlo a los egresos", () => {
    const state = emptyState();
    state.expenses = [{ id: "insumo-octubre", name: "Cuero", category: "Insumos",
      amount: 100, date: "2026-10-05", paid: true }];
    const months = buildFinanceProjection(state, { asOf: "2026-11-08", startMonth: "2026-10",
      openingBalances: { "2026-10": 1000, "2026-11": 850 } });
    expect(months[0].opening).toBe(1000);
    expect(months[0].expenseCategories.Insumos).toBe(100);
    expect(months[0].expense).toBe(100);
    expect(months[0].cumulative).toBe(900);
    expect(months[1].opening).toBe(850);
    expect(months[1].balanceKnown).toBe(true);
    expect(months[1].expenseCategories.Insumos).toBeUndefined();
  });

  it("arrastra a noviembre el saldo final de octubre cuando no hay saldo manual de noviembre", () => {
    const state = emptyState();
    state.payments = [{ id: "web:octubre", orderId: "", amount: 150,
      date: "2026-10-05", method: "Transferencia" }];
    state.expenses = [{ id: "insumo-octubre", name: "Cuero", category: "Insumos",
      amount: 40, date: "2026-10-06", paid: true }];
    const options = { asOf: "2026-11-08", monthlyAdjustments: { "2026-10": -5 } };
    const october = buildFinanceProjection(state, { ...options, startMonth: "2026-10" })[0];
    const november = buildFinanceProjection(state, { ...options, startMonth: "2026-11" })[0];
    expect(october.cumulative).toBe(105);
    expect(november.opening).toBe(october.cumulative);
    expect(buildFinanceProjection(state, { ...options, startMonth: "2026-11",
      openingBalances: { "2026-11": 90 } })[0].opening).toBe(90);
  });

  it("descuenta retiros del saldo final sin convertirlos en egresos", () => {
    const months = buildFinanceProjection(emptyState(), { asOf: "2026-11-08",
      openingBalances: { "2026-11": 1000 },
      adjustments: { "2026-11": { withdrawals: 150, contributions: 20 } } });
    expect(months[0].expense).toBe(0);
    expect(months[0].result).toBe(0);
    expect(months[0].withdrawals).toBe(150);
    expect(months[0].contributions).toBe(20);
    expect(months[0].cumulative).toBe(870);
  });

  it("ubica una venta mayorista histórica pagada en el mes del pedido", () => {
    const state = emptyState();
    state.orders = [{ id: "wholesale:october", wholesaleSaleId: "sale-october", source: "wholesale",
      contactId: "client-1", customerId: "client-1", productId: "mate", quantity: 1, unitPrice: 0,
      wholesaleTotalArg: 10000, wholesaleTotalUyu: 300, wholesaleOpeningPaid: 250,
      wholesaleOpeningPaidArg: 8333, wholesaleHistoricalPaidAtOrder: true,
      channel: "Mayorista", date: "2026-10-10", due: "",
      production: "Terminado", delivery: "Enviado", method: "Envío", design: false, approved: true }];
    state.payments = [{ id: "wholesale-receipt:november", orderId: "wholesale:october",
      amount: 50, date: "2026-11-06", method: "Transferencia", sourceCurrency: "ARS", sourceAmount: 1667 }];
    const months = buildFinanceProjection(state, { asOf: "2026-11-08", startMonth: "2026-10" });
    expect(months[0].incomeCategories["Ventas mayoristas"]).toBe(300);
    expect(months[0].income).toBe(300);
    expect(months[0].cumulative).toBe(300);
    expect(months[1].incomeCategories["Ventas mayoristas"]).toBeUndefined();
    expect(months[1].income).toBe(0);
    expect(months[1].cumulative).toBe(300);
  });

  it("separa una entrega a cuenta asignada a una venta mayorista ya registrada", () => {
    const state = emptyState();
    state.orders = [{ id: "wholesale:october", wholesaleSaleId: "sale-october", source: "wholesale",
      contactId: "client-1", customerId: "client-1", productId: "mate", quantity: 1, unitPrice: 0,
      wholesaleTotalArg: 10000, wholesaleTotalUyu: 300, wholesaleOpeningPaid: 250,
      wholesaleOpeningPaidArg: 8333, wholesaleHistoricalPaidAtOrder: true,
      channel: "Mayorista", date: "2026-10-10", due: "",
      production: "Terminado", delivery: "Enviado", method: "Envío", design: false, approved: true }];
    state.accountReceipts = [{ id: "receipt-1", contactId: "client-1", amountMinor: 5000,
      sourceAmountMinor: 166700, currency: "ARS", paymentMethod: "Transferencia", paidOn: "2026-11-06", note: null }];
    state.accountAllocations = [{ id: "allocation-1", receiptId: "receipt-1", orderId: "sale-october",
      amountMinor: 5000, sourceAmountMinor: 166700, allocatedAt: "2026-11-06T12:00:00Z" }];
    state.payments = [{ id: "account-receipt:receipt-1", accountReceiptId: "receipt-1", orderId: "",
      amount: 50, date: "2026-11-06", method: "Transferencia" }];
    const months = buildFinanceProjection(state, { asOf: "2026-11-08", startMonth: "2026-10" });
    expect(months[0].incomeCategories["Ventas mayoristas"]).toBe(300);
    expect(months[1].income).toBe(0);
  });

  it("conserva los cobros fechados de un pedido mayorista activo", () => {
    const state = emptyState();
    state.orders = [{ id: "wholesale:active", source: "wholesale", customerId: "client-1", productId: "mate",
      quantity: 1, unitPrice: 0, wholesaleTotalArg: 10000, wholesaleTotalUyu: 300,
      wholesaleOpeningPaid: 100, wholesaleOpeningPaidArg: 3333, channel: "Mayorista", date: "2026-10-10", due: "",
      production: "En producción", delivery: "Pendiente", method: "Envío", design: false, approved: true }];
    state.payments = [{ id: "wholesale-receipt:active", orderId: "wholesale:active", amount: 50,
      date: "2026-11-06", method: "Transferencia", sourceCurrency: "ARS", sourceAmount: 1667 }];
    const months = buildFinanceProjection(state, { asOf: "2026-11-08", startMonth: "2026-10" });
    expect(months[0].incomeCategories["Ventas mayoristas"]).toBe(100);
    expect(months[1].actualIncome).toBe(50);
    expect(months[1].receivable).toBeGreaterThan(0);
  });

  it("arrastra diciembre desde el saldo final de noviembre con el ajuste manual", () => {
    const state = emptyState();
    state.expenses = [
      { id: "november", name: "Compra", category: "Insumos", amount: 100, date: "2026-11-10", paid: true },
      { id: "december", name: "Compra", category: "Insumos", amount: 50, date: "2026-12-10", paid: true },
    ];
    const months = buildFinanceProjection(state, { asOf: "2026-12-15", startMonth: "2026-12",
      openingBalances: { "2026-11": 500, "2026-12": 999 },
      monthlyAdjustments: { "2026-11": -20, "2026-12": 10 } });
    expect(months[0].key).toBe("2026-12");
    expect(months[0].opening).toBe(380);
    expect(months[0].manualAdjustment).toBe(10);
    expect(months[0].cumulative).toBe(340);
  });
});
