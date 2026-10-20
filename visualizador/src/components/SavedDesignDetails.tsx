import type { SavedDesignItem } from "../types/user";
import type { PublishedPricingCatalog } from "../catalog/pricingCatalog";
import { calculateOrderPricing, formatUYU } from "../catalog/pricingCatalog";
import { getRimFinish } from "../catalog/rimFinishCatalog";
import { getFlejeFinish } from "../catalog/flejeFinishCatalog";
import { rimIconCatalog } from "../catalog/rimIconCatalog";

export function getSavedDesignPrice(design: SavedDesignItem, catalog: PublishedPricingCatalog | null) {
  const saved = design.configuration.pricingSnapshot;
  if (typeof saved?.totalUYU === "number" && Number.isFinite(saved.totalUYU)) return saved.totalUYU;
  return calculateOrderPricing(design.configuration, design.fleje_config, catalog).totalUYU;
}

function iconNames(icons: Array<{ selectedImageId: string | null; customImage: { name: string } | null }>) {
  return icons.map((icon) => icon.customImage?.name
    || rimIconCatalog.find((item) => item.id === icon.selectedImageId)?.name
    || icon.selectedImageId
    || "Imagen propia");
}

export function SavedDesignDetails({ design, catalog, onClose, onUseAsBase }: {
  design: SavedDesignItem;
  catalog: PublishedPricingCatalog | null;
  onClose: () => void;
  onUseAsBase: () => void;
}) {
  const { configuration, fleje_config: fleje } = design;
  const saved = configuration.pricingSnapshot;
  const current = calculateOrderPricing(configuration, fleje, catalog);
  const components = saved?.components ?? current.components;
  const items = saved?.items ?? current.items;
  const price = getSavedDesignPrice(design, catalog);
  const rim = configuration.rim;
  const structuredRimTexts = rim.texts?.map((item) => item.text).filter(Boolean) || [];
  const rimTexts = structuredRimTexts.length ? structuredRimTexts : rim.text ? [rim.text] : [];
  const rimIcons = iconNames(rim.icons || []);
  const flejeSides = (["front", "back"] as const).map((side) => ({ side, value: fleje.sides[side] }));

  return (
    <div className="brand-modal" role="dialog" aria-modal="true" aria-labelledby="saved-design-title" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <div className="saved-design-details">
        <h2 id="saved-design-title">Detalle de {design.title}</h2>
        <p className="saved-design-details__code">Diseño {design.design_code} · Enviado al carrito, pendiente de pago</p>

        <h3>Tu mate</h3>
        <dl className="saved-design-details__specs">
          {([
            ["Modelo", configuration.selectionLabels.family],
            ["Terminación", configuration.selectionLabels.texture],
            ["Color", configuration.selectionLabels.color],
            ["Virola", configuration.selectionLabels.metal],
            ["Tamaño", configuration.selectionLabels.size],
            ["Personalización", configuration.selectionLabels.engraving],
          ] as const).filter(([, value]) => Boolean(value)).map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>

        <h3>Diseño de virola</h3>
        <dl className="saved-design-details__specs">
          <div><dt>Terminación</dt><dd>{rim.finishMode === "finish" ? getRimFinish(rim.finishId)?.name || rim.finishId : "Sin terminación"}</dd></div>
          <div><dt>Palabras</dt><dd>{rimTexts.length ? rimTexts.join(" · ") : "Sin palabras"}</dd></div>
          <div><dt>Iconos</dt><dd>{rimIcons.length ? rimIcons.join(" · ") : "Sin iconos"}</dd></div>
        </dl>

        {configuration.capabilities.hasFleje && (
          <>
            <h3>Diseño de fleje</h3>
            <dl className="saved-design-details__specs">
              <div><dt>Terminación</dt><dd>{fleje.finishMode === "finish" ? getFlejeFinish(fleje.finishId)?.name || fleje.finishId : "Sin terminación"}</dd></div>
              {flejeSides.map(({ side, value }) => {
                const icons = iconNames(value.icons?.length ? value.icons : (value.selectedImageId || value.customImage) ? [{ selectedImageId: value.selectedImageId, customImage: value.customImage }] : []);
                return <div key={side}><dt>{side === "front" ? "Frente" : "Dorso"}</dt><dd>{[value.textMode === "text" && value.text ? `“${value.text}”` : "", ...icons].filter(Boolean).join(" · ") || "Sin personalización"}</dd></div>;
              })}
            </dl>
          </>
        )}

        <h3>Precio detallado</h3>
        <dl className="saved-design-details__prices">
          {components.map((component) => <div key={component.ruleKey}><dt>{component.kind === "family" ? `Mate ${component.label}` : component.label}</dt><dd>{formatUYU(component.valueUYU)}</dd></div>)}
          {items.map((item) => <div key={item.id}><dt>{item.label || item.id}{item.quantity > 1 ? ` (${item.quantity} × ${formatUYU(item.unitPriceUYU)})` : ""}</dt><dd>{formatUYU(item.totalUYU)}</dd></div>)}
          <div className="saved-design-details__total"><dt>Total del diseño</dt><dd>{formatUYU(price)}</dd></div>
        </dl>
        {saved && current.isPriceReady && current.totalUYU !== price && <p className="saved-design-details__notice">El precio vigente es {formatUYU(current.totalUYU)}. Revisá el importe en el carrito antes de pagar.</p>}
        <div className="brand-modal__actions">
          <button type="button" className="brand-button brand-button--secondary" onClick={onClose}>Cerrar</button>
          <button type="button" className="brand-button" onClick={onUseAsBase}>Usar como base para otro mate</button>
        </div>
      </div>
    </div>
  );
}
