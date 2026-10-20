import { useEffect, useState } from "react";

const SORTEO_URL = "https://www.matearteuruguay.com/sorteo";
const STORAGE_KEY = "matearte-sorteo-poster-v1";
const DEFAULT_COPY = {
  title: "Participá del sorteo",
  description: "Escaneá el código y completá tus datos.",
};

function loadCopy() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return {
      title: typeof saved?.title === "string" ? saved.title : DEFAULT_COPY.title,
      description: typeof saved?.description === "string" ? saved.description : DEFAULT_COPY.description,
    };
  } catch {
    return DEFAULT_COPY;
  }
}

export function SorteoView() {
  const [copy, setCopy] = useState(loadCopy);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(copy)); } catch { /* La vista previa sigue funcionando si no hay almacenamiento. */ }
  }, [copy]);

  return (
    <div className="marketing-sorteo-page">
      <section className="marketing-sorteo-editor" aria-labelledby="marketing-sorteo-editor-title">
        <h2 id="marketing-sorteo-editor-title">Texto del afiche</h2>
        <p>Editá el contenido y mirá cómo queda antes de imprimir.</p>
        <div className="marketing-sorteo-fields">
          <label htmlFor="marketing-sorteo-title">Título</label>
          <input
            id="marketing-sorteo-title"
            type="text"
            maxLength={70}
            value={copy.title}
            onChange={(event) => setCopy((current) => ({ ...current, title: event.target.value }))}
          />
          <small>{copy.title.length}/70 caracteres</small>
          <label htmlFor="marketing-sorteo-description">Descripción</label>
          <textarea
            id="marketing-sorteo-description"
            rows={4}
            maxLength={180}
            value={copy.description}
            onChange={(event) => setCopy((current) => ({ ...current, description: event.target.value }))}
          />
          <small>{copy.description.length}/180 caracteres</small>
        </div>
        <p className="marketing-sorteo-save-note">El texto se guarda en este navegador. El QR siempre lleva a <a href={SORTEO_URL} target="_blank" rel="noreferrer">matearteuruguay.com/sorteo</a>.</p>
      </section>

      <div className="marketing-sorteo-preview">
        <div className="marketing-sorteo-toolbar">
          <div>
            <h2>QR del sorteo</h2>
            <p>Vista previa preparada para imprimir en A4.</p>
          </div>
          <div className="marketing-sorteo-actions">
            <a className="secondary" href="/sorteo-qr.svg" download="MateArte-Sorteo-QR.svg">Descargar QR</a>
            <button className="primary" type="button" onClick={() => window.print()}>Imprimir A4</button>
          </div>
        </div>

        <section className={`marketing-sorteo-poster${copy.title.length > 45 || copy.description.length > 120 ? " marketing-sorteo-poster--dense" : ""}`} aria-label="Afiche del sorteo listo para imprimir">
          <img className="marketing-sorteo-logo" src="/matearte-sorteo-logo.png" alt="Logo de MateArte" width="640" height="640" />
          <div className="marketing-sorteo-rule" />
          <h2>{copy.title}</h2>
          <p className="marketing-sorteo-intro">{copy.description}</p>
          <a className="marketing-sorteo-qr" href={SORTEO_URL} target="_blank" rel="noreferrer" aria-label="Abrir el sorteo de MateArte Uruguay">
            <img src="/sorteo-qr.svg" alt="Código QR para participar del sorteo de MateArte Uruguay" width="360" height="360" />
          </a>
          <p className="marketing-sorteo-scan">ESCANEÁ PARA PARTICIPAR</p>
          <p className="marketing-sorteo-url">matearteuruguay.com/sorteo</p>
        </section>
      </div>
    </div>
  );
}
