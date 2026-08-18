import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { getRimFinish } from "../catalog/rimFinishCatalog";
import type { RimCustomization } from "../catalog/rimCatalog";
import { getRimGeometryProfile, RIM_VIEWBOX_SIZE } from "../catalog/rimGeometry";
import type { MateModel } from "../catalog/mateCatalog";
import type { ElementTransform } from "../types/customizer";
import { CircularRimText } from "./CircularRimText";
import { RimFinishLayer } from "./RimFinishLayer";
import { RimIconLayer } from "./RimIconLayer";

interface ConfiguratorPreviewProps {
  rim: RimCustomization;
  model: MateModel;
  editable?: boolean;
  selectedElement?: string | null;
  onSelectElement?: (id: string | null) => void;
  onTransformChange?: (id: string, transform: ElementTransform) => void;
}
interface DragState {
  elementId: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  mode: "move" | "resize";
  initialScale: number;
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

  const getElementTransform = (id: string): ElementTransform => {
    if (id === "text") return rim.textTransform;
    const icon = rim.icons.find(i => i.id === id);
    if (icon) return icon.transform;
    return rim.textTransform; // fallback
  };

  const beginDrag = (id: string, event: ReactPointerEvent<SVGGElement>, mode: "move" | "resize" = "move") => {
    if (!editable || !onTransformChange) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);
    const transform = getElementTransform(id);
    dragRef.current = {
      elementId: id,
      pointerId: event.pointerId,
      offsetX: transform.x - point.x,
      offsetY: transform.y - point.y,
      mode,
      initialScale: transform.scale,
    };
    svgRef.current?.setPointerCapture(event.pointerId);
    onSelectElement?.(id);
  };

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || !onTransformChange || drag.pointerId !== event.pointerId) return;
    const point = pointFromEvent(event);
    const current = getElementTransform(drag.elementId);
    
    if (drag.mode === "resize") {
      const dx = point.x - current.x;
      const dy = point.y - current.y;
      const dist = Math.hypot(dx, dy);
      const newScale = Math.min(1.6, Math.max(0.5, dist / 0.065));
      onTransformChange(drag.elementId, {
        ...current,
        scale: Math.round(newScale * 100) / 100,
      });
      return;
    }

    if (drag.elementId === "text") {
      const targetX = point.x + drag.offsetX;
      const targetY = point.y + drag.offsetY;
      onTransformChange("text", {
        ...current,
        x: Math.min(0.95, Math.max(0.05, targetX)),
        y: Math.min(0.95, Math.max(0.05, targetY)),
      });
      return;
    }

    // Icon move mode with polar constraints on the virola ring
    const targetX = point.x + drag.offsetX;
    const targetY = point.y + drag.offsetY;
    
    // Distance from center of mate (0.5, 0.5)
    const dx = targetX - 0.5;
    const dy = targetY - 0.5;
    const distance = Math.hypot(dx, dy);
    
    let constrainedX = targetX;
    let constrainedY = targetY;

    if (distance > 0 && profile.radiusBounds) {
      if (distance < profile.radiusBounds.min) {
        const ratio = profile.radiusBounds.min / distance;
        constrainedX = 0.5 + dx * ratio;
        constrainedY = 0.5 + dy * ratio;
      } else if (distance > profile.radiusBounds.max) {
        const ratio = profile.radiusBounds.max / distance;
        constrainedX = 0.5 + dx * ratio;
        constrainedY = 0.5 + dy * ratio;
      }
    } else {
      constrainedX = Math.min(0.95, Math.max(0.05, targetX));
      constrainedY = Math.min(0.95, Math.max(0.05, targetY));
    }

    onTransformChange(drag.elementId, {
      ...current,
      x: constrainedX,
      y: constrainedY,
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
        onPointerDown={() => onSelectElement?.(null)}
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
            onResizeDown={editable ? (event) => beginDrag("text", event, "resize") : undefined}
          />
        )}
        {rim.imageMode === "image" && rim.icons.map(icon => (
          <RimIconLayer
            key={icon.id}
            selectedImageId={icon.selectedImageId}
            customImage={icon.customImage}
            profile={profile}
            transform={icon.transform}
            selected={editable && selectedElement === icon.id}
            onPointerDown={editable ? (event) => beginDrag(icon.id, event) : undefined}
            onResizeDown={editable ? (event) => beginDrag(icon.id, event, "resize") : undefined}
          />
        ))}
        <image href="/assets/svg/rim-outline.svg" x="0" y="0" width={RIM_VIEWBOX_SIZE} height={RIM_VIEWBOX_SIZE} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />
        <image href="/assets/svg/rim-center.svg" x="0" y="0" width={RIM_VIEWBOX_SIZE} height={RIM_VIEWBOX_SIZE} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />
      </svg>
      {editable && <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-[#5f3826] shadow-sm">Arrastrá para mover</p>}
    </div>
  );
}
