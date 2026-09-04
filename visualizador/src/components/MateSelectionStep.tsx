import { useEffect, useRef, type CSSProperties } from "react";
import {
  getMateFamily,
  getSelectedTexture,
  engravingTypeOptions,
  mateDecisionCatalog,
  getEngravingCapabilities,
  usesTorpedoVirolaEngravingAssets,
  type MateFamilyId,
  type MateSelection,
  type MateSelectionStage,
  type DecisionTextureOption,
} from "../catalog/mateDecisionCatalog";
import { getVariantDefinition, type MateSize } from "../catalog/mateCatalog";
import {
  getColorStartingPrice,
  getCustomizationPrice,
  getFamilyStartingPrice,
  getMetalStartingPrice,
  getSelectionPricing,
  getTextureStartingPrice,
} from "../catalog/pricingCatalog";
import { usePricing } from "../context/PricingContext";
import { getMateSizePreviewImage } from "./mateSizePreviewImages";
import { formatSelectionPrice } from "./selectionPriceUtils";

interface MateSelectionStepProps {
  stage: MateSelectionStage;
  selection: MateSelection;
  onChange: (selection: MateSelection) => void;
  onBack: () => void;
  onContinue: () => void;
}

const finalSelectionStageTitles: Record<"size" | "engraving" | "fleje-engraving", string> = {
  size: "¿Qué tamaño te queda mejor?",
  engraving: "Sumá un detalle en la virola",
  "fleje-engraving": "¿Querés personalizar también el fleje?",
};

const mateSizeDiameters: Record<MateSize, string> = {
  chico: "9,5 cm",
  medio: "10 cm",
  grande: "10,5 cm",
};

const mateSizeDisplayLabels: Record<MateSize, string> = {
  chico: "Boca chica",
  medio: "Boca mediana",
  grande: "Boca grande",
};

function PendingLabel({ copy = "Precio pendiente" }: { copy?: string }) {
  return <span className="selection-pending">{copy}</span>;
}

function SelectionPrice({ value, pendingCopy = "Precio no disponible", from = false, isDelta = false }: { value: number | null; pendingCopy?: string; from?: boolean; isDelta?: boolean }) {
  return <PendingLabel copy={formatSelectionPrice(value, pendingCopy, from, isDelta)} />;
}

function EngravingPrice({ value, isFlatFee, pendingCopy }: { value: number | null; isFlatFee: boolean; pendingCopy: string }) {
  const copy = value === null
    ? pendingCopy
    : `+ $ ${value.toLocaleString("es-UY")} ${isFlatFee ? "total" : "por letra"}`;
  return <PendingLabel copy={copy} />;
}

function ProductImage({ variantId, alt, pending = false, image }: { variantId: string; alt: string; pending?: boolean; image?: string }) {
  const variant = getVariantDefinition(variantId);
  if (!image && (!variant || pending)) {
    return <div className="selection-image selection-image--pending" role="img" aria-label={`${alt}. Imagen pendiente`}>Imagen pendiente</div>;
  }
  return <img src={image ?? variant?.image} alt={alt} className="selection-image mate-product-photo" loading="lazy" draggable={false} />;
}

function ColorPreview({ texture, colorId, label }: { texture: DecisionTextureOption; colorId: string; label: string }) {
  const directImage = texture.colorPreviewImages?.[colorId];
  const mappedVariantId = texture.legacyVariantByColor?.[colorId]
    ?? (texture.colors.length === 1 ? texture.legacyVariantId ?? texture.representativeVariantId : null);
  const variant = mappedVariantId ? getVariantDefinition(mappedVariantId) : null;

  if (!directImage && !variant) {
    return (
      <span className="selection-color-card__media selection-image--pending" role="img" aria-label={`${label}. Imagen pendiente`}>
        Imagen pendiente
      </span>
    );
  }

  return (
    <span className="selection-color-card__media">
      <img src={directImage ?? variant?.image} alt={`${texture.label} en color ${label}`} className="selection-color-card__image mate-product-photo" loading="lazy" draggable={false} />
    </span>
  );
}

function MetalPreview({ image, label, metalId }: { image?: string; label: string; metalId: string }) {
  if (!image) {
    return (
      <span className="selection-image selection-image--pending" role="img" aria-label={`${label}. Imagen de alpaca pendiente`}>
        Imagen de alpaca pendiente
      </span>
    );
  }

  return <img src={image} alt={label} className={`selection-image selection-image--metal-${metalId}`} loading="lazy" draggable={false} />;
}

export function MateSelectionStep({ stage, selection, onChange, onBack, onContinue }: MateSelectionStepProps) {
  const actionsRef = useRef<HTMLDivElement>(null);
  const { catalog: pricingCatalog, status: pricingStatus } = usePricing();
  const pendingPriceCopy = pricingStatus === "loading" ? "Cargando precio…" : "Precio no disponible";
  const selectedTexture = getSelectedTexture(selection);
  const showSizeDiameters = !usesTorpedoVirolaEngravingAssets(selection);
  useEffect(() => {
    const actions = actionsRef.current;
    const footer = document.querySelector<HTMLElement>(".brand-footer");
    if (!actions || !footer) return;

    let animationFrame = 0;
    const updateFooterOverlap = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const footerRect = footer.getBoundingClientRect();
        const visibleFooterHeight = Math.max(
          0,
          Math.min(window.innerHeight, footerRect.bottom) - Math.max(0, footerRect.top),
        );
        actions.style.setProperty("--selection-footer-overlap", `${visibleFooterHeight}px`);
      });
    };

    const resizeObserver = new ResizeObserver(updateFooterOverlap);
    resizeObserver.observe(footer);
    window.addEventListener("scroll", updateFooterOverlap, { passive: true });
    window.addEventListener("resize", updateFooterOverlap);
    updateFooterOverlap();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", updateFooterOverlap);
      window.removeEventListener("resize", updateFooterOverlap);
    };
  }, []);
  const family = getMateFamily(selection.familyId);
  const canContinue = stage === "model"
    ? Boolean(selection.familyId)
    : stage === "texture"
      ? Boolean(selection.textureId && selection.colorId)
      : stage === "metal"
        ? Boolean(selection.metalId)
        : stage === "size"
          ? Boolean(selection.sizeId)
          : stage === "fleje-engraving"
            ? Boolean(selection.flejeEngravingTypeId)
            : Boolean(selection.engravingTypeId);

  const chooseFamily = (familyId: MateFamilyId) => {
    onChange({ familyId, textureId: null, colorId: null, metalId: null, sizeId: null, engravingTypeId: null, flejeEngravingTypeId: null });
  };

  return (
    <main id="main-content" className="selection-page" data-stage={stage}>
      {stage === "model" ? (
        <header className="selection-heading selection-heading--model">
          <h1>Elegí el modelo que va con vos</h1>
        </header>
      ) : stage === "texture" || stage === "metal" ? (
        <header className={`selection-heading selection-heading--${stage}`}>
          <h1>{stage === "texture" ? "Dale carácter con textura y color" : "Elegí el metal de los detalles"}</h1>
        </header>
      ) : (
        <header className={`selection-heading selection-heading--${stage}`}>
          <h1>{finalSelectionStageTitles[stage]}</h1>
        </header>
      )}

      {stage === "model" && (
        <fieldset className="selection-model-grid">
          <legend className="sr-only">Tipo de mate</legend>
          {mateDecisionCatalog.map((item) => (
            <button key={item.id} type="button" onClick={() => chooseFamily(item.id)} aria-pressed={item.id === selection.familyId} className="selection-product-card">
              <span className={`selection-model-card__image selection-model-card__image--${item.id}`}>
                <ProductImage variantId={item.representativeVariantId} alt={`Mate ${item.label}`} />
              </span>
              <span className="selection-product-card__title">{item.label}</span>
              <span className="sr-only">{item.description}</span>
              <SelectionPrice value={getFamilyStartingPrice(pricingCatalog, item.id)} pendingCopy={pendingPriceCopy} from />
            </button>
          ))}
        </fieldset>
      )}

      {stage === "texture" && family && (
        <div className="selection-texture-layout">
          <fieldset className={`selection-texture-grid ${family.textures.length === 1 ? "selection-texture-grid--single" : ""} ${family.textures.length === 3 ? "selection-texture-grid--triple" : ""} ${family.textures.length > 4 ? "selection-texture-grid--dense" : ""}`}>
            <legend className="sr-only">Textura o construcción</legend>
            {family.textures.map((item) => (
              <button key={item.id} type="button" onClick={() => onChange({ ...selection, textureId: item.id, colorId: null, metalId: null, sizeId: null, engravingTypeId: null, flejeEngravingTypeId: null })} aria-pressed={item.id === selection.textureId} className={`selection-product-card selection-product-card--texture selection-product-card--${item.id}`}>
                <span className={`selection-texture-card__image selection-texture-card__image--${item.id}`}>
                  <ProductImage variantId={item.representativeVariantId} alt={item.label} pending={item.status === "pending"} image={item.previewImage} />
                </span>
                <span className="selection-product-card__title">{item.label}</span>
                <span className="sr-only">{item.description}</span>
                {item.status === "pending"
                  ? <PendingLabel copy="Datos pendientes" />
                  : <SelectionPrice value={getTextureStartingPrice(pricingCatalog, family.id, item.id)} pendingCopy={pendingPriceCopy} from />}
              </button>
            ))}
          </fieldset>

          {selectedTexture && (
            <fieldset
              className={`selection-colors selection-colors--family-${family.id} selection-colors--texture-${selectedTexture.id}`}
              style={{ "--selection-color-count": selectedTexture.colors.length } as CSSProperties}
            >
              <legend>Elegí el color</legend>
              <div>
                {selectedTexture.colors.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChange({
                      ...selection,
                      colorId: item.id,
                      metalId: selectedTexture.skipMetalSelection ? selectedTexture.metals[0]?.id ?? null : null,
                      sizeId: null,
                      engravingTypeId: null,
                      flejeEngravingTypeId: null,
                    })}
                    aria-pressed={item.id === selection.colorId}
                    className={`selection-color-card selection-color-card--${item.id}`}
                  >
                    <ColorPreview texture={selectedTexture} colorId={item.id} label={item.label} />
                    <span className="selection-color-card__title">
                      {item.label}
                    </span>
                    <SelectionPrice
                      value={getColorStartingPrice(pricingCatalog, { ...selection, colorId: item.id })}
                      pendingCopy={pendingPriceCopy}
                      from
                    />
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )}

      {stage === "metal" && selectedTexture && (
        <fieldset className={`selection-metal-grid ${selectedTexture.metals.length === 1 ? "selection-metal-grid--single" : ""} ${selectedTexture.metals.length === 2 ? "selection-metal-grid--double" : ""}`}>
          <legend className="sr-only">Tipo de alpaca o metal</legend>
          {selectedTexture.metals.map((item) => (
            <button key={item.id} type="button" onClick={() => onChange({ ...selection, metalId: item.id, sizeId: null, engravingTypeId: null, flejeEngravingTypeId: null })} aria-pressed={item.id === selection.metalId} className="selection-product-card">
              <MetalPreview image={item.previewImage} label={item.label} metalId={item.id} />
              <span className="selection-product-card__title">{item.label}</span>
              <span className="sr-only">Muestra del material de {item.label.toLowerCase()}</span>
              <SelectionPrice
                value={getMetalStartingPrice(pricingCatalog, { ...selection, metalId: item.id })}
                pendingCopy={pendingPriceCopy}
                from
              />
            </button>
          ))}
        </fieldset>
      )}

      {stage === "size" && selectedTexture && (
        <fieldset className={`selection-size-list ${showSizeDiameters ? "selection-size-list--with-diameters" : "selection-size-list--torpedo"}`}>
          <legend className="sr-only">Tamaño del mate</legend>
          {selectedTexture.sizes.map((size) => {
            const preview = getMateSizePreviewImage(selection, size);
            const pricing = getSelectionPricing(pricingCatalog, { ...selection, sizeId: size });
            return (
              <button key={size} type="button" onClick={() => onChange({ ...selection, sizeId: size, engravingTypeId: null, flejeEngravingTypeId: null })} aria-pressed={size === selection.sizeId}>
                <img
                  className={`selection-size-list__image ${usesTorpedoVirolaEngravingAssets(selection) ? `selection-size-list__image--torpedo-${size}` : ""}`}
                  src={preview.src}
                  alt={preview.alt}
                  width="240"
                  height="240"
                  loading="lazy"
                  draggable={false}
                />
                <strong>{mateSizeDisplayLabels[size]}</strong>
                {showSizeDiameters && (
                  <span className="selection-size-list__diameter">
                    Diámetro: {mateSizeDiameters[size]}
                  </span>
                )}
                <SelectionPrice
                  value={pricing?.isPriceReady ? pricing.breakdown.sizeDeltaUYU : null}
                  pendingCopy={pendingPriceCopy}
                  isDelta
                />
              </button>
            );
          })}
        </fieldset>
      )}

      {stage === "engraving" && (() => {
        const capabilities = getEngravingCapabilities(selection.familyId, selection.textureId);
        const filteredOptions = engravingTypeOptions.filter((option) => capabilities.virolaEngravingTypes.includes(option.id));
        const useTorpedoImages = usesTorpedoVirolaEngravingAssets(selection);
        return (
          <fieldset className={`selection-engraving-grid ${filteredOptions.length === 3 ? "selection-engraving-grid--triple" : ""}`}>
            <legend className="sr-only">Tipo de grabado para virola</legend>
            {filteredOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ ...selection, engravingTypeId: option.id })}
              aria-pressed={selection.engravingTypeId === option.id}
              className="selection-product-card selection-product-card--engraving"
            >
              <img
                className="selection-image"
                src={useTorpedoImages ? option.torpedoImage ?? option.image : option.image}
                alt={`Referencia de ${option.label}`}
                loading="lazy"
                draggable={false}
              />
              <span className="selection-product-card__title">{option.label}</span>
              <span className="selection-product-card__description sr-only">{option.description}</span>
              <EngravingPrice
                value={getCustomizationPrice(pricingCatalog, option.id, "rim_text")}
                isFlatFee={option.id === "laser"}
                pendingCopy={pendingPriceCopy}
              />
            </button>
          ))}
        </fieldset>
        );
      })()}

      {stage === "fleje-engraving" && (() => {
        const capabilities = getEngravingCapabilities(selection.familyId, selection.textureId);
        const filteredOptions = engravingTypeOptions.filter((option) => capabilities.flejeEngravingTypes.includes(option.id));
        return (
          <fieldset className={`selection-engraving-grid ${filteredOptions.length === 3 ? "selection-engraving-grid--triple" : ""}`}>
            <legend className="sr-only">Tipo de grabado para fleje</legend>
            {filteredOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ ...selection, flejeEngravingTypeId: option.id })}
              aria-pressed={selection.flejeEngravingTypeId === option.id}
              className="selection-product-card selection-product-card--engraving"
            >
              <img className="selection-image" src={option.flejeImage ?? option.image} alt={`Referencia de ${option.label} en el fleje`} loading="lazy" draggable={false} />
              <span className="selection-product-card__title">{option.label}</span>
              <span className="selection-product-card__description sr-only">{option.description}</span>
              <EngravingPrice
                value={getCustomizationPrice(pricingCatalog, option.id, "fleje_text")}
                isFlatFee={false}
                pendingCopy={pendingPriceCopy}
              />
            </button>
          ))}
        </fieldset>
        );
      })()}

      <div ref={actionsRef} className="selection-actions">
        <button type="button" onClick={onBack} className="brand-button">Atrás</button>
        <button type="button" disabled={!canContinue} onClick={onContinue} className="brand-button">
          {stage === "model" || stage === "texture" || stage === "metal" ? "Continuar" : "Siguiente"}
        </button>
      </div>
    </main>
  );
}
