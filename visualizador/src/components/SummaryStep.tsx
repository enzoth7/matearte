import { useState, type RefObject } from "react";
import type { UserData } from "../types/user";
import type { FlejeCustomization, MateConfiguration } from "../types/customizer";
import { getVariantDefinition, mateSizeLabels } from "../catalog/mateCatalog";
import { getRimOption } from "../catalog/rimCatalog";
import { getRimFinish } from "../catalog/rimFinishCatalog";
import { getFlejeFinish } from "../catalog/flejeFinishCatalog";
import { rimIconCatalog } from "../catalog/rimIconCatalog";
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

function imageName(selectedImageId: string | null, customName?: string) {
  if (!selectedImageId) return null;
  return customName ?? rimIconCatalog.find((icon) => icon.id === selectedImageId)?.name ?? "Imagen personalizada";
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

  const rimMaterial = getRimOption(configuration.rim.rimId);
  const rimFinish = getRimFinish(configuration.rim.finishId);
  const flejeFinish = getFlejeFinish(flejeConfig.finishId);
  const pricing = calculateOrderPricing(configuration, flejeConfig, pricingCatalog);
  const rimImageName = configuration.rim.icons.map((icon) => imageName(icon.selectedImageId, icon.customImage?.name)).filter(Boolean).join(", ");

  const saveDraft = () => {
    setIsDrafting(true);
    window.setTimeout(() => {
      setIsDrafting(false);
      onSaveDraft();
    }, 500);
  };

  return (
    <main id="main-content" className="summary-page">
      <section className="summary-details" ref={previewRef}>
        <div className="summary-block">
          <h1 className="brand-panel-title">Mate elegido</h1>
          <div className="summary-mate brand-surface">
            {configuration.skuId ? (
              <img className="mate-product-photo" src={variant.image} alt={configuration.selectionLabels.texture} draggable={false} />
            ) : (
              <div className="summary-placeholder" role="img" aria-label="Imagen del producto pendiente">Imagen pendiente</div>
            )}
            <p>{configuration.selectionLabels.texture}</p>
          </div>
        </div>

        <div className="summary-block">
          <h2 className="brand-panel-title">Grabados en virola{configuration.capabilities.hasFleje ? " y fleje" : ""}</h2>
          <div className={`summary-previews brand-surface ${configuration.capabilities.hasFleje ? "has-fleje" : ""}`}>
            <ConfiguratorPreview rim={configuration.rim} model={configuration.modelId} engravingTypeId={configuration.engravingTypeId} />
            {configuration.capabilities.hasFleje && <FlatFlejePreview flejeConfig={flejeConfig} engravingTypeId={configuration.engravingTypeId} />}
          </div>
        </div>

        <div className="summary-block">
          <h2 className="brand-panel-title">Especificaciones</h2>
          <dl className="summary-specs brand-surface">
            <div><dt>Producto</dt><dd>{configuration.selectionLabels.texture}</dd></div>
            <div><dt>Color</dt><dd>{configuration.selectionLabels.color}</dd></div>
            <div><dt>Tamaño</dt><dd>{configuration.selectionLabels.size || mateSizeLabels[configuration.size]}</dd></div>
            <div><dt>Tipo de grabado</dt><dd>{configuration.selectionLabels.engraving}</dd></div>
            <div><dt>Virola</dt><dd>{configuration.selectionLabels.metal || rimMaterial?.name || "Original del producto"}</dd></div>
            <div><dt>Terminación de virola</dt><dd>{configuration.rim.finishMode === "finish" ? rimFinish?.name : "Sin terminación"}</dd></div>
            {configuration.rim.textMode === "text" && <div><dt>Texto de virola</dt><dd>{configuration.rim.texts.filter((item) => item.text.trim()).map((item) => item.text).join(" · ") || "Sin texto"}</dd></div>}
            {rimImageName && <div><dt>Imagen de virola</dt><dd>{rimImageName}</dd></div>}
            {configuration.capabilities.hasFleje && <div><dt>Fleje</dt><dd>{flejeConfig.finishMode === "finish" ? flejeFinish?.name : "Liso"}</dd></div>}
          </dl>
        </div>

        <button type="button" onClick={onEditDesign} className="brand-button brand-button--secondary summary-edit">Editar pedido</button>
      </section>

      <aside className="summary-checkout">
        <div className="summary-checkout__card">
          <h2>Checkout</h2>
          {pricing.breakdown ? (
            <>
              <dl>
                {pricing.components.map((component) => (
                  <div key={component.ruleKey}>
                    <dt>{component.kind === "family" ? `Mate ${component.label}` : component.label}</dt>
                    <dd>$ {component.valueUYU.toLocaleString("es-UY")}</dd>
                  </div>
                ))}
                {pricing.items.map((item) => <div key={item.ruleKey}><dt>{item.label} ({item.quantity} × $ {item.unitPriceUYU.toLocaleString("es-UY")})</dt><dd>$ {item.totalUYU.toLocaleString("es-UY")}</dd></div>)}
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

        <button type="button" disabled={!pricing.isCheckoutReady} onClick={onProceedToCheckout} className="brand-button brand-button--success summary-primary-action">Agregar al carrito</button>
        <button type="button" disabled={isDrafting} onClick={saveDraft} className="brand-button brand-button--secondary summary-primary-action">{isDrafting ? "Guardando…" : "Guardar en borrador"}</button>
        <button type="button" onClick={onEditContact} className="sr-only">Editar datos de {userData?.name ?? "cliente"}</button>
      </aside>
    </main>
  );
}
