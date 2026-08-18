import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { useDashboard } from "./store/useDashboard";
import type { ViewId } from "./types";
import { HistoryView } from "./views/HistoryView";
import { CustomersView } from "./views/CustomersView";
import { NewOrderView } from "./views/NewOrderView";
import { OverviewView } from "./views/OverviewView";
import { ProductsView } from "./views/ProductsView";
import { ProductionView } from "./views/ProductionView";

const validViews: ViewId[] = ["resumen", "nuevo", "clientes", "produccion", "historico", "productos"];

const viewFromHash = (): ViewId => {
  const hash = window.location.hash.replace("#", "") as ViewId;
  return validViews.includes(hash) ? hash : "nuevo";
};

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>(viewFromHash);
  const dashboard = useDashboard();

  useEffect(() => {
    const handleHashChange = () => setActiveView(viewFromHash());
    window.addEventListener("hashchange", handleHashChange);
    if (!window.location.hash) window.history.replaceState(null, "", "#nuevo");
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = (view: ViewId) => {
    if (view === activeView) return;
    window.location.hash = view;
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const content = (() => {
    switch (activeView) {
      case "nuevo":
        return <NewOrderView data={dashboard.data} onAddOrder={dashboard.addOrder} onNavigate={navigate} />;
      case "clientes":
        return <CustomersView data={dashboard.data} onAdd={dashboard.addCustomer} onRename={dashboard.renameCustomer} />;
      case "produccion":
        return (
          <ProductionView
            data={dashboard.data}
            onUpdate={dashboard.updateProduction}
            onComplete={dashboard.completeLine}
          />
        );
      case "historico":
        return <HistoryView data={dashboard.data} />;
      case "productos":
        return (
          <ProductsView
            data={dashboard.data}
            onUpdate={dashboard.updateProduct}
            onUpdateExchangeRate={dashboard.updateExchangeRate}
          />
        );
      default:
        return <OverviewView data={dashboard.data} />;
    }
  })();

  return (
    <AppShell activeView={activeView} onNavigate={navigate} error={dashboard.error}>
      {dashboard.loading ? <div className="loading-screen">Cargando datos…</div> : content}
    </AppShell>
  );
}
