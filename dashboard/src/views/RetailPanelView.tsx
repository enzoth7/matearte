import {
  ArrowRightIcon,
  MapPinIcon,
  ShoppingBagOpenIcon,
} from "@phosphor-icons/react";
import { commerceAdminUrl, localSalesUrl } from "../retailApps";

const retailAreas = [
  {
    title: "Ventas web",
    description: "Pedidos, catálogo, precios, descuentos y operaciones de la tienda online.",
    action: "Abrir ventas web",
    href: commerceAdminUrl,
    icon: ShoppingBagOpenIcon,
    tone: "web",
  },
  {
    title: "Ventas del local",
    description: "Registro de compras presenciales, clientes, productos y seguimiento de ventas.",
    action: "Abrir ventas del local",
    href: localSalesUrl,
    icon: MapPinIcon,
    tone: "local",
  },
] as const;

export function RetailPanelView() {
  return (
    <section className="retail-panel page-stack" aria-labelledby="retail-panel-title">
      <header className="page-header retail-panel-header">
        <div className="page-header-copy">
          <p className="retail-section-label">Panel minorista</p>
          <h1 id="retail-panel-title">Ventas minoristas</h1>
          <p>Elegí el canal que querés gestionar: la tienda web o las ventas presenciales del local.</p>
        </div>
      </header>

      <div className="retail-area-grid">
        {retailAreas.map(({ title, description, action, href, icon: Icon, tone }) => (
          <article className={`retail-area-card retail-area-card-${tone}`} key={title}>
            <div className="retail-area-icon" aria-hidden="true">
              <Icon size={30} weight="duotone" />
            </div>
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            <a href={href} aria-label={`${action} en el panel correspondiente`}>
              <span>{action}</span>
              <ArrowRightIcon size={20} weight="bold" aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
