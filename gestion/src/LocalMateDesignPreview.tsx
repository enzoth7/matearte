import { useEffect, useState } from "react";
import { ConfiguratorPreview } from "../../personalizador/src/components/ConfiguratorPreview";
import { FlatFlejePreview } from "../../personalizador/src/components/FlatFlejePreview";
import { rimIconCatalog } from "../../personalizador/src/catalog/rimIconCatalog";
import { createDefaultFlejeSide, type ElementTransform, type IconElement, type CustomImageAsset } from "../../personalizador/src/types/personalizer";
import type { MateModel } from "../../personalizador/src/catalog/mateCatalog";
import type { Product } from "./data";
import { invertLocalRimText, localDesignIcons, localDesignTransform, type LocalPersonalizationDraft } from "./localPersonalization";
import { customModelLabel } from "./CustomArticlePicker";

export function LocalMateDesignPreview({ product, draft, surface, update }: { product: Product; draft: LocalPersonalizationDraft; surface: "rim" | "fleje"; update: (changes: Partial<LocalPersonalizationDraft>) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [side, setSide] = useState<"front" | "back">("front");
  useEffect(() => setSelected(null), [surface]);
  const file = surface === "rim" ? draft.rimLogoFile : draft.flejeLogoFile;
  const [previewUrl, setPreviewUrl] = useState("");
  useEffect(() => {
    if (!file || file.type === "application/pdf") { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(file); setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const transform = (key: string, side: "rim" | "front" | "back") => localDesignTransform(draft, key, side);
  const move = (key: string, value: ElementTransform) => update({ designTransforms: { ...draft.designTransforms, [key]: value } });
  const selectedIcons = localDesignIcons(draft, surface);
  const changeIcons = (icons: typeof selectedIcons) => update(surface === "rim" ? { rimIcons: icons, rimContent: content === "text" ? "text-logo" : content } : { flejeIcons: icons, flejeContent: content === "text" ? "text-logo" : content });
  const content = surface === "rim" ? draft.rimContent : draft.flejeContent;
  const technique = surface === "rim" ? draft.rimTechnique : draft.flejeTechnique;
  const enabled = technique !== "none";
  const icons: IconElement[] = content === "text" || !enabled ? [] : [
    ...selectedIcons.map(item => ({ ...item, customImage: null, transform: transform(item.id, surface === "rim" ? "rim" : "front") })),
    ...(file && previewUrl ? [{ id: `${surface}-upload`, selectedImageId: null, customImage: { id: file.name, name: file.name, mimeType: file.type, size: file.size, previewUrl, originalUrl: previewUrl, source: "upload" } as CustomImageAsset, transform: transform(`${surface}-upload`, surface === "rim" ? "rim" : "front") }] : []),
  ];
  const model = customModelLabel(product).toLowerCase().match(/imperial|camionero|criollo|torpedo/)?.[0] as MateModel || "camionero";
  return <section className="local-design-editor" aria-label="Diseño visual del personalizado">
    <p>Arrastrá el texto o la imagen para ubicarlos. Seleccioná las letras y tocá Invertir dentro de la virola para pasarlas arriba o abajo. Si hay dos textos, quedan en lados opuestos.</p>
    <div className="local-design-preview">
      {surface === "rim" ? <ConfiguratorPreview model={model} editable selectedElement={selected} onSelectElement={setSelected} onTransformChange={(id, value) => move(id === "text-1" ? "rim-text" : id === "text-2" ? "rim-text-2" : id, value)} onToggleInvert={id => update(invertLocalRimText(draft, id))} rim={{
        rimId: product.rim, finishMode: enabled && draft.rimFinish !== "none" ? "finish" : "none", finishId: draft.rimFinish,
        textMode: enabled && content !== "logo" ? "text" : "none", text: draft.rimText, texts: [
          { id: "text-1", text: draft.rimText, inverted: draft.rimTextInverted, transform: transform("rim-text", "rim") },
          { id: "text-2", text: draft.rimText2, inverted: draft.rimText2Inverted, transform: transform("rim-text-2", "rim") },
        ], textTransform: transform("rim-text", "rim"), imageMode: icons.length ? "image" : "none", icons,
      }} /> : <FlatFlejePreview editable activeSide={side} onSelectSide={setSide} selectedElement={selected} onSelectElement={setSelected} onTransformChange={(s, id, value) => move(id === "text" ? `${s}-text` : id, value)} flejeConfig={{ finishMode: enabled && draft.flejeFinish !== "none" ? "finish" : "none", finishId: draft.flejeFinish, sides: {
        front: { ...createDefaultFlejeSide("front"), textMode: enabled && content !== "logo" ? "text" : "none", text: draft.flejeFrontText, textTransform: transform("front-text", "front"), imageMode: icons.length ? "image" : "none", icons },
        back: { ...createDefaultFlejeSide("back"), textMode: enabled && content !== "logo" ? "text" : "none", text: draft.flejeBackText, textTransform: transform("back-text", "back") },
      } }} />}
    </div>
    {selected && (() => { const key = selected === "text-1" ? "rim-text" : selected === "text-2" ? "rim-text-2" : selected === "text" ? `${side}-text` : selected; const current = transform(key, surface === "rim" ? "rim" : side); return <div className="local-design-adjustments"><label>Tamaño del elemento<input type="range" min="0.5" max="1.6" step="0.05" value={current.scale} onChange={e => move(key, { ...current, scale: Number(e.target.value) })} /></label><label>Giro del elemento<input type="range" min="-180" max="180" value={current.rotation} onChange={e => move(key, { ...current, rotation: Number(e.target.value) })} /></label></div>; })()}
    {enabled && <><strong>Íconos del personalizador</strong><div className="local-design-icons"><button type="button" aria-pressed={!selectedIcons.length} onClick={() => changeIcons([])}>Sin ícono</button>{rimIconCatalog.map(icon => <button key={icon.id} type="button" title={icon.name} aria-label={icon.name} onClick={() => { const id = `${surface}-${crypto.randomUUID()}`; changeIcons([...selectedIcons, { id, selectedImageId: icon.id }]); setSelected(id); }}><img src={icon.src} alt="" /></button>)}</div></>}
    {selectedIcons.length > 0 && <div className="local-design-icons">{selectedIcons.map((item, index) => <button type="button" key={item.id} onClick={() => { changeIcons(selectedIcons.filter(icon => icon.id !== item.id)); if (selected === item.id) setSelected(null); }}>Quitar ícono {index + 1}</button>)}</div>}
    {file?.type === "application/pdf" && <p>El PDF se adjunta a la venta. Para verlo en el diseño, cargá una imagen PNG, JPG o SVG.</p>}
  </section>;
}
