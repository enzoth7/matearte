import { describe, expect, it } from "vitest";
import { seed, type Order } from "./data";
import { customerAccounts } from "./customerAccountModel";
import { accountMovements, withRunningBalance } from "./customerAccountMovements";

const fiado = (id: string, date: string, title: string, amount: number): Order => ({
  id, source: "local", customerId: "customer", contactId: "contact", productId: "mate", quantity: 1,
  unitPrice: amount, totalAmount: amount, channel: "Local", date, due: date, production: "Pendiente",
  delivery: "Pendiente", method: "Retiro", design: false, approved: true, paymentMethod: "Cuenta corriente",
  items: [{ title }],
} as Order);

describe("saldo acumulado de la cuenta", () => {
  it("suma cada producto que llega, resta cada cobro y termina en el saldo neto", () => {
    const state = seed();
    state.customers = [{ id: "customer", contactId: "contact", name: "Ana", email: "", phone: "", city: "", segment: "Minorista" }];
    state.orders = [fiado("saldo", "2026-11-06", "Saldo", 4000), fiado("termo", "2026-11-06", "Termos", 3900), fiado("matera", "2026-11-19", "Materas", 3500)];
    state.payments = [{ id: "pay", orderId: "saldo", amount: 2000, sourceCurrency: "UYU", sourceAmount: 2000, date: "2026-11-06", method: "Efectivo" }];

    const [account] = customerAccounts(state);
    const rows = withRunningBalance(account, accountMovements(account, state));

    expect(rows.map((row) => [row.detail, row.balance])).toEqual([
      ["Saldo", 4000], ["Termos", 7900], ["Efectivo", 5900], ["Materas", 9400],
    ]);
    expect(rows.at(-1)!.balance).toBe(account.pending - account.credit);
  });

  it("muestra el producto del pedido como detalle de la venta", () => {
    const state = seed();
    state.customers = [{ id: "customer", contactId: "contact", name: "Ana", email: "", phone: "", city: "", segment: "Minorista" }];
    state.orders = [fiado("termo", "2026-11-06", "Termos", 3900)];
    const [account] = customerAccounts(state);
    expect(accountMovements(account, state)[0]).toMatchObject({ label: "Venta fiada", detail: "Termos", charge: 3900 });
  });
});
