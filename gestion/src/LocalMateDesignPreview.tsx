import { useEffect, useState } from "react";
import { ConfiguratorPreview } from "../../personalizador/src/components/ConfiguratorPreview";
import { FlatFlejePreview } from "../../personalizador/src/components/FlatFlejePreview";
import { applyUploadedRimIcons, orderedRimIconCatalog } from "../../personalizador/src/catalog/rimIconCatalog";
import { commerceSource } from "./commerceSource";
import { createDefaultFlejeSide, type ElementTransform, type IconElement, type CustomImageAsset } from "../../personalizador/src/types/personalizer";
import type { MateModel } from "../../personalizador/src/catalog/mateCatalog";
import type { Product } from "./data";
import { invertLocalRimText, localDesignIcons, localDesignTransform, localFlejeLogoTransform, type LocalDesignIcon, type LocalPersonalizationDraft } from "./localPersonalization";
import { customModelLabel } from "./CustomArticlePicker";
import { useLocalRimLogos } from "./useLocalRimLogos";
import { useLocalFlejeLogos } from "./useLocalFlejeLogos";

export function LocalMateDesignPreview({ product, draft, surface, update }: { product: Product; draft: LocalPersonalizationDraft; surface: "rim" | "fleje"; update: (changes: Partial<LocalPersonalizationDraft>) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [, setIconVersion] = useState(0);
  const [iconError, setIconError] = useState(false);
  const [side, setSide] = useState<"front" | "back">("front");
  useEffect(() => { setSelected(null); setSide("front"); }, [surface]);
  useEffect(() => {
    const source = commerceSource;
    if (!source) return;
    let active = true;
    void Promise.all([
      source.from("visualizer_icons").select("id,name,storage_path,is_active").order("created_at"),
      source.from("visualizer_hidden_builtin_icons").select("icon_id"),
    ]).then(([iconsResult, hiddenResult]) => {
      if (!active) return;
      if (iconsResult.error || hiddenResult.error) setIconError(true);
      applyUploadedRimIcons((iconsResult.data ?? []).map((icon) => ({
        id: `icon-${icon.id}`,
        name: icon.name,
        src: source.storage.from("visualizer-catalog").getPublicUrl(icon.storage_path).data.publicUrl,
        is_active: icon.is_active,
      })), (hiddenResult.data ?? []).map((row) => row.icon_id));
      setIconVersion((version) => version + 1);
    });
    return () => { active = false; };
  }, []);
  const { logos: rimLogos, urls: rimLogoUrls } = useLocalRimLogos(draft);
  const { logos: flejeLogos, urls: flejeLogoUrls } = useLocalFlejeLogos(draft);
  const transform = (key: string, side: "rim" | "front" | "back") => {
    if (side !== "rim") {
      const logo = flejeLogos.find(item => key === `${item.id}-${side}`);
      if (logo) return localFlejeLogoTransform(draft, logo.id, side);
    }
    return localDesignTransform(draft, key, side);
  };
  const move = (key: string, value: ElementTransform) => update({ designTransforms: { ...draft.designTransforms, [key]: value } });
  const selectedIcons = localDesignIcons(draft, surface);
  const visibleIcons = surface === "rim" ? selectedIcons : selectedIcons.filter(item => (item.side ?? "front") === side);
  const changeIcons = (icons: LocalDesignIcon[]) => update(surface === "rim" ? { rimIcons: icons, rimContent: content === "text" ? "text-logo" : content } : { flejeIcons: icons, flejeContent: content === "text" ? "text-logo" : content });
  const chooseSide = (next: "front" | "back") => { setSide(next); setSelected(null); };
  const content = surface === "rim" ? draft.rimContent : draft.flejeContent;
  const technique = surface === "rim" ? draft.rimTechnique : draft.flejeTechnique;
  const enabled = technique !== "none";
  const previewIcon = (item: LocalDesignIcon, iconSide: "rim" | "front" | "back"): IconElement => ({ ...item, customImage: null, transform: transform(item.id, iconSide) });
  const uploadFor = (uploadSide: "front" | "back"): IconElement[] => flejeLogos.filter(logo => logo.sides.includes(uploadSide) && flejeLogoUrls[logo.id]).map(logo => ({
    id: `${logo.id}-${uploadSide}`, selectedImageId: null,
    customImage: { id: logo.id, name: logo.file.name, mimeType: logo.file.type, size: logo.file.size, previewUrl: flejeLogoUrls[logo.id], originalUrl: flejeLogoUrls[logo.id], source: "upload" } as CustomImageAsset,
    transform: localFlejeLogoTransform(draft, logo.id, uploadSide),
  }));
  const sideCount = (value: "front" | "back") => selectedIcons.filter(item => (item.side ?? "front") === value).length + flejeLogos.filter(logo => logo.sides.includes(value)).length;
  const toggleUpload = (logoId: string) => {
    const logo = flejeLogos.find(item => item.id === logoId);
    if (!logo) return;
    const active = logo.sides.includes(side);
    update({ flejeLogoFile: null, flejeLogos: flejeLogos.map(item => item.id === logoId ? { ...item, sides: active ? item.sides.filter(value => value !== side) : [...item.sides, side] } : item), flejeContent: content === "text" ? "text-logo" : content });
    setSelected(active ? null : `${logoId}-${side}`);
  };
  const clearIcons = () => {
    changeIcons(surface === "rim" ? [] : selectedIcons.filter(item => (item.side ?? "front") !== side));
    if (surface === "rim") update({ rimLogos: rimLogos.map(logo => ({ ...logo, enabled: false })) });
    if (surface === "fleje") update({ flejeLogoFile: null, flejeLogos: flejeLogos.map(logo => ({ ...logo, sides: logo.sides.filter(value => value !== side) })) });
    setSelected(null);
  };
  const rimIcons: IconElement[] = content === "text" || !enabled ? [] : [...selectedIcons.map(item => previewIcon(item, "rim")), ...rimLogos.filter(logo => logo.enabled && rimLogoUrls[logo.id]).map(logo => ({ id: logo.id, selectedImageId: null, customImage: { id: logo.id, name: logo.file.name, mimeType: logo.file.type, size: logo.file.size, previewUrl: rimLogoUrls[logo.id], originalUrl: rimLogoUrls[logo.id], source: "upload" } as CustomImageAsset, transform: transform(logo.id, "rim") }))];
  const frontIcons: IconElement[] = content === "text" || !enabled ? [] : [...selectedIcons.filter(item => (item.side ?? "front") === "front").map(item => previewIcon(item, "front")), ...uploadFor("front")];
  const backIcons: IconElement[] = content === "text" || !enabled ? [] : [...selectedIcons.filter(item => item.side === "back").map(item => previewIcon(item, "back")), ...uploadFor("back")];
  const model = customModelLabel(product).toLowerCase().match(/imperial|camionero|criollo|torpedo/)?.[0] as MateModel || "camionero";
  return <section className="local-design-editor" aria-label="Diseño visual del personalizado">
    <div className="local-design-editor-guide">{surface === "fleje" ? "Elegí Frente o Dorso para agregar íconos en ese lado. Arrastrá el texto o los íconos para ubicarlos; al cambiar de lado se conserva el diseño anterior." : "Arrastrá el texto o la imagen para ubicarlos. Seleccioná un texto y tocá Invertir dentro de la virola para mover solo ese texto arriba o abajo."}</div>
    <div className="local-design-preview">
      {surface === "rim" ? <ConfiguratorPreview model={model} editable selectedElement={selected} onSelectElement={setSelected} onTransformChange={(id, value) => move(id === "text-1" ? "rim-text" : id === "text-2" ? "rim-text-2" : id, value)} onToggleInvert={id => update(invertLocalRimText(draft, id))} rim={{
        rimId: product.rim, finishMode: enabled && draft.rimFinish !== "none" ? "finish" : "none", finishId: draft.rimFinish,
        textMode: enabled && content !== "logo" ? "text" : "none", text: draft.rimText, texts: [
          { id: "text-1", text: draft.rimText, inverted: draft.rimTextInverted, transform: transform("rim-text", "rim") },
          { id: "text-2", text: draft.rimText2, inverted: draft.rimText2Inverted, transform: transform("rim-text-2", "rim") },
        ], textTransform: transform("rim-text", "rim"), imageMode: rimIcons.length ? "image" : "none", icons: rimIcons,
      }} /> : <FlatFlejePreview editable activeSide={side} onSelectSide={chooseSide} selectedElement={selected} onSelectElement={setSelected} onTransformChange={(s, id, value) => move(id === "text" ? `${s}-text` : id, value)} flejeConfig={{ finishMode: enabled && draft.flejeFinish !== "none" ? "finish" : "none", finishId: draft.flejeFinish, sides: {
        front: { ...createDefaultFlejeSide("front"), textMode: enabled && content !== "logo" ? "text" : "none", text: draft.flejeFrontText, textTransform: transform("front-text", "front"), imageMode: frontIcons.length ? "image" : "none", icons: frontIcons },
        back: { ...createDefaultFlejeSide("back"), textMode: enabled && content !== "logo" ? "text" : "none", text: draft.flejeBackText, textTransform: transform("back-text", "back"), imageMode: backIcons.length ? "image" : "none", icons: backIcons },
      } }} />}
    </div>
    {selected && (() => { const key = selected === "text-1" ? "rim-text" : selected === "text-2" ? "rim-text-2" : selected === "text" ? `${side}-text` : selected; const current = transform(key, surface === "rim" ? "rim" : side); return <div className="local-design-adjustments"><label>Tamaño del elemento<input type="range" min="0.5" max="1.6" step="0.05" value={current.scale} onChange={e => move(key, { ...current, scale: Number(e.target.value) })} /></label><label>Giro del elemento<input type="range" min="-180" max="180" value={current.rotation} onChange={e => move(key, { ...current, rotation: Number(e.target.value) })} /></label></div>; })()}
    {enabled && <>
      <strong>Íconos del personalizador</strong>
      {surface === "fleje" && <div className="local-design-side-picker" role="group" aria-label="Lado del fleje para agregar íconos"><span>Agregar íconos en</span><div><button type="button" aria-pressed={side === "front"} onClick={() => chooseSide("front")}>Frente ({sideCount("front")})</button><button type="button" aria-pressed={side === "back"} onClick={() => chooseSide("back")}>Dorso ({sideCount("back")})</button></div></div>}
      {surface === "fleje" && flejeLogos.length > 0 && <small>Los logos subidos quedan disponibles para este diseño. Tocá cada miniatura para agregarla o quitarla del lado elegido.</small>}
      {surface === "rim" && rimLogos.length > 0 && <small>Los logos subidos quedan disponibles para este diseño. Tocá una miniatura para agregarla o quitarla de la virola.</small>}
      {iconError && <small>No se pudieron cargar los íconos nuevos. Reabrí el diseño para reintentar.</small>}
      <div className="local-design-icons">
        <button type="button" aria-pressed={!visibleIcons.length && !(surface === "fleje" && flejeLogos.some(logo => logo.sides.includes(side))) && !(surface === "rim" && rimLogos.some(logo => logo.enabled))} onClick={clearIcons}>Sin ícono</button>
        {surface === "rim" && rimLogos.map((logo, index) => <button key={logo.id} type="button" className="local-design-upload-icon" aria-label={`${logo.enabled ? "Quitar" : "Agregar"} logo ${index + 1} ${logo.enabled ? "de" : "en"} la virola: ${logo.file.name}`} aria-pressed={logo.enabled} title={logo.file.name} onClick={() => {
          update({ rimLogos: rimLogos.map(item => item.id === logo.id ? { ...item, enabled: !item.enabled } : item), rimContent: content === "text" ? "text-logo" : content });
          setSelected(logo.enabled ? null : logo.id);
        }}>
          {rimLogoUrls[logo.id] ? <img src={rimLogoUrls[logo.id]} alt="" /> : <span>PDF</span>}
          <span>Logo {index + 1}</span>
        </button>)}
        {surface === "fleje" && flejeLogos.map((logo, index) => <button key={logo.id} type="button" className="local-design-upload-icon" aria-label={`${logo.sides.includes(side) ? "Quitar" : "Agregar"} logo ${index + 1} ${logo.sides.includes(side) ? "de" : "en"} ${side === "front" ? "Frente" : "Dorso"}: ${logo.file.name}`} aria-pressed={logo.sides.includes(side)} title={logo.file.name} onClick={() => toggleUpload(logo.id)}>
          {flejeLogoUrls[logo.id] ? <img src={flejeLogoUrls[logo.id]} alt="" /> : <span>PDF</span>}
          <span>Logo {index + 1}</span>
        </button>)}
        {orderedRimIconCatalog.map(icon => <button key={icon.id} type="button" title={icon.name} aria-label={icon.name} onClick={() => { const id = `${surface}-${crypto.randomUUID()}`; changeIcons([...selectedIcons, { id, selectedImageId: icon.id, ...(surface === "fleje" ? { side } : {}) }]); setSelected(id); }}><img src={icon.src} alt="" /></button>)}
      </div>
    </>}
    {visibleIcons.length > 0 && <div className="local-design-icons">{visibleIcons.map((item, index) => <button type="button" key={item.id} onClick={() => { changeIcons(selectedIcons.filter(icon => icon.id !== item.id)); if (selected === item.id) setSelected(null); }}>Quitar ícono {index + 1}</button>)}</div>}
    {((surface === "fleje" && flejeLogos.some(logo => logo.sides.length && logo.file.type === "application/pdf")) || (surface === "rim" && rimLogos.some(logo => logo.enabled && logo.file.type === "application/pdf"))) && <p>El PDF se adjunta a la venta. Para verlo en el diseño, cargá una imagen PNG, JPG o SVG.</p>}
  </section>;
}
