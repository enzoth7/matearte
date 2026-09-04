import { useState, type RefObject } from "react";
import type { UserData } from "../types/user";
import type { FlejeCustomization, MateConfiguration } from "../types/customizer";
import { getVariantDefinition } from "../catalog/mateCatalog";
import { calculateOrderPricing } from "../catalog/pricingCatalog";
import { usePricing } from "../context/PricingContext";
import { ConfiguratorPreview } from "./ConfiguratorPreview";
import { FlatFlejePreview } from "./FlatFlejePreview";

interface SummaryStepProps {
  userData: UserData | null;
  configuration: MateConfiguration;
  flejeConfig: FlejeCustomization;
  previewRef?: RefObject<HTMLDivElement | null>;
  onEditDesign: () => void;
  onEditContact: () => void;
  onProceedToCheckout: () => void;
  onSaveDraft: () => void;
}

export function SummaryStep({
  userData,
  configuration,
  flejeConfig,
  previewRef,
  onEditDesign,
  onEditContact,
  onProceedToCheckout,
  onSaveDraft,
}: SummaryStepProps) {
  const { catalog: pricingCatalog } = usePricing();
  const [isDrafting, setIsDrafting] = useState(false);
  const variant = getVariantDefinition(configuration.variantId);
  if (!variant) return null;

  const pricing = calculateOrderPricing(configuration, flejeConfig, pricingCatalog);

  const saveDraft = () => {
    setIsDrafting(true);
    window.setTimeout(() => {
      setIsDrafting(false);
      onSaveDraft();
    }, 500);
  };

  return (
    <main id="main-content" className="summary-page">
      <section className="summary-gallery" ref={previewRef} aria-label="Vista final del mate personalizado">
        <div className="summary-gallery__product">
          {configuration.skuId ? (
            <img className="mate-product-photo" src={variant.image} alt={configuration.selectionLabels.texture} draggable={false} />
          ) : (
            <div className="summary-placeholder" role="img" aria-label="Imagen del producto pendiente">Imagen pendiente</div>
          )}
        </div>

        <div className={`summary-gallery__design ${configuration.capabilities.hasFleje ? "has-fleje" : ""}`}>
          <div className="summary-gallery__rim">
            <ConfiguratorPreview rim={configuration.rim} model={configuration.modelId} engravingTypeId={configuration.engravingTypeId} />
          </div>
          {configuration.capabilities.hasFleje && (
            <div className="summary-gallery__fleje">
              <FlatFlejePreview flejeConfig={flejeConfig} engravingTypeId={configuration.engravingTypeId} />
            </div>
          )}
          {!configuration.capabilities.hasFleje && (
            <p className="summary-gallery__design-label">Diseño de virola</p>
          )}
        </div>
      </section>

      <aside className="summary-checkout" aria-label="Resumen del pedido">
        <div className="summary-checkout__card">
          <div className="summary-checkout__content">
            <h1>Todo listo para hacerlo tuyo</h1>
            {pricing.breakdown ? (
              <>
                <dl>
                  {pricing.components.map((component) => (
                    <div key={component.ruleKey}>
                      <dt>{component.kind === "family" ? `Mate ${component.label}` : component.label}</dt>
                      <dd>$ {component.valueUYU.toLocaleString("es-UY")}</dd>
                    </div>
                  ))}
                  {pricing.items.map((item) => (
                    <div key={item.ruleKey}>
                      <dt>{item.label}{item.quantity > 1 ? ` (${item.quantity} × $ ${item.unitPriceUYU.toLocaleString("es-UY")})` : ""}</dt>
                      <dd>$ {item.totalUYU.toLocaleString("es-UY")}</dd>
                    </div>
                  ))}
                </dl>
                <div className="summary-checkout__total"><span>Total</span><strong>$ {pricing.totalUYU.toLocaleString("es-UY")}</strong></div>
                {!pricing.isPriceReady && <div className="summary-checkout__pending" role="alert"><strong>Faltan precios</strong><p>{pricing.missingRuleKeys.map((key) => key === "selection:engraving" ? "Tipo de grabado" : key.split(":").at(-1)?.replaceAll("_", " ")).join(", ")}.</p></div>}
                {!pricing.hasSku && <div className="summary-checkout__pending" role="alert"><strong>SKU pendiente</strong><p>El precio está completo, pero esta combinación todavía no puede comprarse.</p></div>}
              </>
            ) : (
              <div className="summary-checkout__pending" role="alert">
                <strong>Precio no disponible</strong>
                <p>Podés guardar esta configuración, pero el checkout permanecerá bloqueado hasta recuperar un catálogo publicado completo.</p>
              </div>
            )}
          </div>

          <div className="summary-checkout__actions">
            <button type="button" disabled={isDrafting} onClick={saveDraft} className="brand-button brand-button--muted summary-primary-action">{isDrafting ? "Guardando…" : "Guardar borrador"}</button>
            <button type="button" disabled={!pricing.isCheckoutReady} onClick={onProceedToCheckout} className="brand-button brand-button--primary summary-primary-action">Agregar al carrito</button>
          </div>
        </div>

        <button type="button" onClick={onEditDesign} className="brand-button brand-button--secondary summary-edit">Editar pedido</button>
        <button type="button" onClick={onEditContact} className="sr-only">Editar datos de {userData?.name ?? "cliente"}</button>
      </aside>
    </main>
  );
}
