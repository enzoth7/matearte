import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { rimIconCatalog } from "../catalog/rimIconCatalog";
import { getFlejeFinish } from "../catalog/flejeFinishCatalog";
import type { EditableElement, ElementTransform, FlejeCustomization, FlejeSide, FlejeSideCustomization } from "../types/customizer";

export type { FlejeCustomization } from "../types/customizer";

interface FlatFlejePreviewProps {
  flejeConfig: FlejeCustomization;
  activeSide?: FlejeSide;
  editable?: boolean;
  selectedElement?: EditableElement | null;
  onSelectSide?: (side: FlejeSide) => void;
  onSelectElement?: (element: EditableElement) => void;
  onTransformChange?: (side: FlejeSide, element: EditableElement, transform: ElementTransform) => void;
}
interface FlejeFaceProps extends Omit<FlatFlejePreviewProps, "flejeConfig"> {
  side: FlejeSide;
  config: FlejeSideCustomization;
  finishSrc?: string;
}

function FlejeFace({
  side,
  config,
  finishSrc,
  activeSide,
  editable,
  selectedElement,
  onSelectSide,
  onSelectElement,
  onTransformChange,
}: FlejeFaceProps) {
  const faceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ element: EditableElement; pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const catalogIcon = rimIconCatalog.find((item) => item.id === config.selectedImageId);
  const imageSource = config.customImage?.id === config.selectedImageId ? config.customImage.previewUrl : catalogIcon?.src;
  const isActive = !editable || activeSide === side;

  const pointFromEvent = (event: ReactPointerEvent) => {
    const bounds = faceRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0.5, y: 0.5 };
    return { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
  };

  const beginDrag = (element: EditableElement, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editable || !isActive || !onTransformChange) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);
    const transform = element === "text" ? config.textTransform : config.imageTransform;
    dragRef.current = { element, pointerId: event.pointerId, offsetX: transform.x - point.x, offsetY: transform.y - point.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectElement?.(element);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !onTransformChange) return;
    const point = pointFromEvent(event);
    const transform = drag.element === "text" ? config.textTransform : config.imageTransform;
    onTransformChange(side, drag.element, {
      ...transform,
      x: Math.min(0.9, Math.max(0.1, point.x + drag.offsetX)),
      y: Math.min(0.78, Math.max(0.22, point.y + drag.offsetY)),
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const layer = (element: EditableElement, transform: ElementTransform, content: ReactNode) => (
    <div
      onPointerDown={(event) => beginDrag(element, event)}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`absolute flex touch-none select-none items-center justify-center ${editable && isActive ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"} ${editable && isActive && selectedElement === element ? "rounded-lg outline-2 outline-dashed outline-offset-4 outline-[#7a4a31]" : ""}`}
      style={{
        left: `${transform.x * 100}%`,
        top: `${transform.y * 100}%`,
        transform: `translate(-50%, -50%) rotate(${transform.rotation}deg) scale(${transform.scale})`,
      }}
    >
      {content}
    </div>
  );

  return (
    <button
      type="button"
      onClick={() => editable && onSelectSide?.(side)}
      aria-pressed={editable ? activeSide === side : undefined}
      className={`w-full rounded-2xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a4a31] ${
        editable && activeSide === side ? "border-[#7a4a31] bg-[#fbf3de] ring-2 ring-[#7a4a31]/20" : "border-[#e7d7c1] bg-white"
      }`}
    >
      <span className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[#5f3826]">
        {side === "front" ? "Frente" : "Dorso"}
        {editable && activeSide === side && <span className="normal-case tracking-normal text-[#7a4a31]">Editando</span>}
      </span>
      <div
        ref={faceRef}
        data-fleje-face
        className="relative aspect-[3/1] overflow-hidden rounded-xl border border-[#bca98f] bg-[linear-gradient(180deg,#f7f3ea_0%,#c8bda9_45%,#f5efe3_100%)] shadow-inner"
      >
        {finishSrc && <img src={finishSrc} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45 mix-blend-multiply" draggable={false} />}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/80" />
        {config.textMode === "text" && config.text.trim() && layer("text", config.textTransform, (
          <span className="whitespace-nowrap font-serif text-[clamp(15px,4vw,34px)] font-black uppercase tracking-wider text-[#2d1d14] drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">{config.text}</span>
        ))}
        {config.imageMode === "image" && imageSource && layer("image", config.imageTransform, (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e7dfd2]/90 p-2 shadow-inner md:h-20 md:w-20">
            <img src={imageSource} alt="" className="h-full w-full object-contain" draggable={false} />
          </span>
        ))}
        {editable && activeSide === side && <span className="pointer-events-none absolute bottom-1.5 right-2 text-[9px] font-bold text-[#5f3826]/65">Arrastrá para mover</span>}
      </div>
    </button>
  );
}

export function FlatFlejePreview({ flejeConfig, ...props }: FlatFlejePreviewProps) {
  const finish = flejeConfig.finishMode === "finish" ? getFlejeFinish(flejeConfig.finishId) : undefined;
  return (
    <div className="grid w-full gap-3" aria-label="Vista editable del frente y dorso del fleje">
      {(["front", "back"] as FlejeSide[]).map((side) => (
        <FlejeFace key={side} side={side} config={flejeConfig.sides[side]} finishSrc={finish?.src} {...props} />
      ))}
    </div>
  );
}
