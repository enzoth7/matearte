import { PaymentHistory } from "./modules";
import { Orders, type PageProps } from "./pages";
import { CustomerAccounts } from "./CustomerAccounts";

export function Receivables(props: PageProps) {
  const view = new URLSearchParams(window.location.search).get("vista");
  return <>
    <div className="tabs inner-tabs receivable-tabs" role="tablist" aria-label="Vista de cuentas por cobrar">
      <button type="button" role="tab" aria-selected={view !== "pedidos" && view !== "cobros"} className={view !== "pedidos" && view !== "cobros" ? "active" : ""} onClick={() => props.go("/finanzas/por-cobrar")}>Cuentas de clientes</button>
      <button type="button" role="tab" aria-selected={view === "pedidos"} className={view === "pedidos" ? "active" : ""} onClick={() => props.go("/finanzas/por-cobrar?vista=pedidos")}>Pedidos pendientes</button>
      <button type="button" role="tab" aria-selected={view === "cobros"} className={view === "cobros" ? "active" : ""} onClick={() => props.go("/finanzas/por-cobrar?vista=cobros")}>Cobros registrados</button>
    </div>
    {view === "cobros" ? <PaymentHistory s={props.s} go={props.go} /> : view === "pedidos" ? <Orders {...props} mode="por-cobrar" /> : <CustomerAccounts {...props} />}
  </>;
}
