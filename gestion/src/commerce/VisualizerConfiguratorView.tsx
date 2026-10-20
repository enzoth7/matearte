import { useState } from "react";
import { VisualizerCatalogView } from "./VisualizerCatalogView";
import { VisualizerPricingView } from "./VisualizerPricingView";

export function VisualizerConfiguratorView() {
  const [tab, setTab] = useState<"catalog" | "prices">("prices");
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
        <button
          type="button"
          aria-current={tab === "catalog" ? "page" : undefined}
          onClick={() => setTab("catalog")}
        >
          Modelos, colores e imágenes
        </button>
      </nav>
      {tab === "catalog" ? (
        <VisualizerCatalogView />
      ) : (
        <VisualizerPricingView />
      )}
    </div>
  );
}
