import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { useAuth } from "./store/useAuth";
import { useDashboard } from "./store/useDashboard";
import type { PanelMode, ViewId } from "./types";
import { CustomersView } from "./views/CustomersView";
import { HistoryView } from "./views/HistoryView";
import { LoginView } from "./views/LoginView";
import { NewOrderView } from "./views/NewOrderView";
import { OverviewView } from "./views/OverviewView";
import { ProductionView } from "./views/ProductionView";
import { ProductsView } from "./views/ProductsView";
import { RetailPanelView } from "./views/RetailPanelView";

const validViews: ViewId[] = [
  "resumen",
  "nuevo",
  "clientes",
  "produccion",
  "historico",
  "productos",
];

const viewFromPathname = (): ViewId => {
  if (typeof window === "undefined") return "nuevo";
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  if (!path || path === "nuevo") return "nuevo";
  if (validViews.includes(path as ViewId)) return path as ViewId;
  return "nuevo";
};

const panelFromPathname = (): PanelMode =>
  typeof window !== "undefined" && window.location.pathname === "/minorista"
    ? "retail"
    : "wholesale";

export default function App() {
  const auth = useAuth();
  const [activeView, setActiveView] = useState<ViewId>(viewFromPathname);
  const [panelMode, setPanelMode] = useState<PanelMode>(panelFromPathname);
  const dashboard = useDashboard();

  useEffect(() => {
    const handlePopState = () => {
      setPanelMode(panelFromPathname());
      setActiveView(viewFromPathname());
      void dashboard.refresh();
    };

    window.addEventListener("popstate", handlePopState);

    // Backward compatibility: migrate old #view hashes to clean pathname URLs
    if (typeof window !== "undefined" && window.location.hash) {
      const hashView = window.location.hash.replace("#", "") as ViewId;
      if (validViews.includes(hashView)) {
        window.history.replaceState(null, "", `/${hashView}`);
        setActiveView(hashView);
      }
    }

    return () => window.removeEventListener("popstate", handlePopState);
  }, [dashboard.refresh]);

  const navigate = (view: ViewId) => {
    const targetPath = `/${view}`;
    if (view === activeView && window.location.pathname === targetPath) return;
    window.history.pushState(null, "", targetPath);
    setActiveView(view);
    void dashboard.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changePanel = (panel: PanelMode) => {
    if (panel === panelMode) return;
    const targetPath = panel === "retail" ? "/minorista" : `/${activeView}`;
    window.history.pushState(null, "", targetPath);
    setPanelMode(panel);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!auth.isAuthenticated) {
    return <LoginView onLogin={auth.login} />;
  }

  const content = (() => {
    switch (activeView) {
      case "nuevo":
        return (
          <NewOrderView
            data={dashboard.data}
            onAddOrder={dashboard.addOrder}
            onNavigate={navigate}
          />
        );
      case "clientes":
        return (
          <CustomersView
            data={dashboard.data}
            onAdd={dashboard.addCustomer}
            onRename={dashboard.renameCustomer}
          />
        );
      case "produccion":
        return (
          <ProductionView
            data={dashboard.data}
            onUpdate={dashboard.updateProduction}
            onComplete={dashboard.completeLine}
            onDelete={dashboard.deleteLine}
          />
        );
      case "historico":
        return <HistoryView data={dashboard.data} />;
      case "productos":
        return (
          <ProductsView
            data={dashboard.data}
            onAdd={dashboard.addProduct}
            onUpdate={dashboard.updateProduct}
            onUpdateExchangeRate={dashboard.updateExchangeRate}
          />
        );
      default:
        return <OverviewView data={dashboard.data} />;
    }
  })();

  return (
    <AppShell
      activeView={activeView}
      panelMode={panelMode}
      onPanelChange={changePanel}
      onNavigate={navigate}
      error={panelMode === "wholesale" ? dashboard.error : undefined}
      currentUser={auth.user?.username}
      onLogout={auth.logout}
    >
      {panelMode === "retail" ? (
        <RetailPanelView />
      ) : dashboard.loading ? (
        <div className="loading-screen">Cargando datos…</div>
      ) : (
        content
      )}
    </AppShell>
  );
}
