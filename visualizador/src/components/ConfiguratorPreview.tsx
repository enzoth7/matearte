import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { getRimFinish } from "../catalog/rimFinishCatalog";
import type { RimCustomization } from "../catalog/rimCatalog";
import { getRimGeometryProfile, RIM_VIEWBOX_SIZE } from "../catalog/rimGeometry";
import type { MateModel } from "../catalog/mateCatalog";
import type { EditableElement, ElementTransform } from "../types/customizer";
import { CircularRimText } from "./CircularRimText";
import { RimFinishLayer } from "./RimFinishLayer";
import { RimIconLayer } from "./RimIconLayer";

interface ConfiguratorPreviewProps {
  rim: RimCustomization;
  model: MateModel;
  editable?: boolean;
  selectedElement?: EditableElement | null;
  onSelectElement?: (element: EditableElement) => void;
  onTransformChange?: (element: EditableElement, transform: ElementTransform) => void;
}
interface DragState {
  element: EditableElement;
  pointerId: number;
  offsetX: number;
  offsetY: number;
}

export function ConfiguratorPreview({
  rim,
  model,
  editable = false,
  selectedElement,
  onSelectElement,
  onTransformChange,
}: ConfiguratorPreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const finish = rim.finishMode === "finish" ? getRimFinish(rim.finishId) : undefined;
  const hasTextKnockout = rim.textMode === "text" && Boolean(rim.text.trim());
  const profile = getRimGeometryProfile(model);

  const pointFromEvent = (event: ReactPointerEvent) => {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0.5, y: 0.5 };
    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
  };

  const beginDrag = (element: EditableElement, event: ReactPointerEvent<SVGGElement>) => {
    if (!editable || !onTransformChange) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);
    const transform = element === "text" ? rim.textTransform : rim.imageTransform;
    dragRef.current = {
      element,
      pointerId: event.pointerId,
      offsetX: transform.x - point.x,
      offsetY: transform.y - point.y,
    };
    svgRef.current?.setPointerCapture(event.pointerId);
    onSelectElement?.(element);
  };

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || !onTransformChange || drag.pointerId !== event.pointerId) return;
    const point = pointFromEvent(event);
    const current = drag.element === "text" ? rim.textTransform : rim.imageTransform;
    onTransformChange(drag.element, {
      ...current,
      x: Math.min(profile.bounds.maxX, Math.max(profile.bounds.minX, point.x + drag.offsetX)),
      y: Math.min(profile.bounds.maxY, Math.max(profile.bounds.minY, point.y + drag.offsetY)),
    });
  };

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  return (
    <div className="relative aspect-square w-full max-w-[540px] overflow-hidden" aria-label={`Vista editable de la virola ${model}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${RIM_VIEWBOX_SIZE} ${RIM_VIEWBOX_SIZE}`}
        className={`absolute inset-0 h-full w-full ${editable ? "touch-none select-none" : "pointer-events-none"}`}
        role={editable ? "application" : undefined}
        aria-label={editable ? "Arrastrá el texto o la imagen para moverlos dentro de la virola" : undefined}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <image href="/assets/svg/rim-base.svg" x="0" y="0" width={RIM_VIEWBOX_SIZE} height={RIM_VIEWBOX_SIZE} preserveAspectRatio="xMidYMid meet" />
        <RimFinishLayer
          finish={finish}
          hasTextKnockout={hasTextKnockout}
          text={rim.text}
          textGeometry={profile.textGeometry}
          textTransform={rim.textTransform}
        />
        {rim.textMode === "text" && (
          <CircularRimText
            text={rim.text}
            geometry={profile.textGeometry}
            transform={rim.textTransform}
            selected={editable && selectedElement === "text"}
            onPointerDown={editable ? (event) => beginDrag("text", event) : undefined}
          />
        )}
        {rim.imageMode === "image" && (
          <RimIconLayer
            selectedImageId={rim.selectedImageId}
            customImage={rim.customImage}
            profile={profile}
            transform={rim.imageTransform}
            selected={editable && selectedElement === "image"}
            onPointerDown={editable ? (event) => beginDrag("image", event) : undefined}
          />
        )}
        <image href="/assets/svg/rim-outline.svg" x="0" y="0" width={RIM_VIEWBOX_SIZE} height={RIM_VIEWBOX_SIZE} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />
        <image href="/assets/svg/rim-center.svg" x="0" y="0" width={RIM_VIEWBOX_SIZE} height={RIM_VIEWBOX_SIZE} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />
      </svg>
      {editable && <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-[#5f3826] shadow-sm">Arrastrá para mover</p>}
    </div>
  );
}
