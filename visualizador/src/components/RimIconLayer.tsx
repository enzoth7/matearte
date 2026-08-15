import type { PointerEventHandler } from "react";
import { calculateRimIconPlacement, type RimGeometryProfile } from "../catalog/rimGeometry";
import { rimIconCatalog } from "../catalog/rimIconCatalog";
import type { CustomImageAsset, ElementTransform } from "../types/customizer";
import { createElementSvgTransform } from "../lib/svgTransform";

interface RimIconLayerProps {
  selectedImageId: string | null;
  customImage?: CustomImageAsset | null;
  profile: RimGeometryProfile;
  transform?: ElementTransform;
  selected?: boolean;
  onPointerDown?: PointerEventHandler<SVGGElement>;
}

export function RimIconLayer({
  selectedImageId,
  customImage,
  profile,
  transform,
  selected,
  onPointerDown,
}: RimIconLayerProps) {
  const catalogIcon = rimIconCatalog.find((item) => item.id === selectedImageId);
  const src = customImage?.id === selectedImageId ? customImage.previewUrl : catalogIcon?.src;
  if (!src) return null;

  const placement = calculateRimIconPlacement(profile.iconPlacement, profile.textGeometry);
  const size = profile.iconPlacement.size;
  const halfSize = size / 2;

  return (
    <g
      transform={createElementSvgTransform(transform, profile.textGeometry)}
      onPointerDown={onPointerDown}
      className={onPointerDown ? "cursor-grab active:cursor-grabbing" : undefined}
      style={{ touchAction: "none" }}
    >
      <circle cx={placement.x} cy={placement.y} r={92} fill="#EAE4DC" />
      <circle cx={placement.x} cy={placement.y} r={112} fill="transparent" pointerEvents={onPointerDown ? "all" : "none"} />
      {selected && <circle cx={placement.x} cy={placement.y} r={105} fill="none" stroke="#7a4a31" strokeWidth="5" strokeDasharray="18 12" pointerEvents="none" />}
      <image
        href={src}
        x={placement.x - halfSize}
        y={placement.y - halfSize}
        width={size}
        height={size}
        transform={`rotate(${placement.rotation} ${placement.x} ${placement.y})`}
        preserveAspectRatio="xMidYMid meet"
        pointerEvents="none"
      />
    </g>
  );
}
