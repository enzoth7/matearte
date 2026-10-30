import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export type ProductCoverCrop = {
  x: number;
  y: number;
  zoom: number;
};

type ProductCoverEditorProps = {
  imageUrl: string;
  imageAlt: string;
  initialCrop: ProductCoverCrop;
  busy: boolean;
  onCancel: () => void;
  onSave: (crop: ProductCoverCrop) => void;
  eyebrow?: string;
  saveLabel?: string;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function cropLimits(imageRatio: number, zoom: number) {
  const width = imageRatio >= 1 ? 1 : imageRatio;
  const height = imageRatio >= 1 ? 1 / imageRatio : 1;
  const square = Math.min(width, height);
  return {
    x: Math.max(0, ((width * zoom - square) / (2 * width)) * 100),
    y: Math.max(0, ((height * zoom - square) / (2 * height)) * 100),
  };
}

export function ProductCoverEditor({ imageUrl, imageAlt, initialCrop, busy, onCancel, onSave, eyebrow = 'Portada del catálogo', saveLabel = 'Guardar portada' }: ProductCoverEditorProps) {
  const [crop, setCrop] = useState(initialCrop);
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const dragStart = useRef<{ pointerX: number; pointerY: number; cropX: number; cropY: number } | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [busy, onCancel]);

  useEffect(() => {
    if (imageRatio === null) return;
    const limits = cropLimits(imageRatio, crop.zoom);
    setCrop(current => ({ ...current, x: clamp(current.x, -limits.x, limits.x), y: clamp(current.y, -limits.y, limits.y) }));
  }, [imageRatio, crop.zoom]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerX: event.clientX, pointerY: event.clientY, cropX: crop.x, cropY: crop.y };
  };

  const drag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const limits = cropLimits(imageRatio ?? 1, crop.zoom);
    setCrop(current => ({
      ...current,
      x: clamp(dragStart.current!.cropX + ((event.clientX - dragStart.current!.pointerX) / (bounds.width || 1)) * 100, -limits.x, limits.x),
      y: clamp(dragStart.current!.cropY + ((event.clientY - dragStart.current!.pointerY) / (bounds.height || 1)) * 100, -limits.y, limits.y),
    }));
  };

  const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragStart.current = null;
  };

  return (
    <div className="cover-editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="cover-editor" role="dialog" aria-modal="true" aria-labelledby="cover-editor-title">
        <div className="cover-editor-heading">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h3 id="cover-editor-title">Ajustá el encuadre</h3>
          </div>
          <button className="cover-editor-close" type="button" onClick={onCancel} disabled={busy} aria-label="Cerrar editor">×</button>
        </div>

        <div className="cover-editor-help">La foto se muestra completa. El cuadrado indica qué parte aparecerá en el catálogo: arrastrá para acomodarla y usá el control inferior para acercarla.</div>

        <div
          className="cover-editor-stage"
          style={{ aspectRatio: imageRatio ?? 1, width: `min(28rem, ${55 * (imageRatio ?? 1)}vh, 100%)` }}
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          <img
            src={imageUrl}
            alt={imageAlt}
            draggable={false}
            onLoad={event => {
              const image = event.currentTarget;
              if (image.naturalWidth && image.naturalHeight) setImageRatio(image.naturalWidth / image.naturalHeight);
            }}
            style={{ transform: `translate(${crop.x}%, ${crop.y}%) scale(${crop.zoom})` }}
          />
          <div className={`cover-editor-guide ${(imageRatio ?? 1) >= 1 ? 'cover-editor-guide--landscape' : 'cover-editor-guide--portrait'}`} aria-hidden="true" />
        </div>

        <label className="cover-editor-zoom">
          <div>Zoom</div>
          <input
            type="range"
            min="1"
            max="2.5"
            step="0.01"
            value={crop.zoom}
            onChange={event => {
              const zoom = Number(event.target.value);
              const limits = cropLimits(imageRatio ?? 1, zoom);
              setCrop(current => ({
                zoom,
                x: clamp(current.x, -limits.x, limits.x),
                y: clamp(current.y, -limits.y, limits.y),
              }));
            }}
          />
          <output>{Math.round(crop.zoom * 100)}%</output>
        </label>

        <div className="cover-editor-actions">
          <button className="cover-editor-reset" type="button" disabled={busy} onClick={() => setCrop({ x: 0, y: 0, zoom: 1 })}>Restablecer</button>
          <div>
            <button className="cover-editor-cancel" type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
            <button type="button" disabled={busy} onClick={() => onSave(crop)}>{busy ? 'Guardando…' : saveLabel}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
