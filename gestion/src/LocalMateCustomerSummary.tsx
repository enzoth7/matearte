import { useEffect, useMemo, useRef, useState } from "react";
import { domToBlob } from "modern-screenshot";
import type { Product } from "./data";
import { Modal } from "./ui";
import { SavedDesignViews } from "./localDesignPreviews";
import { buildLocalPersonalizationSnapshot, localDesignTransform, productHasFleje, type LocalPersonalizationDraft } from "./localPersonalization";
import { getSelectionPreviewImage, type MateFamilyId } from "../../personalizador/src/catalog/mateDecisionCatalog";
import { catalogValueLabel, defaultCatalogTaxonomy } from "../../shared/catalog-taxonomy";

type PreviewUrls = { rim?: string; fleje?: string };
type VisualSnapshot = ReturnType<typeof buildLocalPersonalizationSnapshot> & {
  configuration: { rim: { icons: unknown[]; imageMode: string }; selectionLabels: Record<string, string>; capabilities: { hasRim: boolean; hasFleje: boolean } };
  flejeConfiguration: { sides: { front: { icons: unknown[]; imageMode: string; customImage: unknown } } };
};

function uploadedImage(file: File, url: string) {
  return { id: file.name, name: file.name, mimeType: file.type, size: file.size, previewUrl: url, originalUrl: url, source: "upload" };
}

function matePhoto(product: Product) {
  if (product.imageUrl) return product.imageUrl;
  const assembly = product.assembly;
  if (!assembly) return undefined;
  const familyId = assembly["tipo-mate"] as MateFamilyId;
  if (!["imperial", "torpedo", "camionero", "criollo"].includes(familyId)) return undefined;
  const leather = assembly["tipo-cuero"];
  const textureId = familyId === "imperial" ? assembly["tipo-virola"] === "plata" ? "virola-plata-900" : assembly["tipo-virola"] === "imperial-premium" ? "cincelado-premium" : "imperial-clasico"
    : familyId === "torpedo" ? leather === "crudo" ? "cuero-crudo" : ["pelos", "croco"].includes(leather) ? "print-pelos" : leather === "estampado" ? "cuero-estampado" : "cuero-liso"
      : familyId === "criollo" ? `${assembly["forma-criollo"] || "torpedo"}-criollo-posa-mate` : "alpaca-cincelado-patas";
  const chosenColor = assembly.color === "crudo" ? familyId === "criollo" ? "cuero-crudo-criollo" : "cuero-crudo"
    : assembly.color === "animal-print" && familyId === "imperial" ? "animal-print-premium" : assembly.color;
  const selection = { familyId, textureId, colorId: chosenColor || "natural" };
  return getSelectionPreviewImage(selection) || getSelectionPreviewImage({ ...selection, colorId: "natural" });
}

function visualSnapshot(product: Product, draft: LocalPersonalizationDraft, urls: PreviewUrls): VisualSnapshot {
  const snapshot = buildLocalPersonalizationSnapshot(draft, product) as VisualSnapshot;
  if (urls.rim && draft.rimLogoFile && draft.rimTechnique !== "none" && draft.rimContent !== "text") {
    snapshot.configuration.rim.imageMode = "image";
    snapshot.configuration.rim.icons = [...snapshot.configuration.rim.icons, {
      id: "rim-upload", selectedImageId: null, customImage: uploadedImage(draft.rimLogoFile, urls.rim),
      transform: localDesignTransform(draft, "rim-upload", "rim"),
    }];
  }
  if (urls.fleje && draft.flejeLogoFile && draft.flejeTechnique !== "none" && draft.flejeContent !== "text" && productHasFleje(product)) {
    const front = snapshot.flejeConfiguration.sides.front;
    front.imageMode = "image";
    front.customImage = uploadedImage(draft.flejeLogoFile, urls.fleje);
    front.icons = [...front.icons, {
      id: "fleje-upload", selectedImageId: null, customImage: uploadedImage(draft.flejeLogoFile, urls.fleje),
      transform: localDesignTransform(draft, "fleje-upload", "front"),
    }];
  }
  return snapshot;
}

export function LocalMateCustomerSummary({ product, draft, quantity, onClose }: {
  product: Product;
  draft: LocalPersonalizationDraft;
  quantity: number;
  onClose: () => void;
}) {
  const [urls, setUrls] = useState<PreviewUrls>({});
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const next: PreviewUrls = {};
    if (draft.rimLogoFile?.type.startsWith("image/")) next.rim = URL.createObjectURL(draft.rimLogoFile);
    if (draft.flejeLogoFile?.type.startsWith("image/")) next.fleje = URL.createObjectURL(draft.flejeLogoFile);
    setUrls(next);
    return () => { if (next.rim) URL.revokeObjectURL(next.rim); if (next.fleje) URL.revokeObjectURL(next.fleje); };
  }, [draft.rimLogoFile, draft.flejeLogoFile]);
  const snapshot = useMemo(() => visualSnapshot(product, draft, urls), [product, draft, urls]);
  const photo = matePhoto(product);
  const labels = snapshot.configuration.selectionLabels;
  const colorLabel = product.assembly ? product.assembly.color ? catalogValueLabel(defaultCatalogTaxonomy, "color", product.assembly.color) : "Pendiente de elegir" : labels.color;
  const sizeLabel = product.assembly && !product.assembly.tamano ? "" : labels.size;
  const rimTexts = draft.rimTechnique === "none" ? [] : [draft.rimText, draft.rimText2].map(text => text.trim()).filter(Boolean);
  const hasRim = snapshot.configuration.capabilities.hasRim;
  const hasFleje = snapshot.configuration.capabilities.hasFleje;

  async function download() {
    if (!sheetRef.current || exporting) return;
    setError(""); setExporting(true);
    try {
      await document.fonts.ready;
      await Promise.all(Array.from(sheetRef.current.querySelectorAll("img")).map(image => image.decode().catch(() => undefined)));
      const blob = await domToBlob(sheetRef.current, { scale: 2, backgroundColor: "#ffffff" });
      if (!blob?.size) throw new Error("No se pudo generar la imagen.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vista-previa-${product.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mate"}.png`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch { setError("No se pudo descargar la imagen. Revisá que las fotos del diseño hayan cargado e intentá de nuevo."); }
    finally { setExporting(false); }
  }

  return <Modal title="Vista previa para compartir" className="local-mate-summary-dialog" onClose={onClose}>
    <div className="local-mate-summary-scroll">
      <div className="local-mate-summary-sheet" ref={sheetRef} aria-label="Resumen del mate personalizado">
        <header><h2>{product.name}</h2><p>{quantity} {quantity === 1 ? "unidad" : "unidades"} · Diseño para revisar antes de confirmar el pedido</p></header>
        <div className="local-mate-summary-overview">
          <div className="local-mate-summary-photo">
            {photo ? <img src={photo} alt={`Referencia del mate completo: ${product.name}`} style={product.imageCrop ? { transform: `translate(${product.imageCrop.x}%, ${product.imageCrop.y}%) scale(${product.imageCrop.zoom})` } : undefined} /> : <span>Foto del mate no disponible</span>}
            <strong>Mate completo · imagen de referencia</strong>
          </div>
          <dl className="local-mate-summary-specs">
            <div><dt>Modelo</dt><dd>{product.name}</dd></div>
            {sizeLabel && <div><dt>Tamaño</dt><dd>{sizeLabel}</dd></div>}
            {colorLabel && <div><dt>Color</dt><dd>{colorLabel}</dd></div>}
            {hasRim && labels.metal && <div><dt>Virola</dt><dd>{labels.metal}</dd></div>}
            {hasRim && <div><dt>Texto en virola</dt><dd>{rimTexts.length ? rimTexts.join(" · ") : "Sin texto"}</dd></div>}
            {hasFleje && <><div><dt>Fleje · frente</dt><dd>{draft.flejeTechnique !== "none" && draft.flejeFrontText.trim() || "Sin texto"}</dd></div><div><dt>Fleje · reverso</dt><dd>{draft.flejeTechnique !== "none" && draft.flejeBackText.trim() || "Sin texto"}</dd></div></>}
          </dl>
        </div>
        {(hasRim || hasFleje) && <section className="local-mate-summary-designs" aria-label="Vistas del diseño">
          <h3>Vistas del diseño</h3>
          <SavedDesignViews snapshot={snapshot} />
        </section>}
        {(draft.rimLogoFile?.type === "application/pdf" || draft.flejeLogoFile?.type === "application/pdf") && <p className="local-mate-summary-note">Los logos en PDF se adjuntan al pedido, pero no aparecen en esta vista. Para mostrarlos, cargá una imagen PNG, JPG o SVG.</p>}
      </div>
    </div>
    <footer className="local-mate-summary-actions">
      {error && <span role="alert" className="error">{error}</span>}
      <button type="button" className="secondary" onClick={onClose}>Cerrar</button>
      <button type="button" className="primary" disabled={exporting} onClick={() => void download()}>{exporting ? "Preparando imagen…" : "Descargar imagen para compartir"}</button>
    </footer>
  </Modal>;
}
