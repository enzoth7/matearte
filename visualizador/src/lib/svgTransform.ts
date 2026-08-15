import { RIM_VIEWBOX_SIZE, type RimTextGeometry } from "../catalog/rimGeometry";
import type { ElementTransform } from "../types/customizer";

export function createElementSvgTransform(transform: ElementTransform | undefined, geometry: RimTextGeometry): string | undefined {
  if (!transform) return undefined;
  const dx = (transform.x - 0.5) * RIM_VIEWBOX_SIZE;
  const dy = (transform.y - 0.5) * RIM_VIEWBOX_SIZE;
  return `translate(${dx} ${dy}) rotate(${transform.rotation} ${geometry.centerX} ${geometry.centerY}) translate(${geometry.centerX} ${geometry.centerY}) scale(${transform.scale}) translate(${-geometry.centerX} ${-geometry.centerY})`;
}

