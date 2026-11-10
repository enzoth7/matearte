import { describe, expect, it } from "vitest";
import { seed, wholesaleBalanceArs, type State } from "./data";
import { consignmentReceiptAvailableMinor, consignmentSummary } from "./consignmentModel";
import { customerAccounts } from "./customerAccountModel";
import { buildFinanceProjection } from "./financeProjection";

function fixture(): State {
  return {
    ...seed(),
    customers: [{ id: "customer-1", contactId: "contact-1", name: "Cliente mayorista", email: "", phone: "", city: "", segment: "Mayorista" }],
    consignments: [{ id: "consignment-1", orderId: "order-1", contactId: "contact-1", exchangeRate: 0.03, createdAt: "2026-11-01T12:00:00Z" }],
    consignmentLines: [{ id: "line-1", consignmentId: "consignment-1", orderItemId: "item-1", variantId: "variant-1", sku: "123", title: "Mate Imperial", quantity: 100, unitPriceArgMinor: 100_000 }],
    consignmentMovements: [{ id: "sent-1", lineId: "line-1", kind: "dispatch", quantity: 100, occurredOn: "2026-11-01", carrier: null, tracking: null, note: null, createdAt: "2026-11-01T12:00:00Z" }],
  };
}

describe("consignaciones mayoristas", () => {
  it("no genera saldo por enviar y conserva el control de unidades devueltas", () => {
    const state = fixture();
    expect(consignmentSummary(state, state.consignments![0])).toMatchObject({ dispatched: 100, held: 100, kept: 0, balanceArgMinor: 0 });
    state.consignmentMovements!.push({ id: "return-1", lineId: "line-1", kind: "return", quantity: 20, occurredOn: "2026-11-08", carrier: null, tracking: null, note: null, createdAt: "2026-11-08T12:00:00Z" });
    expect(consignmentSummary(state, state.consignments![0])).toMatchObject({ held: 80, returned: 20, kept: 0, balanceArgMinor: 0 });
  });

  it("cobra solo las unidades conservadas, acepta cuotas y convierte una vez en finanzas", () => {
    const state = fixture();
    state.orders = [{ id: "order-1", wholesaleSaleId: "order-1", consignmentId: "consignment-1",
      source: "wholesale", contactId: "contact-1", customerId: "customer-1", productId: "mate-1",
      quantity: 100, unitPrice: 0, totalAmount: 3000, wholesaleTotalArg: 100_000,
      wholesaleTotalUyu: 3000, channel: "Mayorista", date: "2026-11-01", due: "",
      production: "Terminado", delivery: "Pendiente", method: "No aplica", design: false, approved: true }];
    state.consignmentMovements!.push(
      { id: "return-1", lineId: "line-1", kind: "return", quantity: 20, occurredOn: "2026-11-08", carrier: null, tracking: null, note: null, createdAt: "2026-11-08T12:00:00Z" },
      { id: "kept-1", lineId: "line-1", kind: "kept", quantity: 80, occurredOn: "2026-11-08", carrier: null, tracking: null, note: null, createdAt: "2026-11-08T12:01:00Z" },
    );
    state.accountReceipts = [
      { id: "receipt-1", contactId: "contact-1", amountMinor: 90_000, sourceAmountMinor: 3_000_000, currency: "ARS", paymentMethod: "Transferencia", paidOn: "2026-11-08", note: null },
      { id: "receipt-2", contactId: "contact-1", amountMinor: 60_000, sourceAmountMinor: 2_000_000, currency: "ARS", paymentMethod: "Transferencia", paidOn: "2026-11-08", note: null },
    ];
    state.consignmentAllocations = [
      { id: "allocation-1", consignmentId: "consignment-1", receiptId: "receipt-1", sourceAmountMinor: 3_000_000, allocatedAt: "2026-11-08T12:00:00Z" },
      { id: "allocation-2", consignmentId: "consignment-1", receiptId: "receipt-2", sourceAmountMinor: 2_000_000, allocatedAt: "2026-11-08T12:00:00Z" },
    ];
    state.payments = state.accountReceipts.map((receipt) => ({ id: receipt.id, orderId: "", contactId: receipt.contactId,
      accountReceiptId: receipt.id, sourceCurrency: "ARS", sourceAmount: receipt.sourceAmountMinor / 100,
      amount: receipt.amountMinor / 100, date: receipt.paidOn, method: receipt.paymentMethod }));
    const summary = consignmentSummary(state, state.consignments![0]);
    expect(summary).toMatchObject({ dispatched: 100, held: 0, returned: 20, kept: 80,
      confirmedArgMinor: 8_000_000, paidArgMinor: 5_000_000, balanceArgMinor: 3_000_000 });
    expect(wholesaleBalanceArs(state, state.orders[0])).toBe(30_000);
    expect(customerAccounts(state).find((account) => account.id === "contact-1:ARS")).toMatchObject({ pending: 30_000, credit: 0 });
    expect(consignmentReceiptAvailableMinor(state, "receipt-1")).toBe(0);
    const current = buildFinanceProjection(state, { asOf: "2026-11-08" })[0];
    expect(current.actualIncome).toBe(1_500);
    expect(current.receivable).toBe(900);
  });

  it("mantiene como crédito un pago anterior a la confirmación", () => {
    const state = fixture();
    state.accountReceipts = [{ id: "advance", contactId: "contact-1", amountMinor: 30_000,
      sourceAmountMinor: 1_000_000, currency: "ARS", paymentMethod: "Efectivo", paidOn: "2026-11-02", note: null }];
    expect(customerAccounts(state).find((account) => account.id === "contact-1:ARS")).toMatchObject({ pending: 0, credit: 10_000 });
    expect(consignmentReceiptAvailableMinor(state, "advance")).toBe(1_000_000);
  });

  it("separa entregas parciales de dos productos y cobra sus precios pactados", () => {
    const state = fixture();
    state.consignmentLines!.push({ id: "line-2", consignmentId: "consignment-1", orderItemId: "item-2",
      variantId: "variant-2", sku: "456", title: "Mate Torpedo", quantity: 50, unitPriceArgMinor: 200_000 });
    state.consignmentMovements = [
      { id: "sent-1", lineId: "line-1", kind: "dispatch", quantity: 30, occurredOn: "2026-11-01", carrier: null, tracking: null, note: null, createdAt: "2026-11-01T12:00:00Z" },
      { id: "sent-2", lineId: "line-2", kind: "dispatch", quantity: 20, occurredOn: "2026-11-02", carrier: null, tracking: null, note: null, createdAt: "2026-11-02T12:00:00Z" },
      { id: "returned", lineId: "line-1", kind: "return", quantity: 5, occurredOn: "2026-11-03", carrier: null, tracking: null, note: null, createdAt: "2026-11-03T12:00:00Z" },
      { id: "kept-1", lineId: "line-1", kind: "kept", quantity: 15, occurredOn: "2026-11-04", carrier: null, tracking: null, note: null, createdAt: "2026-11-04T12:00:00Z" },
      { id: "kept-2", lineId: "line-2", kind: "kept", quantity: 10, occurredOn: "2026-11-04", carrier: null, tracking: null, note: null, createdAt: "2026-11-04T12:00:00Z" },
    ];
    expect(consignmentSummary(state, state.consignments![0])).toMatchObject({ planned: 150, dispatched: 50,
      held: 20, returned: 5, kept: 25, confirmedArgMinor: 3_500_000, balanceArgMinor: 3_500_000 });
  });
});
