import { useState } from "react";
import { VisualizerCatalogView } from "./VisualizerCatalogView";
import { VisualizerPricingView } from "./VisualizerPricingView";

export function VisualizerConfiguratorView() {
  const [tab, setTab] = useState<"prices" | "models" | "techniques">("prices");
  return (
    <div className="visualizer-configurator">
      <nav
        className="visualizer-configurator__tabs"
        aria-label="Configuración del Visualizador"
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
      </nav>
      {tab === "models" || tab === "techniques" ? (
        <VisualizerCatalogView section={tab} />
      ) : (
        <VisualizerPricingView />
      )}
    </div>
  );
}
