import { useEffect, useRef } from "react";
import {
  getMateFamily,
  getSelectedTexture,
  engravingTypeOptions,
  mateDecisionCatalog,
  mateSizeDecisionLabels,
  shouldAskForMetal,
  getEngravingCapabilities,
  type MateFamilyId,
  type MateSelection,
  type MateSelectionStage,
  type DecisionTextureOption,
} from "../catalog/mateDecisionCatalog";
import { getVariantDefinition, type MateSize } from "../catalog/mateCatalog";
import {
  getColorStartingPrice,
  getFamilyStartingPrice,
  getMetalStartingPrice,
  getTextureStartingPrice,
} from "../catalog/pricingCatalog";
import { usePricing } from "../context/PricingContext";
import { formatSelectionPrice } from "./selectionPriceUtils";

interface MateSelectionStepProps {
  stage: MateSelectionStage;
  selection: MateSelection;
  onChange: (selection: MateSelection) => void;
  onBack: () => void;
  onContinue: () => void;
}

const stageCopy: Record<MateSelectionStage, { title: string; help: string }> = {
  model: { title: "ELEGÍ TU MODELO DE MATE", help: "La silueta que más representa lo que querés" },
  texture: { title: "ELEGÍ SUS TEXTURAS", help: "Cueros, colores y terminaciones artesanales" },
  metal: { title: "SELECCIONÁ EL TIPO DE ALPACA", help: "Elegí el metal compatible con tu mate" },
  size: { title: "PENSÁ EL TAMAÑO DEL MATE", help: "Capacidad de yerba para tu día a día" },
  engraving: { title: "ELEGÍ EL GRABADO DE LA VIROLA", help: "La técnica se aplicará a la virola" },
  "fleje-engraving": { title: "ELEGÍ EL GRABADO DEL FLEJE", help: "La técnica se aplicará al fleje" },
};

const mateSizePreviewImages: Record<MateSize, { src: string; alt: string }> = {
  chico: {
    src: "/assets2/personalizacion/tamanos/boca-chico.png",
    alt: "Vista cenital de un mate camionero con boca chica",
  },
  medio: {
    src: "/assets2/personalizacion/tamanos/boca-medio.png",
    alt: "Vista cenital de un mate camionero con boca mediana",
  },
  grande: {
    src: "/assets2/personalizacion/tamanos/boca-grande.png",
    alt: "Vista cenital de un mate camionero con boca grande",
  },
};

function PendingLabel({ copy = "Precio pendiente" }: { copy?: string }) {
  return <span className="selection-pending">{copy}</span>;
}

function SelectionPrice({ value, pendingCopy = "Precio no disponible", from = false, isDelta = false }: { value: number | null; pendingCopy?: string; from?: boolean; isDelta?: boolean }) {
  return <PendingLabel copy={formatSelectionPrice(value, pendingCopy, from, isDelta)} />;
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
      <span className="selection-color-card__image selection-image--pending" role="img" aria-label={`${label}. Imagen pendiente`}>
        Imagen pendiente
      </span>
    );
  }

  return <img src={directImage ?? variant?.image} alt={`${texture.label} en color ${label}`} className="selection-color-card__image mate-product-photo" loading="lazy" draggable={false} />;
}

function MetalPreview({ image, label }: { image?: string; label: string }) {
  if (!image) {
    return (
      <span className="selection-image selection-image--pending" role="img" aria-label={`${label}. Imagen de alpaca pendiente`}>
        Imagen de alpaca pendiente
      </span>
    );
  }

  return <img src={image} alt={label} className="selection-image" loading="lazy" draggable={false} />;
}

export function MateSelectionStep({ stage, selection, onChange, onBack, onContinue }: MateSelectionStepProps) {
  const actionsRef = useRef<HTMLDivElement>(null);
  const { catalog: pricingCatalog, status: pricingStatus } = usePricing();
  const pendingPriceCopy = pricingStatus === "loading" ? "Cargando precio…" : "Precio no disponible";
  const selectedTexture = getSelectedTexture(selection);
  const baseStages: MateSelectionStage[] = shouldAskForMetal(selection)
    ? ["model", "texture", "metal", "size", "engraving"]
    : ["model", "texture", "size", "engraving"];
  const stages: MateSelectionStage[] = selectedTexture?.capabilities.hasFleje
    ? [...baseStages, "fleje-engraving"]
    : baseStages;

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
  const stageIndex = stages.indexOf(stage);
  const family = getMateFamily(selection.familyId);

  const copy = stageCopy[stage];
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
    <main id="main-content" className="selection-page">
      <header className="selection-heading">
        <h1>Contanos qué estás buscando</h1>
        <div className="selection-progress" aria-label={`Pregunta ${stageIndex + 1} de ${stages.length}`}>
          <span style={{ width: `${((stageIndex + 1) / stages.length) * 100}%` }} />
        </div>
        <h2 className="brand-section-label">{copy.title}</h2>
        <p>{copy.help}</p>
      </header>

      {stage === "model" && (
        <fieldset className="selection-model-grid">
          <legend className="sr-only">Tipo de mate</legend>
          {mateDecisionCatalog.map((item) => (
            <button key={item.id} type="button" onClick={() => chooseFamily(item.id)} aria-pressed={item.id === selection.familyId} className="selection-product-card">
              <span className="selection-product-card__title">{item.label}</span>
              <span className={`selection-model-card__image selection-model-card__image--${item.id}`}>
                <ProductImage variantId={item.representativeVariantId} alt={`Mate ${item.label}`} />
              </span>
              <span className="selection-product-card__description">{item.description}</span>
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
                <span className="selection-product-card__title">{item.label}</span>
                <span className={`selection-texture-card__image selection-texture-card__image--${item.id}`}>
                  <ProductImage variantId={item.representativeVariantId} alt={item.label} pending={item.status === "pending"} image={item.previewImage} />
                </span>
                <span className="selection-product-card__description">{item.description}</span>
                {item.status === "pending"
                  ? <PendingLabel copy="Datos pendientes" />
                  : <SelectionPrice value={getTextureStartingPrice(pricingCatalog, family.id, item.id)} pendingCopy={pendingPriceCopy} from />}
              </button>
            ))}
          </fieldset>

          {selectedTexture && (
            <fieldset className="selection-colors">
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
                    className="selection-color-card"
                  >
                    <span className="selection-color-card__title">
                      <span className="selection-color-swatch" style={{ background: item.swatch }} aria-hidden="true" />
                      {item.label}
                    </span>
                    <ColorPreview texture={selectedTexture} colorId={item.id} label={item.label} />
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
              <span className="selection-product-card__title">{item.label}</span>
              <MetalPreview image={item.previewImage} label={item.label} />
              <span className="selection-product-card__description">Muestra del material de {item.label.toLowerCase()}</span>
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
        <fieldset className="selection-size-list">
          <legend className="sr-only">Tamaño del mate</legend>
          {selectedTexture.sizes.map((size) => (
            <button key={size} type="button" onClick={() => onChange({ ...selection, sizeId: size, engravingTypeId: null, flejeEngravingTypeId: null })} aria-pressed={size === selection.sizeId}>
              <strong>{mateSizeDecisionLabels[size]}</strong>
              <img
                className="selection-size-list__image"
                src={mateSizePreviewImages[size].src}
                alt={mateSizePreviewImages[size].alt}
                width="240"
                height="240"
                loading="lazy"
                draggable={false}
              />
            </button>
          ))}
        </fieldset>
      )}

      {stage === "engraving" && (() => {
        const capabilities = getEngravingCapabilities(selection.familyId, selection.textureId);
        const filteredOptions = engravingTypeOptions.filter((option) => capabilities.virolaEngravingTypes.includes(option.id));
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
              <span className="selection-product-card__title">{option.label}</span>
              <img className="selection-image" src={option.image} alt={`Referencia de ${option.label}`} loading="lazy" draggable={false} />
              <span className="selection-product-card__description">{option.description}</span>
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
              <span className="selection-product-card__title">{option.label}</span>
              <img className="selection-image" src={option.flejeImage ?? option.image} alt={`Referencia de ${option.label} en el fleje`} loading="lazy" draggable={false} />
              <span className="selection-product-card__description">{option.description}</span>
            </button>
          ))}
        </fieldset>
        );
      })()}

      <div ref={actionsRef} className="selection-actions">
        <button type="button" onClick={onBack} className="brand-button">Atrás</button>
        <button type="button" disabled={!canContinue} onClick={onContinue} className="brand-button">
          Siguiente
        </button>
      </div>
    </main>
  );
}
