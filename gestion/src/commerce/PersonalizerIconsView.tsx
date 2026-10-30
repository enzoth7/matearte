import { useEffect, useState } from "react";
import { ImageSquare, Trash, WarningCircle } from "@phosphor-icons/react";
import { personalizationAssets } from "virtual:personalization-assets";
import { supabase } from "./supabase";
import { preparePersonalizerIcon } from "./personalizerIconUpload";

type UploadedIcon = {
  id: string;
  name: string;
  storage_path: string;
  is_active: boolean;
  created_at: string;
};

const bucket = supabase.storage.from("visualizer-catalog");
const publicSrc = (path: string) => bucket.getPublicUrl(path).data.publicUrl;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la operación.";

export function PersonalizerIconsView() {
  const [icons, setIcons] = useState<UploadedIcon[]>([]);
  const [hiddenBuiltIns, setHiddenBuiltIns] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.from("visualizer_icons").select("id,name,storage_path,is_active,created_at").order("created_at"),
      supabase.from("visualizer_hidden_builtin_icons").select("icon_id"),
    ]).then(([iconsResult, hiddenResult]) => {
      if (!active) return;
      if (iconsResult.error || hiddenResult.error) setError(iconsResult.error?.message || hiddenResult.error?.message || "No se pudieron cargar los íconos.");
      else { setIcons(iconsResult.data ?? []); setHiddenBuiltIns((hiddenResult.data ?? []).map((row) => row.icon_id)); }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const upload = async () => {
    if (!file || !name.trim() || busy) return;
    setError("");
    setNotice("");
    setBusy(true);
    let path = "";
    try {
      const prepared = await preparePersonalizerIcon(file);
      const id = crypto.randomUUID();
      path = `icons/${id}.${prepared.extension}`;
      const uploaded = await bucket.upload(path, prepared.file, { contentType: prepared.file.type, upsert: false, cacheControl: "31536000" });
      if (uploaded.error) throw uploaded.error;
      const result = await supabase.from("visualizer_icons").insert({ id, name: name.trim(), storage_path: path }).select("id,name,storage_path,is_active,created_at").single();
      if (result.error) throw result.error;
      setIcons((current) => [...current, result.data]);
      setName("");
      setFile(null);
      setNotice("Ícono publicado. Aparecerá al abrir de nuevo el Personalizador o la venta minorista.");
    } catch (reason) {
      if (path) await bucket.remove([path]);
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const setUploadedVisible = async (icon: UploadedIcon, visible: boolean) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const result = await supabase.from("visualizer_icons").update({ is_active: visible }).eq("id", icon.id).select("id,name,storage_path,is_active,created_at").single();
    if (result.error) setError(result.error.message);
    else {
      setIcons((current) => current.map((item) => item.id === icon.id ? result.data : item));
      setNotice(result.data.is_active ? "Ícono visible para nuevas personalizaciones." : "Ícono oculto para nuevas personalizaciones. Los diseños anteriores lo conservan.");
    }
    setBusy(false);
  };

  const setBuiltInVisible = async (iconId: string, visible: boolean) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const request = visible
      ? supabase.from("visualizer_hidden_builtin_icons").delete().eq("icon_id", iconId).select("icon_id").single()
      : supabase.from("visualizer_hidden_builtin_icons").insert({ icon_id: iconId }).select("icon_id").single();
    const result = await request;
    if (result.error) setError(result.error.message);
    else {
      setHiddenBuiltIns((current) => visible ? current.filter((id) => id !== iconId) : [...current, iconId]);
      setNotice(visible ? "Ícono restaurado." : "Ícono quitado de las nuevas personalizaciones. Los diseños anteriores lo conservan.");
    }
    setBusy(false);
  };

  const visibleBuiltIns = personalizationAssets.iconos.filter((icon) => !hiddenBuiltIns.includes(icon.id));
  const hiddenIcons = personalizationAssets.iconos.filter((icon) => hiddenBuiltIns.includes(icon.id));
  const visibleUploads = icons.filter((icon) => icon.is_active);
  const hiddenUploads = icons.filter((icon) => !icon.is_active);

  return <section className="personalizer-icons" aria-label="Íconos del Personalizador">
    <header className="personalizer-icons__header">
      <div><h2>Íconos del Personalizador</h2><p>Estos íconos se usan en la web y al registrar ventas minoristas personalizadas.</p></div>
      <span>{visibleBuiltIns.length + visibleUploads.length} visibles</span>
    </header>
    {error && <p className="personalizer-icons__message is-error" role="alert"><WarningCircle size={18} />{error}</p>}
    {notice && <p className="personalizer-icons__message" role="status">{notice}</p>}
    <div className="personalizer-icons__upload">
      <div><h3>Agregar ícono</h3></div>
      {preview && <img src={preview} alt="Vista previa del ícono nuevo" />}
      <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Ej.: Flor" disabled={busy} /></label>
      <label>Archivo SVG, PNG o WebP<input type="file" accept="image/svg+xml,.svg,image/png,image/webp" onChange={(event) => { setFile(event.currentTarget.files?.[0] ?? null); event.currentTarget.value = ""; }} disabled={busy} />{file && <small>{file.name}</small>}</label>
      <button type="button" disabled={!file || !name.trim() || busy} onClick={() => void upload()}>{busy ? "Guardando…" : "Subir ícono"}</button>
    </div>
    <h3>Íconos actuales</h3>
    <div className="personalizer-icons__grid">
      {visibleBuiltIns.map((icon) => <article className="personalizer-icons__card" key={icon.id}>
        <div className="personalizer-icons__image"><img src={icon.src} alt="" loading="lazy" /></div>
        <strong>{icon.name}</strong><small>{icon.src.toLowerCase().endsWith(".svg") ? "SVG" : "WebP"}</small>
        <button className="personalizer-icons__trash" type="button" disabled={busy} title={`Quitar ${icon.name}`} aria-label={`Quitar ${icon.name}`} onClick={() => void setBuiltInVisible(icon.id, false)}><Trash size={17} aria-hidden="true" /></button>
      </article>)}
      {visibleUploads.map((icon) => <article className="personalizer-icons__card" key={icon.id}>
        <div className="personalizer-icons__image"><img src={publicSrc(icon.storage_path)} alt="" loading="lazy" /></div>
        <strong>{icon.name}</strong><small>{icon.storage_path.endsWith(".svg") ? "SVG" : icon.storage_path.endsWith(".png") ? "PNG" : "WebP"}</small>
        <button className="personalizer-icons__trash" type="button" disabled={busy} title={`Quitar ${icon.name}`} aria-label={`Quitar ${icon.name}`} onClick={() => void setUploadedVisible(icon, false)}><Trash size={17} aria-hidden="true" /></button>
      </article>)}
    </div>
    {(hiddenIcons.length > 0 || hiddenUploads.length > 0) && <details className="personalizer-icons__hidden">
      <summary>Ocultos ({hiddenIcons.length + hiddenUploads.length})</summary>
      <div className="personalizer-icons__grid">
        {hiddenIcons.map((icon) => <article className="personalizer-icons__card" key={icon.id}>
          <div className="personalizer-icons__image"><img src={icon.src} alt="" loading="lazy" /></div>
          <strong>{icon.name}</strong><small>{icon.src.toLowerCase().endsWith(".svg") ? "SVG" : "WebP"}</small>
          <button className="personalizer-icons__restore" type="button" disabled={busy} onClick={() => void setBuiltInVisible(icon.id, true)}>Restaurar</button>
        </article>)}
        {hiddenUploads.map((icon) => <article className="personalizer-icons__card" key={icon.id}>
          <div className="personalizer-icons__image"><img src={publicSrc(icon.storage_path)} alt="" loading="lazy" /></div>
          <strong>{icon.name}</strong><small>{icon.storage_path.endsWith(".svg") ? "SVG" : icon.storage_path.endsWith(".png") ? "PNG" : "WebP"}</small>
          <button className="personalizer-icons__restore" type="button" disabled={busy} onClick={() => void setUploadedVisible(icon, true)}>Restaurar</button>
        </article>)}
      </div>
    </details>}
    {loading && <p className="personalizer-icons__message"><ImageSquare size={18} />Cargando íconos nuevos…</p>}
  </section>;
}
