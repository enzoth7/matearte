import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { getRimFinish } from "../catalog/rimFinishCatalog";
import type { RimCustomization } from "../catalog/rimCatalog";
import { getRimGeometryProfile, RIM_VIEWBOX_SIZE } from "../catalog/rimGeometry";
import type { MateModel } from "../catalog/mateCatalog";
import type { EngravingTypeId } from "../catalog/mateDecisionCatalog";
import type { ElementTransform, RimTextElement } from "../types/customizer";
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
  onToggleInvert?: (id: string) => void;
  placingElementId?: string | null;
  onPlacementComplete?: () => void;
  engravingTypeId?: EngravingTypeId | null;
}

interface DragState {
  elementId: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  startAngle: number;
  initialRotation: number;
  initialScale: number;
  mode: "move" | "resize";
}

export function ConfiguratorPreview({
  rim,
  model,
  editable = false,
  selectedElement,
  onSelectElement,
  onTransformChange,
  onToggleInvert,
  placingElementId,
  onPlacementComplete,
}: ConfiguratorPreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const finish = rim.finishMode === "finish" ? getRimFinish(rim.finishId) : undefined;
  const profile = getRimGeometryProfile(model);

  const texts: RimTextElement[] = rim.texts && rim.texts.length > 0
    ? rim.texts
    : [
        {
          id: "text-1",
          text: rim.text || "",
          inverted: false,
          transform: rim.textTransform,
        },
        {
          id: "text-2",
          text: "",
          inverted: true,
          transform: { ...rim.textTransform, rotation: 0 },
        },
      ];

  const hasTextKnockout = rim.textMode === "text" && texts.some((t) => Boolean(t.text.trim()));

  const pointFromEvent = (event: ReactPointerEvent) => {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0.5, y: 0.5 };
    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
  };

  const getTextElement = (id: string): RimTextElement | undefined => {
    if (id === "text" || id === "text-1") return texts[0];
    if (id === "text-2") return texts[1];
    return texts.find((t) => t.id === id);
  };

  const getElementTransform = (id: string): ElementTransform => {
    if (id === "text" || id === "text-1") return texts[0]?.transform ?? rim.textTransform;
    if (id === "text-2") return texts[1]?.transform ?? rim.textTransform;
    const textItem = texts.find((t) => t.id === id);
    if (textItem) return textItem.transform;
    const icon = rim.icons.find((i) => i.id === id);
    if (icon) return icon.transform;
    return rim.textTransform;
  };

  const constrainIconPoint = (x: number, y: number) => {
    const dx = x - 0.5;
    const dy = y - 0.5;
    const distance = Math.hypot(dx, dy);
    const targetRadius = Math.min(profile.radiusBounds.max, Math.max(profile.radiusBounds.min, distance));

    if (distance === 0) return { x: 0.5, y: 0.5 + targetRadius };
    const ratio = targetRadius / distance;
    return { x: 0.5 + dx * ratio, y: 0.5 + dy * ratio };
  };

  const beginDrag = (id: string, event: ReactPointerEvent<SVGGElement>, mode: "move" | "resize" = "move") => {
    if (!editable || !onTransformChange) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);
    const transform = getElementTransform(id);
    const pointerAngle = Math.atan2(point.y - 0.5, point.x - 0.5) * (180 / Math.PI);

    dragRef.current = {
      elementId: id,
      pointerId: event.pointerId,
      offsetX: transform.x - point.x,
      offsetY: transform.y - point.y,
      startAngle: pointerAngle,
      initialRotation: transform.rotation || 0,
      initialScale: transform.scale || 1,
      mode,
    };
    svgRef.current?.setPointerCapture(event.pointerId);
    onSelectElement?.(id);
  };

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || !onTransformChange || drag.pointerId !== event.pointerId) return;
    const point = pointFromEvent(event);
    const current = getElementTransform(drag.elementId);
    const isTextElement = drag.elementId === "text" || drag.elementId.startsWith("text");

    if (isTextElement) {
      if (drag.mode === "resize") {
        const textElem = getTextElement(drag.elementId);
        const isInverted = textElem?.inverted ?? false;
        const baseAngle = isInverted ? 90 : 270;
        const currentRotation = current.rotation || 0;
        const totalRad = (baseAngle + currentRotation) * (Math.PI / 180);
        const radiusNorm = profile.textGeometry.radius / RIM_VIEWBOX_SIZE;
        const textCenterX = 0.5 + Math.cos(totalRad) * radiusNorm;
        const textCenterY = 0.5 + Math.sin(totalRad) * radiusNorm;
        const dist = Math.hypot(point.x - textCenterX, point.y - textCenterY);
        const newScale = Math.min(1.6, Math.max(0.5, dist / 0.18));
        onTransformChange(drag.elementId, {
          ...current,
          scale: Math.round(newScale * 100) / 100,
        });
        return;
      }

      // Circular track rotation (train on circular tracks)
      const currentAngle = Math.atan2(point.y - 0.5, point.x - 0.5) * (180 / Math.PI);
      let deltaAngle = currentAngle - drag.startAngle;
      while (deltaAngle > 180) deltaAngle -= 360;
      while (deltaAngle < -180) deltaAngle += 360;

      let newRotation = drag.initialRotation + deltaAngle;
      while (newRotation > 180) newRotation -= 360;
      while (newRotation < -180) newRotation += 360;

      onTransformChange(drag.elementId, {
        ...current,
        rotation: Math.round(newRotation * 10) / 10,
        x: 0.5,
        y: 0.5,
      });
      return;
    }

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

    // Icon move mode with polar constraints on the virola ring
    const targetX = point.x + drag.offsetX;
    const targetY = point.y + drag.offsetY;
    const constrained = constrainIconPoint(targetX, targetY);

    onTransformChange(drag.elementId, {
      ...current,
      x: constrained.x,
      y: constrained.y,
    });
  };

  const placeElement = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!placingElementId || !onTransformChange) {
      onSelectElement?.(null);
      return;
    }

    event.preventDefault();
    const point = pointFromEvent(event);
    const constrained = constrainIconPoint(point.x, point.y);
    onTransformChange(placingElementId, {
      ...getElementTransform(placingElementId),
      x: constrained.x,
      y: constrained.y,
    });
    onSelectElement?.(placingElementId);
    onPlacementComplete?.();
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
        className={`absolute inset-0 h-full w-full ${editable ? "touch-none select-none" : "pointer-events-none"} ${placingElementId ? "rim-placement-cursor" : ""}`}
        role={editable ? "application" : undefined}
        aria-label={editable ? placingElementId ? "Elegí un punto de la virola para ubicar la imagen" : "Arrastrá el texto o la imagen para moverlos dentro de la virola" : undefined}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={placeElement}
      >
        <image href="/assets/plantillas/virola/base.svg" x="0" y="0" width={RIM_VIEWBOX_SIZE} height={RIM_VIEWBOX_SIZE} preserveAspectRatio="xMidYMid meet" />
        <RimFinishLayer
          finish={finish}
          hasTextKnockout={hasTextKnockout}
          texts={texts}
          textGeometry={profile.textGeometry}
        />
        {rim.textMode === "text" && texts.map((t, index) => {
          const isSelected = editable && (selectedElement === t.id || (selectedElement === "text" && index === 0));
          return (
            <CircularRimText
              key={t.id}
              id={t.id}
              text={t.text}
              geometry={profile.textGeometry}
              transform={t.transform}
              inverted={t.inverted}
              selected={isSelected}
              onPointerDown={editable && !placingElementId ? (event) => beginDrag(t.id, event) : undefined}
              onResizeDown={editable && !placingElementId ? (event) => beginDrag(t.id, event, "resize") : undefined}
              onToggleInvert={editable && onToggleInvert ? () => onToggleInvert(t.id) : undefined}
            />
          );
        })}
        {rim.imageMode === "image" && rim.icons.map(icon => (
          <RimIconLayer
            key={icon.id}
            selectedImageId={icon.selectedImageId}
            customImage={icon.customImage}
            profile={profile}
            transform={icon.transform}
            selected={editable && selectedElement === icon.id}
            onPointerDown={editable && !placingElementId ? (event) => beginDrag(icon.id, event) : undefined}
            onResizeDown={editable && !placingElementId ? (event) => beginDrag(icon.id, event, "resize") : undefined}
          />
        ))}
        <image href="/assets/plantillas/virola/contorno.svg" x="0" y="0" width={RIM_VIEWBOX_SIZE} height={RIM_VIEWBOX_SIZE} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />
        <image href="/assets/plantillas/virola/centro.svg" x="0" y="0" width={RIM_VIEWBOX_SIZE} height={RIM_VIEWBOX_SIZE} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />
      </svg>
    </div>
  );
}
