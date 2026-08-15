import type { ElementType, ReactNode } from "react";
import {
  ArchiveIcon,
  ChartDonutIcon,
  CubeIcon,
  ListIcon,
  PlusCircleIcon,
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
  children: ReactNode;
}

export function AppShell({ activeView, onNavigate, error, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>

      <aside className="side-navigation">
        <header className="side-brand">
          <img src="/logo-matearte.avif" alt="MateArte Arte y TradiciÃ³n" />
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
      </aside>

      <main id="main-content" className={`main-content side-content side-content-${activeView}`}>
        {error && <p className="global-error" role="alert">{error}</p>}
        {children}
      </main>
    </div>
  );
}
