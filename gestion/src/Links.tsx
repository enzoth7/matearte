import { useState } from "react";
import { Check, Copy, ArrowSquareOut } from "@phosphor-icons/react";

const links = [
  { name: "Gestor", description: "Este panel de gestión de Matearte.", url: "https://matearte-gestion.vercel.app" },
  { name: "Página web de Matearte", description: "La tienda online para clientes.", url: "https://www.matearteuruguay.com" },
  { name: "Visualizador de Matearte", description: "El personalizador donde los clientes diseñan su mate.", url: "https://matearte-visualizador.vercel.app" },
];

export function Links() {
  const [copied, setCopied] = useState("");
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(url); window.setTimeout(() => setCopied((current) => current === url ? "" : current), 2000); }
    catch { window.prompt("Copiá la dirección:", url); }
  }
  return <div className="links-page">
    <p className="channel-origin-intro">Las direcciones de los tres sitios de Matearte, para abrirlas o copiarlas.</p>
    <ul className="links-list">{links.map((link) => <li key={link.url} className="links-item">
      <div><strong>{link.name}</strong><small>{link.description}</small><a href={link.url} target="_blank" rel="noopener noreferrer">{link.url}</a></div>
      <div className="links-actions">
        <button type="button" className="secondary" onClick={() => void copy(link.url)}>{copied === link.url ? <><Check size={18} aria-hidden="true" />Copiado</> : <><Copy size={18} aria-hidden="true" />Copiar</>}</button>
        <a className="primary links-open" href={link.url} target="_blank" rel="noopener noreferrer"><ArrowSquareOut size={18} aria-hidden="true" />Abrir</a>
      </div>
    </li>)}</ul>
  </div>;
}
