import { CommerceSection } from "./commerce/CommerceSection";
import { ChannelOrigin } from "./ChannelOrigin";
import { Links } from "./Links";
import { MarketingSection } from "./MarketingSection";
import { Purchases } from "./Purchases";
import { SorteoView } from "./SorteoView";
import "./commerce/operations.css";
import { useCallback, useEffect, useState } from "react";
import {
  House,
  Handshake,
  Megaphone,
  UsersThree,
  Package,
  Hammer,
  Warehouse,
  Truck,
  ChartLineUp,
  IdentificationCard,
  GearSix,
  List,
  X,
  MagnifyingGlass,
  Bell,
  UserSwitch,
  Leaf,
} from "@phosphor-icons/react";
import { areas, resolvePath } from "./navigation";
import { accessUserIds, canAccess, firstVisiblePath, visibleAreas } from "./access";
import { loadState, storageKey, seed, id, type State } from "./data";
import { collections } from "./collections";
import { Overview, Orders, Register, Customers, type PageProps } from "./pages";
import {
  CollectionPage,
  Products,
  Inventory,
  Finance,
} from "./modules";
import { People, Permissions } from "./people";
import { CommerceLogin, useCommerce } from "./useCommerce";
import { VisualizerConfiguratorView } from "./commerce/VisualizerConfiguratorView";
import { CommerceShipping } from "./CommerceShipping";
import { Card, Table, Badge, Modal } from "./ui";
import { formatDate } from "./dateFormat";
const icons = [
  House,
  Handshake,
  Megaphone,
  UsersThree,
  Package,
  Hammer,
  Warehouse,
  Truck,
  ChartLineUp,
  IdentificationCard,
  GearSix,
];
const retiredRoutes: Record<string, string> = {
  "/administracion/comercio": "/comercial/pedidos",
  "/comercial/registrar": "/comercial/registrar-min",
  "/productos/precios": "/productos/catalogo?vista=lista",
  "/productos/publicacion": "/productos/catalogo?vista=lista",
  "/produccion/configurador-visualizador": "/productos/personalizador",
  "/comercial/avisos": "/marketing/avisos",
  "/comercial/descuentos": "/marketing/descuentos",
  "/marketing/metricas": "/marketing/contactos",
};
const currentRoute = () => retiredRoutes[location.pathname] || (location.pathname === "/" ? "/inicio/resumen" : location.pathname + location.search);
function Content(
  props: PageProps & {
    path: string;
  },
) {
  const { path, s, go } = props;
  if (!resolvePath(path))
    return (
      <Card title="Dirección no encontrada">
        <button className="primary" onClick={() => go("/inicio/resumen")}>Ir al inicio</button>
      </Card>
    );
  if (!canAccess(s, path))
    return (
      <Card title="Esta sección no está habilitada para tu perfil">
        <button className="primary" onClick={() => go(firstVisiblePath(s))}>Ir al inicio</button>
      </Card>
    );
  const [area, page] = path.split("/").filter(Boolean);
  const key = `${area}/${page}`;
  if (["marketing/descuentos", "marketing/avisos", "productos/categorias", "productos/ajustes", "administracion/canales", "finanzas/monedas", "entregas/tarifas"].includes(key)) return <CommerceSection {...props} path={key} />;
  if (key === "marketing/sorteo") return <SorteoView />;
  if (area === "marketing") return <MarketingSection page={page} notify={props.notify} s={s} go={go} commerce={props.commerce} />;
  if (key === "inventario/compras") return <Purchases notify={props.notify} />;
  if (collections[key]) return <CollectionPage {...props} path={key} />;
  if (key === "inicio/resumen") return <Overview {...props} />;
  if (key === "inicio/alertas")
    return (
      <section className="alert-index" aria-label="Pendientes y alertas">
        {[
          {
            title: "Cobros pendientes",
            text: "Revisar pedidos con saldo por cobrar.",
            path: "/finanzas/por-cobrar",
          },
          {
            title: "Dise\u00F1os por aprobar",
            text: "Revisar los dise\u00F1os antes de comenzar el trabajo.",
            path: "/produccion/resumen",
          },
          {
            title: "Reposici\u00F3n de productos",
            text: "Existencias disponibles por debajo del m\u00EDnimo.",
            path: "/inventario/reposicion",
          },
          {
            title: "Pagos por realizar",
            text: "Compromisos y vencimientos registrados.",
            path: "/finanzas/por-pagar",
          },
        ].filter((a) => canAccess(s, a.path)).map((a) => (
          <button className="alert-index-row" key={a.path} onClick={() => go(a.path)}>
            <div><strong>{a.title}</strong><small>{a.text}</small></div>
            <div>Revisar</div>
          </button>
        ))}
      </section>
    );
  if (key === "comercial/registrar-min") return <Register {...props} kind="minorista" />;
  if (key === "comercial/registrar-may") return <Register {...props} kind="mayorista" />;
  if (key === "comercial/pedidos") return <Orders {...props} />;
  if (area === "clientes") return <Customers {...props} mode={page} />;
  if (key === "productos/personalizador") return <div className="commerce-tools"><VisualizerConfiguratorView /></div>;
  if (area === "productos") return <Products {...props} mode={page} />;
  if (area === "produccion")
    return (
      <Orders
        {...props}
        mode={page === "resumen" ? "resumen-produccion" : page}
      />
    );
  if (area === "inventario") return <Inventory {...props} mode={page} />;
  if (area === "entregas")
    return page === "tarifas" ? (
      <CommerceShipping snapshot={props.commerce} />
    ) : (
      <Orders {...props} mode={page} />
    );
  if (area === "finanzas")
    return page === "por-cobrar" ? (
      <Orders {...props} mode={page} />
    ) : (
      <Finance {...props} mode={page} />
    );
  if (area === "personal") return <People {...props} mode={page} />;
  if (key === "administracion/usuarios") return <Permissions {...props} />;
  if (key === "administracion/origen-canal") return <ChannelOrigin />;
  if (key === "administracion/links") return <Links />;
  if (key === "administracion/actividad")
    return (
      <Table
        rows={s.activity}
        searchText={(r) => Object.values(r).join(" ")}
        columns={[
          { label: "Momento", render: (r) => formatDate(String(r.fecha)) },
          { label: "Usuario", render: (r) => String(r.usuario) },
          { label: "Actividad", render: (r) => String(r.accion) },
        ]}
      />
    );
  return (
    <Card title="Dirección no encontrada">
      <button className="primary" onClick={() => go("/inicio/resumen")}>
        Ir al inicio
      </button>
    </Card>
  );
}
export default function App() {
  const live = useCommerce();
  const s = live.state;
  const setS = live.setState;
  const [path, setPath] = useState(() => currentRoute().split("?")[0]);
  const [revision, setRevision] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState("");
  const resolved = resolvePath(path);
  const allowedAreas = visibleAreas(s);
  const area = allowedAreas.find((entry) => entry.id === resolved?.area.id) ?? allowedAreas[0] ?? areas[0];
  const title = resolved && !canAccess(s, path)
    ? "Sin acceso"
    : resolved?.page[1] || "P\u00E1gina no encontrada";
  useEffect(() => {
    const pop = () => {
      const target = currentRoute();
      if (target !== location.pathname + location.search) history.replaceState(null, "", target);
      setPath(target.split("?")[0]);
      setRevision((r) => r + 1);
      setMobile(false);
    };
    addEventListener("popstate", pop);
    const target = currentRoute();
    if (target !== location.pathname + location.search) history.replaceState(null, "", target);
    return () => removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ access: s.access }));
      setStorageError("");
    } catch {
      setStorageError(
        "No se pudieron guardar las preferencias de navegación.",
      );
    }
  }, [s]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    document.title = `${title} · Matearte Gestión`;
  }, [title]);
  const go = (url: string) => {
    history.pushState(null, "", url);
    setPath(url.split("?")[0]);
    setRevision((r) => r + 1);
    setMobile(false);
    setSearch("");
    setUserMenu(false);
    window.scrollTo(0, 0);
  };
  const update = (recipe: (s: State) => State, message: string) => {
    const next = recipe(s);
    const business = ["products", "orders", "customers", "payments", "expenses", "hours", "records", "draft", "published", "employees"] as const;
    if (business.some((key) => next[key] !== s[key])) {
      setToast("Esta operación todavía no tiene guardado conectado. No se realizó ningún cambio.");
      return;
    }
    setS(next);
    setToast(message);
  };
  const operationNotice = useCallback((message: string) => { setToast(message); void live.refresh(); }, [live.refresh]);
  const props = { s, update, go, notify: operationNotice, commerce: live.snapshot, session: live.session, refresh: live.refresh };
  const matches = allowedAreas
    .flatMap((a) =>
      a.pages.map((p) => ({
        label: p[1],
        area: a.name,
        path: `/${a.id}/${p[0]}`,
      })),
    )
    .filter((p) =>
      `${p.label} ${p.area}`.toLowerCase().includes(search.toLowerCase()),
    );
  if (live.access !== "ready") return <CommerceLogin access={live.access} error={live.error} signOut={live.signOut} />;
  return (
    <>
      <a className="skip" href="#main">
        Saltar al contenido
      </a>
      {mobile && (
        <button
          className="mobile-overlay"
          aria-label="Cerrar navegación"
          onClick={() => setMobile(false)}
        />
      )}
      <nav
        className={`area-rail ${mobile ? "mobile-open" : ""}`}
        aria-label="Áreas"
      >
        <button
          className="brand-mark"
          aria-label="Matearte Inicio"
          onClick={() => go("/inicio/resumen")}
        >
          <img src="/matearte-icon.png" alt="Matearte" width="44" height="44" />
          <div>MateArte</div>
        </button>
        <div className="area-links">
          {allowedAreas.map((a) => {
            const Icon = icons[areas.findIndex((entry) => entry.id === a.id)];
            return (
              <a
                key={a.id}
                href={`/${a.id}/${a.pages[0][0]}`}
                aria-label={a.name}
                aria-current={area.id === a.id ? "true" : undefined}
                className={area.id === a.id ? "selected" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  go(e.currentTarget.getAttribute("href")!);
                }}
              >
                <Icon
                  size={23}
                  weight={area.id === a.id ? "fill" : "regular"}
                />
                <div>{a.name}</div>
              </a>
            );
          })}
        </div>
      </nav>
      <aside className={`subnav ${mobile ? "mobile-open" : ""}`}>
        
        <div className="subnav-title">{area.name}</div>
        <nav aria-label={`Subáreas de ${area.name}`}>
          {area.pages.filter(([slug]) => canAccess(s, `/${area.id}/${slug}`)).map(([slug, label]) => (
            <a
              key={slug}
              href={`/${area.id}/${slug}`}
              className={path === `/${area.id}/${slug}` ? "active" : ""}
              aria-current={path === `/${area.id}/${slug}` ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                go(e.currentTarget.getAttribute("href")!);
              }}
            >
              <div>{label}</div>
            </a>
          ))}
        </nav>
        
      </aside>
      <div className="app-content">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Abrir navegación"
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X size={23} /> : <List size={23} />}
          </button>
          <div className="global-search">
            <label>
              <MagnifyingGlass size={18} />
              <input
                aria-label="Buscar áreas y pantallas"
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearch("");
                }}
              />
            </label>
            {search && (
              <div className="search-results">
                {matches.map((m) => (
                  <button key={m.path} onClick={() => go(m.path)}>
                    <div>
                      {m.label}
                      <small>{m.area}</small>
                    </div>
                    
                  </button>
                ))}
                {!matches.length && <div className="empty">Sin resultados</div>}
              </div>
            )}
          </div>
          <div className="topbar-right">
            
            {canAccess(s, "/inicio/alertas") && (
              <button
                className="icon-button notification"
                aria-label="Ver pendientes y alertas"
                onClick={() => go("/inicio/alertas")}
              >
                <Bell size={21} />
              </button>
            )}
            <div className="user-control">
              <button
                className="user-button"
                aria-expanded={userMenu}
                aria-haspopup="true"
                onClick={() => setUserMenu(!userMenu)}
              >
                <strong>{s.user}</strong>
                
              </button>
              {userMenu && (
                <div className="user-menu">
                  <strong>{s.user}</strong>
                  <button
                    onClick={() => {
                      void live.signOut();
                      setUserMenu(false);
                    }}
                  >
                    <UsersThree size={20} />
                    Cambiar usuario
                  </button>
                  <button
                    onClick={() => {
                      void live.signOut();
                      setUserMenu(false);
                    }}
                  >
                    
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main" className={path === "/clientes/base" ? "customers-page" : undefined}>
          
          {storageError && (
            <div className="error" role="alert">
              {storageError}
            </div>
          )}
          {path !== "/inicio/resumen" && (
            <div className="page-title">
              
              <h1>{title}</h1>
              
            </div>
          )}
          {(s.activeUserId !== "t5" || !path.startsWith("/marketing/")) && <div className="source-status">
            <small>{live.loadedAt ? `Actualizado ${live.loadedAt.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}` : "Leyendo datos del comercio…"}</small>
            <button className="text-button" disabled={live.loading} onClick={() => void live.refresh()}>{live.loading ? "Actualizando…" : "Actualizar"}</button>
          </div>}
          {live.error && <div className="error" role="alert">{live.error}</div>}
          {live.snapshot || path === "/productos/personalizador" || path.startsWith("/marketing/")
            ? <Content key={`${path}:${revision}`} {...props} path={path} />
            : <div className="empty" role="status">{live.error ? "Los datos no se pudieron cargar." : "Cargando datos…"}</div>}
          
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}


    </>
  );
}
