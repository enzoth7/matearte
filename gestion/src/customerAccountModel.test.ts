import { describe, expect, it } from "vitest";
import { seed, wholesaleBalanceArs, type Order } from "./data";
import { customerAccounts, receiptAvailableMinor } from "./customerAccountModel";
import { buildFinanceProjection } from "./financeProjection";

const order = (id: string, source: "wholesale" | "local"): Order => ({
  id, source, customerId: "customer", contactId: "contact", productId: "mate", quantity: 1,
  unitPrice: source === "local" ? 100 : 0, channel: source === "local" ? "Local" : "Mayorista",
  date: "2026-11-01", due: "2026-11-20", production: "Pendiente", delivery: "Pendiente",
  method: "Retiro", design: false, approved: true,
  ...(source === "wholesale" ? { wholesaleSaleId: "sale-wholesale", wholesaleTotalArg: 10000,
    wholesaleTotalUyu: 270, wholesaleOpeningPaid: 0, wholesaleOpeningPaidArg: 0 } : {}),
});

describe("cuentas por moneda", () => {
  it("separa una ficha mixta, descuenta ARS reales y no vuelve a proyectar créditos recibidos", () => {
    const state = seed();
    state.customers = [{ id: "customer", contactId: "contact", name: "Cliente", email: "", phone: "", city: "", segment: "Mayorista" }];
    state.orders = [order("wholesale", "wholesale"), order("local", "local")];
    state.payments = [
      { id: "direct", orderId: "wholesale", amount: 60, sourceCurrency: "ARS", sourceAmount: 2000, date: "2026-11-03", method: "Transferencia" },
      { id: "credit-ars", orderId: "", amount: 27, sourceCurrency: "ARS", sourceAmount: 1000, accountReceiptId: "credit-ars", date: "2026-11-04", method: "Transferencia" },
      { id: "credit-uyu", orderId: "", amount: 40, sourceCurrency: "UYU", sourceAmount: 40, accountReceiptId: "credit-uyu", date: "2026-11-04", method: "Efectivo" },
    ];
    state.accountReceipts = [
      { id: "credit-ars", contactId: "contact", amountMinor: 2700, sourceAmountMinor: 100000, currency: "ARS", paymentMethod: "Transferencia", paidOn: "2026-11-04", note: null },
      { id: "credit-uyu", contactId: "contact", amountMinor: 4000, sourceAmountMinor: 4000, currency: "UYU", paymentMethod: "Efectivo", paidOn: "2026-11-04", note: null },
    ];
    state.accountAllocations = [
      { id: "ars-allocation", receiptId: "credit-ars", orderId: "sale-wholesale", amountMinor: 1350, sourceAmountMinor: 50000, allocatedAt: "2026-11-05T12:00:00Z" },
      { id: "uyu-allocation", receiptId: "credit-uyu", orderId: "local", amountMinor: 2000, sourceAmountMinor: 2000, allocatedAt: "2026-11-05T12:00:00Z" },
    ];

    const accounts = customerAccounts(state);
    expect(accounts).toHaveLength(2);
    expect(accounts.find((account) => account.currency === "ARS")).toMatchObject({ pending: 7500, credit: 500, wholesalePending: 7500 });
    expect(accounts.find((account) => account.currency === "UYU")).toMatchObject({ pending: 80, credit: 20 });
    expect(receiptAvailableMinor(accounts.find((account) => account.currency === "ARS")!, "credit-ars")).toBe(50000);
    expect(wholesaleBalanceArs(state, state.orders[0])).toBe(7500);
    const november = buildFinanceProjection(state, { asOf: "2026-11-07" })[0];
    expect(november.actualIncome).toBe(127);
    expect(november.receivable).toBe(249);
  });

  it("excluye del saldo confirmado un precio ARS histórico no registrado", () => {
    const state = seed();
    state.customers = [{ id: "customer", contactId: "contact", name: "Cliente", email: "", phone: "", city: "", segment: "Mayorista" }];
    state.orders = [{ ...order("old", "wholesale"), wholesaleTotalArg: null, wholesaleOpeningPaidArg: null }];
    const [account] = customerAccounts(state);
    expect(account).toMatchObject({ currency: "ARS", pending: 0, unknownOrders: 1 });
    expect(buildFinanceProjection(state, { asOf: "2026-11-07" })[0].receivable).toBe(0);
    state.orders[0].wholesalePaidInFullWithoutPrice = true;
    expect(customerAccounts(state)[0]).toMatchObject({ pending: 0, unknownOrders: 0 });
    expect(wholesaleBalanceArs(state, state.orders[0])).toBe(0);
  });
});
