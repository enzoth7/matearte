import { useState } from "react";
import { arsMoney, money, orderName, paid, wholesalePaidArs, type State } from "./data";
import { accountMoney, accountOrderBalance, accountOrderTotal, customerAccounts, receiptAvailableMinor, type CustomerAccount } from "./customerAccountModel";
import { CustomerAccountAllocationForm, CustomerAccountReceiptForm, FiadoSaleForm } from "./CustomerAccountForms";
import type { PageProps } from "./pages";
import { Badge, Modal, Stats, Table } from "./ui";
import { formatDate } from "./dateFormat";
import { consignmentSummary } from "./consignmentModel";

type AccountFilter = "saldo" | "mayoristas" | "senas" | "fiados" | "favor" | "todos";
type Movement = {
  id: string; date: string; label: string; detail: string; orderId?: string;
  charge?: number; collection?: number; receiptId?: string; availableMinor?: number;
};

function accountMovements(account: CustomerAccount, state: State): Movement[] {
  const orderIds = new Set(account.orders.map((order) => order.id));
  const movements: Movement[] = account.orders.map((order) => ({
    id: `order:${order.id}`, date: order.date, label: order.source === "wholesale" ? "Pedido mayorista" : order.paymentMethod === "Cuenta corriente" ? "Venta fiada" : order.depositAmount != null ? "Pedido con seña" : "Venta local",
    detail: orderName(order), orderId: order.id, charge: accountOrderTotal(order) ?? undefined,
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
          orderId: order?.id, charge: movement.quantity * line.unitPriceArgMinor / 100 });
      }
    }
    for (const allocation of account.consignmentAllocations.filter((entry) => entry.consignmentId === consignment.id)) {
      movements.push({ id: `consignment-allocation:${allocation.id}`, date: allocation.allocatedAt.slice(0, 10),
        label: "Saldo aplicado a consignación", detail: order ? orderName(order) : "Consignación",
        orderId: order?.id });
    }
  }
  return movements.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

function accountKind(account: CustomerAccount): string {
  const kinds = [account.wholesalePending > 0 && "Mayorista", account.depositPending > 0 && "Con seña",
    account.creditSalePending > 0 && "Fiado", account.otherPending > 0 && "Minorista"].filter(Boolean);
  return kinds.length ? kinds.join(", ") : account.unknownOrders > 0 ? "Por conciliar" : account.credit > 0 ? "A favor" : "Sin saldo";
}

function AccountDetail({ account, props, onClose }: { account: CustomerAccount; props: PageProps; onClose: () => void }) {
  const { s, go } = props;
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [allocationReceiptId, setAllocationReceiptId] = useState<string | null>(null);
  const [fiadoOpen, setFiadoOpen] = useState(false);
  const openOrders = account.orders.filter((order) => (accountOrderBalance(s, order) ?? 1) > 0);
  const movements = accountMovements(account, s);
  const net = account.pending - account.credit;
  const changed = async () => { await props.refresh?.(true); setReceiptOpen(false); setAllocationReceiptId(null); setFiadoOpen(false); };
  return <Modal title={`Cuenta de ${account.customer.name} en ${account.currency}`} className="customer-account-detail-modal" onClose={onClose}>
    <Stats items={[
      { label: "Saldo de pedidos", value: accountMoney(account, account.pending), tone: account.pending > 0 ? "yellow" : undefined },
      { label: "A favor sin asignar", value: accountMoney(account, account.credit), tone: account.credit > 0 ? "green" : undefined },
      { label: net >= 0 ? "Saldo neto" : "A favor neto", value: accountMoney(account, Math.abs(net)), tone: net < 0 ? "green" : undefined },
    ]} />
    {account.unknownOrders > 0 && <div className="data-note">Hay {account.unknownOrders} pedido{account.unknownOrders === 1 ? "" : "s"} mayorista{account.unknownOrders === 1 ? "" : "s"} con precio o cobros anteriores por conciliar. No están incluidos en estos saldos.</div>}
    <div className="form-actions customer-account-actions">
      <button type="button" className="primary" onClick={() => setReceiptOpen(true)}>Registrar entrega</button>
      {account.currency === "UYU" && account.customer.localCustomerId && <button type="button" className="secondary" onClick={() => setFiadoOpen(true)}>Registrar venta fiada</button>}
      <button type="button" className="secondary" onClick={() => go(`/clientes/base?cliente=${encodeURIComponent(account.customer.id)}`)}>Ver ficha del cliente</button>
    </div>
    <Table title="Pedidos pendientes" className="customer-account-detail-table" rows={openOrders} pageSize={20} searchText={(order) => orderName(order)} columns={[
      { label: "Pedido", render: (order) => <button type="button" className="text-button" onClick={() => go(`/comercial/pedidos?pedido=${encodeURIComponent(order.id)}`)}>{orderName(order)}</button> },
      { label: "Fecha", render: (order) => formatDate(order.date) },
      { label: "Tipo", render: (order) => order.source === "wholesale" ? "Mayorista" : order.paymentMethod === "Cuenta corriente" ? "Fiado" : order.depositAmount != null ? "Con seña" : "Minorista" },
      { label: "Importe", render: (order) => accountOrderTotal(order) == null ? "Por conciliar" : accountMoney(account, accountOrderTotal(order)!) },
      { label: "Cobrado", render: (order) => accountOrderBalance(s, order) == null ? "Por conciliar" : accountMoney(account, order.source === "wholesale" ? wholesalePaidArs(s, order) || 0 : paid(s, order)) },
      { label: "Falta", render: (order) => accountOrderBalance(s, order) == null ? "Por conciliar" : <strong>{accountMoney(account, accountOrderBalance(s, order)!)}</strong> },
    ]} />
    {account.consignments.length > 0 && <Table title="Consignaciones" className="customer-account-detail-table" rows={account.consignments.map((consignment) => ({ ...consignment, ...consignmentSummary(s, consignment) }))} pageSize={20} searchText={(consignment) => consignment.id} columns={[
      { label: "Consignación", render: (consignment) => <button type="button" className="text-button" onClick={() => go(`/finanzas/consignaciones?consignacion=${encodeURIComponent(consignment.id)}`)}>Ver detalle</button> },
      { label: "Enviadas", render: (consignment) => consignment.dispatched },
      { label: "En poder", render: (consignment) => consignment.held },
      { label: "Devueltas", render: (consignment) => consignment.returned },
      { label: "Se queda", render: (consignment) => consignment.kept },
      { label: "Confirmado", render: (consignment) => arsMoney(consignment.confirmedArgMinor / 100) },
      { label: "Saldo", render: (consignment) => arsMoney(consignment.balanceArgMinor / 100) },
    ]} />}
    <Table title="Movimientos de la cuenta" className="customer-account-detail-table" rows={movements} pageSize={30} searchText={(movement) => `${movement.label} ${movement.detail} ${movement.orderId || ""}`} columns={[
      { label: "Fecha", render: (movement) => movement.date ? formatDate(movement.date) : "Anterior" },
      { label: "Movimiento", render: (movement) => <div className="account-movement-label"><strong>{movement.label}</strong><small>{movement.detail}</small></div> },
      { label: "Pedido", render: (movement) => movement.orderId ? orderName(account.orders.find((order) => order.id === movement.orderId)!) : "A cuenta" },
      { label: "Cargo", render: (movement) => movement.charge != null ? accountMoney(account, movement.charge) : "—" },
      { label: "Entrega", render: (movement) => movement.collection != null ? accountMoney(account, movement.collection) : "—" },
      { label: "Disponible", render: (movement) => movement.receiptId ? <div className="account-credit-action"><strong>{accountMoney(account, (movement.availableMinor || 0) / 100)}</strong>{(movement.availableMinor || 0) > 0 && <button type="button" className="secondary" onClick={() => setAllocationReceiptId(movement.receiptId!)}>Asignar</button>}</div> : "—" },
    ]} />
    {receiptOpen && <CustomerAccountReceiptForm account={account} rate={props.commerce?.wholesale?.exchangeRate || 0} onClose={() => setReceiptOpen(false)} onChanged={changed} />}
    {allocationReceiptId && <CustomerAccountAllocationForm account={account} receiptId={allocationReceiptId} state={s} onClose={() => setAllocationReceiptId(null)} onChanged={changed} />}
    {fiadoOpen && <FiadoSaleForm customer={account.customer} state={s} onClose={() => setFiadoOpen(false)} onChanged={changed} />}
  </Modal>;
}

export function CustomerAccounts(props: PageProps & { detailOnly?: boolean }) {
  const { s } = props;
  const accounts = customerAccounts(s);
  const [filter, setFilter] = useState<AccountFilter>("saldo");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("cliente"));
  const [choosingCredit, setChoosingCredit] = useState(false);
  const [query, setQuery] = useState("");
  const [quickCreditContactId, setQuickCreditContactId] = useState<string | null>(null);
  const selected = accounts.find((account) => account.id === selectedContactId || account.contactId === selectedContactId);
  const quickCredit = accounts.find((account) => account.id === quickCreditContactId);
  const filtered = accounts.filter((account) => filter === "todos" || filter === "saldo" && (account.pending > 0 || account.unknownOrders > 0)
    || filter === "mayoristas" && account.currency === "ARS"
    || filter === "senas" && account.depositPending > 0 || filter === "fiados" && account.creditSalePending > 0
    || filter === "favor" && account.credit > 0);
  const matching = accounts.filter((account) => `${account.customer.name} ${account.customer.email} ${account.customer.phone}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"))).slice(0, 30);
  const totalPendingArs = accounts.filter((account) => account.currency === "ARS").reduce((sum, account) => sum + account.pending, 0);
  const totalPendingUyu = accounts.filter((account) => account.currency === "UYU").reduce((sum, account) => sum + account.pending, 0);
  const totalCreditArs = accounts.filter((account) => account.currency === "ARS").reduce((sum, account) => sum + account.credit, 0);
  const totalCreditUyu = accounts.filter((account) => account.currency === "UYU").reduce((sum, account) => sum + account.credit, 0);
  if (props.detailOnly) return selected
    ? <AccountDetail account={selected} props={props} onClose={() => props.go("/finanzas/por-cobrar")} />
    : null;
  return <>
    <Stats items={[
      { label: "Saldo mayorista", value: arsMoney(totalPendingArs), tone: "yellow" },
      { label: "Saldo local", value: money(totalPendingUyu), tone: "yellow" },
      { label: "A favor ARS", value: arsMoney(totalCreditArs), tone: "green" },
      { label: "A favor UYU", value: money(totalCreditUyu), tone: "green" },
      { label: "Clientes con saldo", value: new Set(accounts.filter((account) => account.pending > 0 || account.unknownOrders > 0).map((account) => account.contactId)).size },
    ]} />
    <div className="tabs inner-tabs customer-account-filters" role="tablist" aria-label="Filtrar cuentas de clientes">
      {([ ["saldo", "Con saldo"], ["mayoristas", "Mayoristas"], ["senas", "Con seña"], ["fiados", "Fiados"], ["favor", "A favor"], ["todos", "Todos"] ] as [AccountFilter, string][]).map(([key, label]) =>
        <button type="button" role="tab" aria-selected={filter === key} className={filter === key ? "active" : ""} key={key} onClick={() => setFilter(key)}>{label}</button>)}
    </div>
    <Table title="Cuentas de clientes" className="customer-accounts-table" rows={filtered} pageSize={50} searchText={(account) => `${account.customer.name} ${account.customer.email} ${account.customer.phone} ${accountKind(account)}`} action={<button type="button" className="primary" onClick={() => setChoosingCredit(true)}>Nueva entrega a cuenta</button>} columns={[
      { label: "Cliente", render: (account) => <strong>{account.customer.name}</strong> },
      { label: "Moneda", render: (account) => account.currency },
      { label: "Tipo", render: (account) => <Badge>{accountKind(account)}</Badge> },
      { label: "Pedidos", render: (account) => account.orders.length },
      { label: "Saldo de pedidos", render: (account) => account.unknownOrders > 0 ? <div><strong>{accountMoney(account, account.pending)}</strong><small>{account.unknownOrders} por conciliar</small></div> : accountMoney(account, account.pending) },
      { label: "A favor", render: (account) => accountMoney(account, account.credit) },
      { label: "Detalles", render: (account) => <button type="button" className="secondary" onClick={() => setSelectedContactId(account.id)}>Ver cuenta</button> },
    ]} />
    {choosingCredit && <Modal title="Nueva entrega a cuenta" className="customer-account-chooser" onClose={() => setChoosingCredit(false)}>
      <label>Buscar cliente<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus /></label>
      <div className="customer-account-choices">{matching.map((account) => <button type="button" key={account.id} onClick={() => { setQuickCreditContactId(account.id); setChoosingCredit(false); }}><strong>{account.customer.name}: {account.currency}</strong><small>{account.customer.email || account.customer.phone || "Cliente registrado"}</small></button>)}</div>
      {!matching.length && <div className="data-note">No encontramos un cliente con ese nombre o contacto.</div>}
    </Modal>}
    {quickCredit && <CustomerAccountReceiptForm account={quickCredit} rate={props.commerce?.wholesale?.exchangeRate || 0} onClose={() => setQuickCreditContactId(null)} onChanged={async () => { await props.refresh?.(true); setQuickCreditContactId(null); }} />}
    {selected && <AccountDetail account={selected} props={props} onClose={() => setSelectedContactId(null)} />}
  </>;
}
