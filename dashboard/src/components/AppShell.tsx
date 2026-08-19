import type { ElementType, ReactNode } from "react";
import {
  ArchiveIcon,
  ChartDonutIcon,
  CubeIcon,
  ListIcon,
  PlusCircleIcon,
  SignOutIcon,
  UserIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import type { ViewId } from "../types";

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
  onNavigate: (view: ViewId) => void;
  error?: string;
  currentUser?: string;
  onLogout?: () => void;
  children: ReactNode;
}

export function AppShell({
  activeView,
  onNavigate,
  error,
  currentUser,
  onLogout,
  children,
}: AppShellProps) {
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

        <nav className="side-menu" aria-label="Navegación principal">
          {navigation.map(({ id, label, icon: Icon }) => (
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
          ))}
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

      <main id="main-content" className={`main-content side-content side-content-${activeView}`}>
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
