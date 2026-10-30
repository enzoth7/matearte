import { useState } from "react";
import { PersonalizerCatalogView } from "./PersonalizerCatalogView";
import { PersonalizerPricingView } from "./PersonalizerPricingView";
import { PersonalizerIconsView } from "./PersonalizerIconsView";

export function PersonalizerConfiguratorView() {
  const [tab, setTab] = useState<"prices" | "models" | "techniques" | "icons">("prices");
  return (
    <div className="personalizer-configurator">
      <nav
        className="personalizer-configurator__tabs"
        aria-label="Configuración del Personalizador"
      >
        <button
          type="button"
          aria-current={tab === "prices" ? "page" : undefined}
          onClick={() => setTab("prices")}
        >
          Precios
        </button>
        <button type="button" aria-current={tab === "models" ? "page" : undefined} onClick={() => setTab("models")}>Modelos, colores y metales</button>
        <button type="button" aria-current={tab === "techniques" ? "page" : undefined} onClick={() => setTab("techniques")}>Técnicas de personalización</button>
        <button type="button" aria-current={tab === "icons" ? "page" : undefined} onClick={() => setTab("icons")}>Íconos</button>
      </nav>
      {tab === "icons" ? <PersonalizerIconsView /> : tab === "models" || tab === "techniques" ? (
        <PersonalizerCatalogView section={tab} />
      ) : (
        <PersonalizerPricingView />
      )}
    </div>
  );
}
