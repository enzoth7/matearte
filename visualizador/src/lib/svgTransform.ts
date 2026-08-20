import type { RimTextGeometry } from "../catalog/rimGeometry";
import type { ElementTransform } from "../types/customizer";

export function createElementSvgTransform(
  transform: ElementTransform | undefined,
  geometry: RimTextGeometry,
  inverted = false
): string | undefined {
  if (!transform) return undefined;
  const isInverted = geometry.inverted ?? inverted;
  const textCenterY = isInverted
    ? geometry.centerY + geometry.radius
    : geometry.centerY - geometry.radius;
  return `rotate(${transform.rotation} ${geometry.centerX} ${geometry.centerY}) translate(${geometry.centerX} ${textCenterY}) scale(${transform.scale}) translate(${-geometry.centerX} ${-textCenterY})`;
}

