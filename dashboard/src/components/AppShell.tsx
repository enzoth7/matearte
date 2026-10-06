import type { ElementType, ReactNode } from "react";
import {
  ArchiveIcon,
  CaretDownIcon,
  ChartDonutIcon,
  CubeIcon,
  ListIcon,
  PlusCircleIcon,
  ShoppingBagOpenIcon,
  SignOutIcon,
  UserIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import type { PanelMode, ViewId } from "../types";

const navigation: Array<{ id: ViewId; label: string; icon: ElementType }> = [
  { id: "nuevo", label: "NUEVO PEDIDO", icon: PlusCircleIcon },
  { id: "resumen", label: "Resumen", icon: ChartDonutIcon },
  { id: "clientes", label: "Clientes", icon: UsersThreeIcon },
  { id: "produccion", label: "Producción", icon: CubeIcon },
  { id: "productos", label: "Productos", icon: ListIcon },
  { id: "historico", label: "Resumen histórico", icon: ArchiveIcon },
];

interface AppShellProps {
  activeView: ViewId;
  panelMode: PanelMode;
  onPanelChange: (panel: PanelMode) => void;
  onNavigate: (view: ViewId) => void;
  error?: string;
  currentUser?: string;
  onLogout?: () => void;
  children: ReactNode;
}

export function AppShell({
  activeView,
  panelMode,
  onPanelChange,
  onNavigate,
  error,
  currentUser,
  onLogout,
  children,
}: AppShellProps) {
  const PanelIcon = panelMode === "wholesale" ? CubeIcon : ShoppingBagOpenIcon;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>

      <aside className="side-navigation">
        <header className="side-brand">
          <img src="/logo-matearte.avif" alt="MateArte Arte y Tradición" />
          <strong>MateArte</strong>
          <small>Operaciones</small>
        </header>

        <label className="panel-switcher">
          <span className="panel-switcher-label">Panel</span>
          <span className="panel-switcher-control" aria-hidden="true">
            <PanelIcon size={19} weight="duotone" />
            <strong>{panelMode === "wholesale" ? "Mayorista" : "Minorista"}</strong>
            <CaretDownIcon size={15} weight="bold" />
          </span>
          <select
            aria-label="Panel de trabajo"
            value={panelMode}
            onChange={(event) => onPanelChange(event.target.value as PanelMode)}
          >
            <option value="wholesale">Mayorista</option>
            <option value="retail">Minorista</option>
          </select>
        </label>

        <nav className="side-menu" aria-label="Navegación principal">
          {panelMode === "wholesale" ? navigation.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                className={activeView === id ? "side-nav-item is-active" : "side-nav-item"}
                aria-current={activeView === id ? "page" : undefined}
                aria-label={label}
                title={label}
                onClick={() => onNavigate(id)}
              >
                <Icon size={21} weight={activeView === id ? "fill" : "regular"} aria-hidden="true" />
                <strong>{label}</strong>
              </button>
            )) : (
              <a className="side-nav-item retail-nav-item is-active" href="/minorista" aria-current="page" title="Producción minorista">
                <CubeIcon size={21} weight="fill" aria-hidden="true" />
                <strong>Producción</strong>
              </a>
            )}
        </nav>

        <footer className="side-footer">
          {currentUser && (
            <div className="side-user-info" title={`Sesión: ${currentUser}`}>
              <UserIcon size={18} weight="bold" aria-hidden="true" />
              <strong className="side-user-name">{currentUser}</strong>
            </div>
          )}
          {onLogout && (
            <button
              type="button"
              className="side-logout-btn"
              onClick={onLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <SignOutIcon size={20} aria-hidden="true" />
              <strong>Cerrar sesión</strong>
            </button>
          )}
        </footer>
      </aside>

      <main id="main-content" className={`main-content side-content side-content-${panelMode === "retail" ? "minorista" : activeView}`}>
        {error && (
          <p className="global-error" role="alert">
            {error}
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
