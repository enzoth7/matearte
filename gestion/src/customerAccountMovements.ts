import { orderName, type State } from "./data";
import { accountMoney, accountOrderTotal, receiptAvailableMinor, type CustomerAccount } from "./customerAccountModel";

export type Movement = {
  id: string; date: string; label: string; detail: string; orderId?: string;
  charge?: number; collection?: number; receiptId?: string; availableMinor?: number;
};
export type MovementWithBalance = Movement & { balance: number };

const orderProducts = (order: CustomerAccount["orders"][number]) =>
  order.items?.map((item) => item.title).filter(Boolean).join(", ") || orderName(order);

export function accountMovements(account: CustomerAccount, state: State): Movement[] {
  const orderIds = new Set(account.orders.map((order) => order.id));
  const movements: Movement[] = account.orders.filter((order) => !order.consignmentId).map((order) => ({
    id: `order:${order.id}`, date: order.date, label: order.source === "wholesale" ? "Pedido mayorista" : order.paymentMethod === "Cuenta corriente" ? "Venta fiada" : order.depositAmount != null ? "Pedido con seña" : "Venta local",
    detail: orderProducts(order), orderId: order.id, charge: accountOrderTotal(state, order) ?? undefined,
  }));
  for (const payment of state.payments.filter((entry) => orderIds.has(entry.orderId))) {
    movements.push({ id: `payment:${payment.id}`, date: payment.date, label: "Cobro del pedido",
      detail: payment.method, orderId: payment.orderId, collection: account.currency === "ARS" ? payment.sourceCurrency === "ARS" ? payment.sourceAmount : undefined : payment.amount ?? undefined });
  }
  for (const order of account.orders.filter((entry) => entry.source === "wholesale" && (entry.wholesaleOpeningPaidArg || 0) > 0)) {
    movements.push({ id: `opening:${order.id}`, date: "", label: "Cobrado antes del registro",
      detail: "Fecha anterior no disponible", orderId: order.id, collection: order.wholesaleOpeningPaidArg! });
  }
  for (const receipt of account.receipts) {
    movements.push({ id: `receipt:${receipt.id}`, date: receipt.paidOn, label: "Entrega a cuenta",
      detail: `${receipt.paymentMethod}${receipt.note ? `, ${receipt.note}` : ""}`,
      collection: (account.currency === "ARS" ? receipt.sourceAmountMinor : receipt.amountMinor) / 100, receiptId: receipt.id,
      availableMinor: receiptAvailableMinor(account, receipt.id) });
  }
  for (const allocation of account.allocations) {
    const order = account.orders.find((entry) => entry.id === allocation.orderId || entry.wholesaleSaleId === allocation.orderId);
    movements.push({ id: `allocation:${allocation.id}`, date: allocation.allocatedAt.slice(0, 10),
      label: "Saldo aplicado a un pedido", detail: accountMoney(account, (account.currency === "ARS" ? allocation.sourceAmountMinor || 0 : allocation.amountMinor) / 100), orderId: order?.id });
  }
  for (const consignment of account.consignments) {
    const order = account.orders.find((entry) => entry.wholesaleSaleId === consignment.orderId);
    for (const line of (state.consignmentLines || []).filter((entry) => entry.consignmentId === consignment.id)) {
      for (const movement of (state.consignmentMovements || []).filter((entry) => entry.lineId === line.id && entry.kind === "kept")) {
        movements.push({ id: `consignment:${movement.id}`, date: movement.occurredOn,
          label: "Unidades conservadas de consignación", detail: `${line.title}, ${movement.quantity} u.`,
          orderId: order?.id, charge: movement.quantity * line.unitPriceMinor / 100 });
      }
    }
    for (const allocation of account.consignmentAllocations.filter((entry) => entry.consignmentId === consignment.id)) {
      movements.push({ id: `consignment-allocation:${allocation.id}`, date: allocation.allocatedAt.slice(0, 10),
        label: "Saldo aplicado a consignación", detail: order ? orderName(order) : "Consignación",
        orderId: order?.id });
    }
  }
  return movements;
}

/** Ordena del más viejo al más nuevo y calcula el saldo que va quedando después de cada movimiento. */
export function withRunningBalance(account: CustomerAccount, movements: Movement[]): MovementWithBalance[] {
  const orderDate = new Map(account.orders.map((order) => [order.id, order.date]));
  // Un cobro sin fecha se ubica en la fecha de su pedido; el mismo día, primero el cargo y después el cobro.
  const when = (movement: Movement) => movement.date || (movement.orderId && orderDate.get(movement.orderId)) || "";
  const rank = (movement: Movement) => movement.charge != null ? 0 : movement.collection != null ? 2 : 1;
  const sorted = [...movements].sort((a, b) => when(a).localeCompare(when(b)) || rank(a) - rank(b) || a.id.localeCompare(b.id));
  let balance = 0;
  return sorted.map((movement) => {
    balance = Math.round((balance + (movement.charge ?? 0) - (movement.collection ?? 0)) * 100) / 100;
    return { ...movement, balance };
  });
}
