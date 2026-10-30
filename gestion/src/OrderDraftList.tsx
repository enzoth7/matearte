import { useState } from "react";
import type { SavedDraft } from "./orderDraft";

export function OrderDraftList<T>({ drafts, title, newLabel, describe, onResume, onNew, onDiscard }: {
  drafts: SavedDraft<T>[];
  title: string;
  newLabel: string;
  describe: (value: T) => string;
  onResume: (id: string) => void;
  onNew: () => void;
  onDiscard: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  return <div className="order-draft-list">
    <strong>{title}</strong>
    <span>Elegí cuál retomar o empezá uno nuevo. Los demás quedan guardados en este navegador.</span>
    <div className="order-draft-list-actions"><button type="button" className="primary" onClick={onNew}>{newLabel}</button></div>
    {drafts.map(entry => <article className="order-draft-entry" key={entry.id}>
      <div><strong>{describe(entry.value)}</strong><small>Guardado {new Date(entry.updatedAt).toLocaleString("es-UY")}</small></div>
      <div>
        <button type="button" className="secondary" onClick={() => onResume(entry.id)}>Retomar borrador</button>
        {deleting === entry.id ? <><button type="button" className="secondary" onClick={() => { onDiscard(entry.id); setDeleting(null); }}>Confirmar eliminación</button><button type="button" onClick={() => setDeleting(null)}>Cancelar</button></> : <button type="button" onClick={() => setDeleting(entry.id)}>Eliminar</button>}
      </div>
    </article>)}
  </div>;
}
