import { Orders, type PageProps } from "./pages";
import { CustomerAccounts } from "./CustomerAccounts";

export function Receivables(props: PageProps) {
  const customer = new URLSearchParams(window.location.search).get("cliente");
  return <>
    <Orders {...props} mode="por-cobrar" />
    {customer && <CustomerAccounts {...props} detailOnly />}
  </>;
}
