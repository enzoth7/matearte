import type { PointerEventHandler } from "react";
import { RIM_VIEWBOX_SIZE, type RimGeometryProfile } from "../catalog/rimGeometry";
import { rimIconCatalog } from "../catalog/rimIconCatalog";
import type { CustomImageAsset, ElementTransform } from "../types/customizer";

interface RimIconLayerProps {
  selectedImageId: string | null;
  customImage?: CustomImageAsset | null;
  profile: RimGeometryProfile;
  transform?: ElementTransform;
  selected?: boolean;
  onPointerDown?: PointerEventHandler<SVGGElement>;
  onResizeDown?: PointerEventHandler<SVGGElement>;
}

export function RimIconLayer({
  selectedImageId,
  customImage,
  profile,
  transform,
  selected,
  onPointerDown,
  onResizeDown,
}: RimIconLayerProps) {
  const catalogIcon = rimIconCatalog.find((item) => item.id === selectedImageId);
  const src = customImage?.previewUrl || catalogIcon?.src;
  if (!src) return null;

  const x = (transform?.x ?? 0.5) * RIM_VIEWBOX_SIZE;
  const y = (transform?.y ?? 0.878) * RIM_VIEWBOX_SIZE;
  const scale = transform?.scale ?? 1;
  const size = profile.iconPlacement.size * scale;
  const halfSize = size / 2;
  const radiusKnockout = Math.max(70, halfSize * 1.35);
  const hitRadius = Math.max(85, halfSize * 1.55);
  const selectionRadius = Math.max(80, halfSize * 1.45);
  const handleOffset = selectionRadius * 0.707;

  return (
    <g
      onPointerDown={onPointerDown}
      className={onPointerDown ? "cursor-grab active:cursor-grabbing" : undefined}
      style={{ touchAction: "none" }}
    >
      <circle cx={x} cy={y} r={radiusKnockout} fill="#EAE4DC" />
      <circle cx={x} cy={y} r={hitRadius} fill="transparent" pointerEvents={onPointerDown ? "all" : "none"} />
      {selected && (
        <g pointerEvents="none">
          <circle cx={x} cy={y} r={selectionRadius} fill="none" stroke="#7a4a31" strokeWidth="5" strokeDasharray="18 12" />
          {onResizeDown && (
            <circle 
              cx={x + handleOffset} cy={y + handleOffset} r={16} 
              fill="#fff" stroke="#7a4a31" strokeWidth="4"
              pointerEvents="all"
              onPointerDown={(e) => {
                e.stopPropagation();
                onResizeDown(e);
              }}
              className="cursor-nwse-resize"
            />
          )}
        </g>
      )}
      <image
        href={src}
        x={x - halfSize}
        y={y - halfSize}
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
        pointerEvents="none"
      />
    </g>
  );
}

