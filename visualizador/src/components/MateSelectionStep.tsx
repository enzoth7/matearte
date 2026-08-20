import {
  getMateFamily,
  getSelectedTexture,
  mateDecisionCatalog,
  mateSizeDecisionLabels,
  shouldAskForMetal,
  type MateFamilyId,
  type MateSelection,
  type MateSelectionStage,
  type DecisionTextureOption,
} from "../catalog/mateDecisionCatalog";
import { getVariantDefinition } from "../catalog/mateCatalog";

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
};

function PendingLabel({ copy = "Precio pendiente" }: { copy?: string }) {
  return <span className="selection-pending">{copy}</span>;
}

function ProductImage({ variantId, alt, pending = false }: { variantId: string; alt: string; pending?: boolean }) {
  const variant = getVariantDefinition(variantId);
  if (!variant || pending) {
    return <div className="selection-image selection-image--pending" role="img" aria-label={`${alt}. Imagen pendiente`}>Imagen pendiente</div>;
  }
  return <img src={variant.image} alt={alt} className="selection-image" loading="lazy" draggable={false} />;
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

  return <img src={directImage ?? variant?.image} alt={`${texture.label} en color ${label}`} className="selection-color-card__image" loading="lazy" draggable={false} />;
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
  const stages: MateSelectionStage[] = shouldAskForMetal(selection)
    ? ["model", "texture", "metal", "size"]
    : ["model", "texture", "size"];
  const stageIndex = stages.indexOf(stage);
  const family = getMateFamily(selection.familyId);
  const selectedTexture = getSelectedTexture(selection);
  const copy = stageCopy[stage];
  const canContinue = stage === "model"
    ? Boolean(selection.familyId)
    : stage === "texture"
      ? Boolean(selection.textureId && selection.colorId)
      : stage === "metal"
        ? Boolean(selection.metalId)
        : Boolean(selection.sizeId);

  const chooseFamily = (familyId: MateFamilyId) => {
    onChange({ familyId, textureId: null, colorId: null, metalId: null, sizeId: null });
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
              <ProductImage variantId={item.representativeVariantId} alt={`Mate ${item.label}`} />
              <span className="selection-product-card__description">{item.description}</span>
              <PendingLabel />
            </button>
          ))}
        </fieldset>
      )}

      {stage === "texture" && family && (
        <div className="selection-texture-layout">
          <fieldset className={`selection-texture-grid ${family.textures.length === 1 ? "selection-texture-grid--single" : ""} ${family.textures.length > 4 ? "selection-texture-grid--dense" : ""}`}>
            <legend className="sr-only">Textura o construcción</legend>
            {family.textures.map((item) => (
              <button key={item.id} type="button" onClick={() => onChange({ ...selection, textureId: item.id, colorId: null, metalId: null, sizeId: null })} aria-pressed={item.id === selection.textureId} className="selection-product-card selection-product-card--texture">
                <span className="selection-product-card__title">{item.label}</span>
                <ProductImage variantId={item.representativeVariantId} alt={item.label} pending={item.status === "pending"} />
                <span className="selection-product-card__description">{item.description}</span>
                <PendingLabel copy={item.status === "pending" ? "Datos pendientes" : "Precio pendiente"} />
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
                    })}
                    aria-pressed={item.id === selection.colorId}
                    className="selection-color-card"
                  >
                    <span className="selection-color-card__title">
                      <span className="selection-color-swatch" style={{ background: item.swatch }} aria-hidden="true" />
                      {item.label}
                    </span>
                    <ColorPreview texture={selectedTexture} colorId={item.id} label={item.label} />
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )}

      {stage === "metal" && selectedTexture && (
        <fieldset className={`selection-metal-grid ${selectedTexture.metals.length === 1 ? "selection-metal-grid--single" : ""}`}>
          <legend className="sr-only">Tipo de alpaca o metal</legend>
          {selectedTexture.metals.map((item) => (
            <button key={item.id} type="button" onClick={() => onChange({ ...selection, metalId: item.id, sizeId: null })} aria-pressed={item.id === selection.metalId} className="selection-product-card">
              <span className="selection-product-card__title">{item.label}</span>
              <MetalPreview image={item.previewImage} label={item.label} />
              <span className="selection-product-card__description">Muestra del material de {item.label.toLowerCase()}</span>
              <PendingLabel />
            </button>
          ))}
        </fieldset>
      )}

      {stage === "size" && selectedTexture && (
        <fieldset className="selection-size-list">
          <legend className="sr-only">Tamaño del mate</legend>
          {selectedTexture.sizes.map((size) => (
            <button key={size} type="button" onClick={() => onChange({ ...selection, sizeId: size })} aria-pressed={size === selection.sizeId}>
              <strong>{mateSizeDecisionLabels[size]}</strong>
              <span>Capacidad {mateSizeDecisionLabels[size].toLowerCase()}</span>
              <PendingLabel />
            </button>
          ))}
        </fieldset>
      )}

      <div className="selection-actions">
        <button type="button" onClick={onBack} className="brand-button">Atrás</button>
        <button type="button" disabled={!canContinue} onClick={onContinue} className="brand-button">
          {stage === "size" ? "Siguiente" : "Siguiente"}
        </button>
      </div>
    </main>
  );
}
