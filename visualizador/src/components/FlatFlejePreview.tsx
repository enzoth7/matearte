import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { rimIconCatalog } from "../catalog/rimIconCatalog";
import { getFlejeFinish } from "../catalog/flejeFinishCatalog";
import type { EditableElement, ElementTransform, FlejeCustomization, FlejeSide, FlejeSideCustomization } from "../types/customizer";

export type { FlejeCustomization } from "../types/customizer";

export interface FlatFlejePreviewProps {
  flejeConfig: FlejeCustomization;
  activeSide?: FlejeSide;
  editable?: boolean;
  selectedElement?: EditableElement | null;
  onSelectSide?: (side: FlejeSide) => void;
  onSelectElement?: (element: EditableElement | null) => void;
  onTransformChange?: (side: FlejeSide, element: EditableElement, transform: ElementTransform) => void;
  showSideToggle?: boolean;
}
interface FlejeSurfaceProps {
  side: FlejeSide;
  config: FlejeSideCustomization;
  finishSrc?: string;
  isActive?: boolean;
  editable?: boolean;
  selectedElement?: EditableElement | null;
  onSelectSide?: (side: FlejeSide) => void;
  onSelectElement?: (element: EditableElement | null) => void;
  onTransformChange?: (side: FlejeSide, element: EditableElement, transform: ElementTransform) => void;
}

// Fleje base rectangle in 1254x1254 Figma coordinate space
const FLEJE_X = 127.5;
const FLEJE_Y = 507.5;
const FLEJE_WIDTH = 999;
const FLEJE_HEIGHT = 239;

interface DragState {
  element: EditableElement;
  mode: "move" | "resize";
  pointerId: number;
  offsetX: number;
  offsetY: number;
  initialScale: number;
  initialDist: number;
}

function FlejeSurface({
  side,
  config,
  finishSrc,
  isActive = false,
  editable = false,
  selectedElement,
  onSelectSide,
  onSelectElement,
  onTransformChange,
}: FlejeSurfaceProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const catalogIcon = rimIconCatalog.find((item) => item.id === config.selectedImageId);
  const imageSource = config.customImage?.id === config.selectedImageId ? config.customImage.previewUrl : catalogIcon?.src;

  const pointFromEvent = (event: ReactPointerEvent) => {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0.5, y: 0.5 };
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const getTransform = (element: EditableElement): ElementTransform => {
    if (element === "text") return config.textTransform;
    if (element === "image") return config.imageTransform;
    return config.finishTransform ?? { x: 0.5, y: 0.5, scale: 1, rotation: 0, side };
  };

  const beginDrag = (element: EditableElement, event: ReactPointerEvent<SVGElement>) => {
    if (!editable || !onTransformChange) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectSide?.(side);
    const point = pointFromEvent(event);
    const transform = getTransform(element);
    dragRef.current = {
      element,
      mode: "move",
      pointerId: event.pointerId,
      offsetX: transform.x - point.x,
      offsetY: transform.y - point.y,
      initialScale: transform.scale || 1,
      initialDist: 0.1,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectElement?.(element);
  };

  const beginResize = (element: EditableElement, event: ReactPointerEvent<SVGElement>) => {
    if (!editable || !onTransformChange) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectSide?.(side);
    const point = pointFromEvent(event);
    const transform = getTransform(element);
    const elemCenterX = transform.x;
    const elemCenterY = transform.y;
    const initialDist = Math.hypot(point.x - elemCenterX, (point.y - elemCenterY) * (FLEJE_HEIGHT / FLEJE_WIDTH));
    dragRef.current = {
      element,
      mode: "resize",
      pointerId: event.pointerId,
      offsetX: 0,
      offsetY: 0,
      initialScale: transform.scale || 1,
      initialDist: Math.max(0.02, initialDist),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectElement?.(element);
  };

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !onTransformChange) return;
    const point = pointFromEvent(event);
    const transform = getTransform(drag.element);

    if (drag.mode === "resize") {
      const elemCenterX = transform.x;
      const elemCenterY = transform.y;
      const currentDist = Math.hypot(point.x - elemCenterX, (point.y - elemCenterY) * (FLEJE_HEIGHT / FLEJE_WIDTH));
      const ratio = currentDist / drag.initialDist;
      const newScale = Math.min(1.6, Math.max(0.5, drag.initialScale * ratio));
      onTransformChange(side, drag.element, {
        ...transform,
        scale: Math.round(newScale * 100) / 100,
      });
      return;
    }

    onTransformChange(side, drag.element, {
      ...transform,
      x: Math.min(1.2, Math.max(-0.2, point.x + drag.offsetX)),
      y: Math.min(1.2, Math.max(-0.2, point.y + drag.offsetY)),
    });
  };

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const clipId = `fleje-clip-${side}`;

  // Calculated SVG coordinates
  const textX = FLEJE_X + config.textTransform.x * FLEJE_WIDTH;
  const textY = FLEJE_Y + config.textTransform.y * FLEJE_HEIGHT;
  const textScale = config.textTransform.scale ?? 1;

  const iconX = FLEJE_X + config.imageTransform.x * FLEJE_WIDTH;
  const iconY = FLEJE_Y + config.imageTransform.y * FLEJE_HEIGHT;
  const iconScale = config.imageTransform.scale ?? 1;
  const iconSize = 90 * iconScale;

  return (
    <div
      className={`relative w-full aspect-[999/239] transition-all cursor-pointer select-none ${
        editable && isActive ? "ring-2 ring-[#7a4a31] ring-offset-2" : ""
      }`}
      onPointerDown={() => {
        onSelectSide?.(side);
        onSelectElement?.(null);
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`${FLEJE_X} ${FLEJE_Y} ${FLEJE_WIDTH} ${FLEJE_HEIGHT}`}
        className="w-full h-full block"
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={FLEJE_X} y={FLEJE_Y} width={FLEJE_WIDTH} height={FLEJE_HEIGHT} />
          </clipPath>
        </defs>

        {/* Base Solid Background Rectangle */}
        <rect
          x={FLEJE_X}
          y={FLEJE_Y}
          width={FLEJE_WIDTH}
          height={FLEJE_HEIGHT}
          fill="#FFFFFF"
          stroke="black"
          strokeWidth="3"
        />

        {/* Pattern Finish Overlay - Fixed 1:1 Pixel Registration from Figma Frame */}
        {finishSrc && (
          <g clipPath={`url(#${clipId})`}>
            <image
              href={finishSrc}
              x="0"
              y="0"
              width="1254"
              height="1254"
              style={{ mixBlendMode: "multiply", opacity: 0.95 }}
              preserveAspectRatio="none"
              pointerEvents="none"
            />
          </g>
        )}

        {/* Engraved Text with Matching Rounded Pill Backdrop */}
        {config.textMode === "text" && config.text.trim() && (() => {
          const charCount = config.text.trim().length;
          const pillWidth = Math.max(120, charCount * 46 + 48);
          const pillHeight = 86;
          return (
            <g
              transform={`translate(${textX}, ${textY}) rotate(${config.textTransform.rotation}) scale(${textScale})`}
              onPointerDown={(e) => beginDrag("text", e)}
              className={editable ? "cursor-grab active:cursor-grabbing" : undefined}
            >
              {/* Rounded pill covering the finish lines */}
              <rect
                x={-pillWidth / 2}
                y={-pillHeight / 2}
                width={pillWidth}
                height={pillHeight}
                rx={18}
                ry={18}
                fill="#FFFFFF"
              />
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#000000"
                fontFamily="Georgia, 'Times New Roman', serif"
                fontSize="68"
                fontWeight="900"
                letterSpacing="3"
              >
                {config.text.toUpperCase()}
              </text>
              {editable && isActive && selectedElement === "text" && (
                <g>
                  <rect
                    x={-pillWidth / 2 - 4}
                    y={-pillHeight / 2 - 4}
                    width={pillWidth + 8}
                    height={pillHeight + 8}
                    rx={22}
                    ry={22}
                    fill="none"
                    stroke="#7a4a31"
                    strokeWidth="3"
                    strokeDasharray="10 8"
                    pointerEvents="none"
                  />
                  {/* Resize Button Handle for Text */}
                  <g
                    transform={`translate(${pillWidth / 2 + 10}, ${pillHeight / 2 + 10})`}
                    pointerEvents="all"
                    className="cursor-nwse-resize"
                    onPointerDown={(e) => beginResize("text", e)}
                  >
                    <circle
                      r="16"
                      fill="#ffffff"
                      stroke="#7a4a31"
                      strokeWidth="3.5"
                      className="filter drop-shadow-md"
                    />
                    <text
                      x="0"
                      y="1"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#7a4a31"
                      fontSize="13"
                      fontWeight="bold"
                      pointerEvents="none"
                    >
                      ⤢
                    </text>
                  </g>
                </g>
              )}
            </g>
          );
        })()}

        {/* Engraved Icon with Matching Circular Backdrop */}
        {config.imageMode === "image" && imageSource && (
          <g
            transform={`translate(${iconX}, ${iconY}) rotate(${config.imageTransform.rotation})`}
            onPointerDown={(e) => beginDrag("image", e)}
            className={editable ? "cursor-grab active:cursor-grabbing" : undefined}
          >
            {/* Circle covering the finish lines */}
            <circle
              cx="0"
              cy="0"
              r={iconSize * 0.62}
              fill="#FFFFFF"
            />
            <image
              href={imageSource}
              x={-iconSize / 2}
              y={-iconSize / 2}
              width={iconSize}
              height={iconSize}
              preserveAspectRatio="xMidYMid meet"
            />
            {editable && isActive && selectedElement === "image" && (
              <g>
                <circle
                  cx="0"
                  cy="0"
                  r={iconSize * 0.68}
                  fill="none"
                  stroke="#7a4a31"
                  strokeWidth="3"
                  strokeDasharray="10 8"
                  pointerEvents="none"
                />
                {/* Resize Button Handle for Icon */}
                <g
                  transform={`translate(${iconSize * 0.52}, ${iconSize * 0.52})`}
                  pointerEvents="all"
                  className="cursor-nwse-resize"
                  onPointerDown={(e) => beginResize("image", e)}
                >
                  <circle
                    r="16"
                    fill="#ffffff"
                    stroke="#7a4a31"
                    strokeWidth="3.5"
                    className="filter drop-shadow-md"
                  />
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#7a4a31"
                    fontSize="13"
                    fontWeight="bold"
                    pointerEvents="none"
                  >
                    ⤢
                  </text>
                </g>
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}

export function FlatFlejePreview({
  flejeConfig,
  activeSide = "front",
  editable = false,
  selectedElement,
  onSelectSide,
  onSelectElement,
  onTransformChange,
}: FlatFlejePreviewProps) {
  const finish = flejeConfig.finishMode === "finish" ? getFlejeFinish(flejeConfig.finishId) : undefined;

  return (
    <div className="flex w-full max-w-[520px] flex-col items-center justify-center gap-6 py-2" aria-label="Vista del fleje metálico">
      <FlejeSurface
        side="front"
        config={flejeConfig.sides.front}
        finishSrc={finish?.src}
        isActive={activeSide === "front"}
        editable={editable}
        selectedElement={selectedElement}
        onSelectSide={onSelectSide}
        onSelectElement={onSelectElement}
        onTransformChange={onTransformChange}
      />
      <FlejeSurface
        side="back"
        config={flejeConfig.sides.back}
        finishSrc={finish?.src}
        isActive={activeSide === "back"}
        editable={editable}
        selectedElement={selectedElement}
        onSelectSide={onSelectSide}
        onSelectElement={onSelectElement}
        onTransformChange={onTransformChange}
      />
    </div>
  );
}
