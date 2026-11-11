import { useState } from "react";
import { balance, currencyMoney, money, orderName, paid, total, wholesaleBalanceOriginal, wholesalePaidOriginal, wholesaleTotalOriginal, type Order, type State } from "./data";
import { Modal } from "./ui";

export function ReceivablePaymentChooser({ orders, state, onChoose, onClose }: {
  orders: Order[];
  state: State;
  onChoose: (order: Order) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
  const shown = orders.filter((order) => {
    const customer = state.customers.find((entry) => entry.id === order.customerId)?.name || order.customerName || "";
    return `${orderName(order)} ${customer} ${order.channel}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").includes(normalized);
  });
  return <Modal title="Nuevo cobro" className="receivable-payment-chooser" onClose={onClose}>
    <label className="receivable-payment-search">Buscar cliente o pedido
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus />
    </label>
    <div className="receivable-payment-options">
      {shown.map((order) => {
        const customer = state.customers.find((entry) => entry.id === order.customerId)?.name || order.customerName || "Cliente sin nombre";
        const wholesaleMoney = (value: number) => currencyMoney(value, order.wholesaleCurrency || "ARS");
        const wholesaleTotal = wholesaleTotalOriginal(order);
        const wholesaleBalance = wholesaleBalanceOriginal(state, order);
        return <button type="button" className="receivable-payment-option" key={order.id} onClick={() => onChoose(order)}>
          <strong>{orderName(order)}: {customer}</strong>
          <small>{order.channel}, total {order.source === "wholesale" ? wholesaleTotal == null ? "por conciliar" : wholesaleMoney(wholesaleTotal) : money(total(order))}, {order.source === "wholesale" ? wholesaleBalance == null ? "saldo por conciliar" : `cobrado ${wholesaleMoney(wholesalePaidOriginal(state, order) || 0)}, falta ${wholesaleMoney(wholesaleBalance)}` : `cobrado ${money(paid(state, order))}, falta ${money(balance(state, order))}`}</small>
        </button>;
      })}
      {!shown.length && <div className="data-note">No hay pedidos pendientes que coincidan con la búsqueda.</div>}
    </div>
  </Modal>;
}
