import { useState } from "react";
import { PersonalizerCatalogView } from "./PersonalizerCatalogView";
import { PersonalizerPricingView } from "./PersonalizerPricingView";
import { PersonalizerIconsView } from "./PersonalizerIconsView";
import { PersonalizerFinishesView } from "./PersonalizerFinishesView";

export function PersonalizerConfiguratorView() {
  const [tab, setTab] = useState<"prices" | "models" | "techniques" | "icons" | "finishes">("prices");
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
        <button type="button" aria-current={tab === "finishes" ? "page" : undefined} onClick={() => setTab("finishes")}>Terminaciones</button>
      </nav>
      {tab === "icons" ? <PersonalizerIconsView /> : tab === "finishes" ? <PersonalizerFinishesView /> : tab === "models" || tab === "techniques" ? (
        <PersonalizerCatalogView section={tab} />
      ) : (
        <PersonalizerPricingView />
      )}
    </div>
  );
}
