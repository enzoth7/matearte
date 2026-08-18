export interface RimTextGeometry {
  centerX: number;
  centerY: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  fontSize: number;
}

export interface RimIconPlacement {
  angle: number;
  radius: number;
  size: number;
  rotationMode: "tangent" | "upright";
}

export interface RimTextScale {
  fontSize: number;
  letterSpacing: number;
}

export interface CircularTextMetrics extends RimTextScale {
  arcLength: number;
  targetTextLength: number;
  backgroundArcLength: number;
  backgroundBandWidth: number;
  useTextLength: boolean;
}

export interface RimTextVisualBounds {
  topY: number;
  bottomY: number;
  pathLength: number;
}

export interface RimBackgroundBand {
  radius: number;
  width: number;
  pathLength: number;
}

export interface RimCharacterPlacement {
  character: string;
  x: number;
  y: number;
  rotation: number;
}

export interface RimCharacterLayout {
  characters: RimCharacterPlacement[];
  fontSize: number;
  characterGap: number;
  occupiedArcLength: number;
}

export interface RimGeometryProfile {
  textGeometry: RimTextGeometry;
  iconPlacement: RimIconPlacement;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  radiusBounds: { min: number; max: number };
}

export const RIM_VIEWBOX_SIZE = 1254;
export const RIM_TEXT_KNOCKOUT_COLOR = "#eee9df";
export const RIM_TEXT_CHARACTER_KNOCKOUT_MIN_PADDING = 65;
export const RIM_TEXT_CHARACTER_KNOCKOUT_MAX_PADDING = 85;
export const RIM_TEXT_BACKGROUND_SIDE_PADDING = 22;
export const RIM_TEXT_BACKGROUND_RADIUS_OFFSET = 18;
export const RIM_ICON_KNOCKOUT_SIZE = 20;
export const RIM_ICON_KNOCKOUT_COLOR = "#eee9df";
export const rimTextGeometry: RimTextGeometry = { centerX: 627, centerY: 627, radius: 474, startAngle: 185, endAngle: 355, fontSize: 78 };
export const defaultRimIconPlacement: RimIconPlacement = { angle: 90, radius: 474, size: 120, rotationMode: "upright" };

const rimGeometryProfiles: Record<MateModel, RimGeometryProfile> = {
  imperial: { textGeometry: rimTextGeometry, iconPlacement: defaultRimIconPlacement, bounds: { minX: 0.05, maxX: 0.95, minY: 0.05, maxY: 0.95 }, radiusBounds: { min: 0.33, max: 0.42 } },
  camionero: { textGeometry: { ...rimTextGeometry, radius: 455 }, iconPlacement: { ...defaultRimIconPlacement, radius: 455 }, bounds: { minX: 0.05, maxX: 0.95, minY: 0.05, maxY: 0.95 }, radiusBounds: { min: 0.32, max: 0.41 } },
  torpedo: { textGeometry: { ...rimTextGeometry, radius: 435, fontSize: 74 }, iconPlacement: { ...defaultRimIconPlacement, radius: 435, size: 112 }, bounds: { minX: 0.05, maxX: 0.95, minY: 0.05, maxY: 0.95 }, radiusBounds: { min: 0.31, max: 0.39 } },
  criollo: { textGeometry: { ...rimTextGeometry, radius: 448, fontSize: 76 }, iconPlacement: { ...defaultRimIconPlacement, radius: 448, size: 116 }, bounds: { minX: 0.05, maxX: 0.95, minY: 0.05, maxY: 0.95 }, radiusBounds: { min: 0.32, max: 0.40 } },
};

export function getRimGeometryProfile(model: MateModel): RimGeometryProfile {
  return rimGeometryProfiles[model];
}

function getArcAngle(geometry: RimTextGeometry): number {
  return ((geometry.endAngle - geometry.startAngle) % 360 + 360) % 360;
}

function getTargetArcFraction(textLength: number): number {
  const anchorPoints = [
    { length: 1, fraction: 0.34 },
    { length: 8, fraction: 0.38 },
    { length: 14, fraction: 0.48 },
    { length: 20, fraction: 0.59 },
    { length: 25, fraction: 0.7 },
    { length: 32, fraction: 0.8 },
    { length: 40, fraction: 0.9 },
  ];
  const target = Math.min(40, Math.max(1, textLength));
  const upperIndex = anchorPoints.findIndex((point) => point.length >= target);
  if (upperIndex <= 0) return anchorPoints[0].fraction;
  const lower = anchorPoints[upperIndex - 1];
  const upper = anchorPoints[upperIndex];
  const progress = (target - lower.length) / (upper.length - lower.length);
  return lower.fraction + (upper.fraction - lower.fraction) * progress;
}

export function calculateCircularTextMetrics(text: string, geometry: RimTextGeometry): CircularTextMetrics {
  const visibleText = text.trim();
  const arcLength = geometry.radius * getArcAngle(geometry) * Math.PI / 180;
  const isShortText = visibleText.length <= 7;
  const shortTextLetterSpacing = Math.max(5, 20 - visibleText.length * 2);
  const naturalGlyphUnits = [...visibleText].reduce((total, character) => total + (character === " " ? 0.36 : 0.62), 0);
  const shortTargetFraction = 0.25 + Math.min(6, Math.max(0, visibleText.length - 1)) / 6 * 0.07;
  const shortTextFontSize = Math.max(100, Math.min(140, (arcLength * shortTargetFraction - Math.max(0, visibleText.length - 1) * shortTextLetterSpacing) / Math.max(naturalGlyphUnits, 1)));
  const naturalTextLength = naturalGlyphUnits * shortTextFontSize + Math.max(0, visibleText.length - 1) * shortTextLetterSpacing;
  const targetTextLength = arcLength * getTargetArcFraction(visibleText.length);
  const letterSpacing = Math.max(0.5, Math.min(1.5, 1.7 - visibleText.length * 0.045));
  const fontSize = Math.max(56, Math.min(90, (targetTextLength - Math.max(0, visibleText.length - 1) * letterSpacing) / Math.max(naturalGlyphUnits, 1)));
  const effectiveTextLength = isShortText ? naturalTextLength : targetTextLength;
  const effectiveFontSize = isShortText ? shortTextFontSize : fontSize;
  const effectiveLetterSpacing = isShortText ? shortTextLetterSpacing : letterSpacing;
  return {
    fontSize: effectiveFontSize,
    letterSpacing: effectiveLetterSpacing,
    arcLength,
    targetTextLength: effectiveTextLength,
    backgroundArcLength: Math.min(arcLength, effectiveTextLength + RIM_TEXT_BACKGROUND_SIDE_PADDING * 2),
    backgroundBandWidth: Math.min(125, Math.max(92, effectiveFontSize * 1.05)),
    useTextLength: !isShortText,
  };
}

export function polarPoint(centerX: number, centerY: number, radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return { x: centerX + Math.cos(radians) * radius, y: centerY + Math.sin(radians) * radius };
}

export function createArcPath(geometry: RimTextGeometry): string {
  const start = polarPoint(geometry.centerX, geometry.centerY, geometry.radius, geometry.startAngle);
  const end = polarPoint(geometry.centerX, geometry.centerY, geometry.radius, geometry.endAngle);
  const angleSpan = ((geometry.endAngle - geometry.startAngle) % 360 + 360) % 360;
  return `M ${start.x} ${start.y} A ${geometry.radius} ${geometry.radius} 0 ${angleSpan > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

export function createCenteredArcPath(geometry: RimTextGeometry, pathLength: number): string {
  const arcAngle = getArcAngle(geometry);
  const arcLength = geometry.radius * arcAngle * Math.PI / 180;
  const clampedLength = Math.min(pathLength, arcLength);
  const halfAngle = (clampedLength / geometry.radius) * 180 / Math.PI / 2;
  const centerAngle = geometry.startAngle + arcAngle / 2;
  return createArcPath({ ...geometry, startAngle: centerAngle - halfAngle, endAngle: centerAngle + halfAngle });
}

export function createRimBackgroundGeometry(geometry: RimTextGeometry): RimTextGeometry {
  return { ...geometry, radius: geometry.radius + RIM_TEXT_BACKGROUND_RADIUS_OFFSET };
}

export function calculateMeasuredRimBackgroundBand(geometry: RimTextGeometry, bounds: RimTextVisualBounds): RimBackgroundBand {
  const outerRadius = geometry.centerY - bounds.topY;
  const innerRadius = geometry.centerY - bounds.bottomY;
  const visualHeight = Math.max(0, outerRadius - innerRadius);
  const verticalMargin = 14;
  const arcLength = geometry.radius * getArcAngle(geometry) * Math.PI / 180;
  return {
    radius: (outerRadius + innerRadius) / 2,
    width: Math.min(136, Math.max(92, visualHeight + verticalMargin * 2)),
    pathLength: Math.min(arcLength, bounds.pathLength + RIM_TEXT_BACKGROUND_SIDE_PADDING * 2),
  };
}

export function calculateRimIconPlacement(placement: RimIconPlacement, geometry: RimTextGeometry = rimTextGeometry) {
  const point = polarPoint(geometry.centerX, geometry.centerY, placement.radius, placement.angle);
  const rotation = placement.rotationMode === "tangent" ? placement.angle + 90 : 0;
  return { x: point.x, y: point.y, rotation };
}

function getCharacterWidthUnits(character: string): number {
  if (character === " ") return 0.38;
  if ("IL1".includes(character.toUpperCase())) return 0.36;
  if ("MW".includes(character.toUpperCase())) return 0.84;
  return 0.62;
}

function getCharacterTargetFraction(textLength: number): number {
  const anchorPoints = [
    { length: 1, fraction: 0.24 },
    { length: 7, fraction: 0.32 },
    { length: 14, fraction: 0.48 },
    { length: 20, fraction: 0.59 },
    { length: 25, fraction: 0.7 },
    { length: 32, fraction: 0.8 },
    { length: 40, fraction: 0.9 },
  ];
  const target = Math.min(40, Math.max(1, textLength));
  const upperIndex = anchorPoints.findIndex((point) => point.length >= target);
  if (upperIndex <= 0) return anchorPoints[0].fraction;
  const lower = anchorPoints[upperIndex - 1];
  const upper = anchorPoints[upperIndex];
  const progress = (target - lower.length) / (upper.length - lower.length);
  return lower.fraction + (upper.fraction - lower.fraction) * progress;
}

export function calculateRimCharacterLayout(text: string, geometry: RimTextGeometry): RimCharacterLayout {
  const characters = [...text.trim()];
  if (characters.length === 0) return { characters: [], fontSize: geometry.fontSize, characterGap: 0, occupiedArcLength: 0 };

  const arcLength = geometry.radius * getArcAngle(geometry) * Math.PI / 180;
  const targetArcLength = arcLength * getCharacterTargetFraction(characters.length);
  const widthUnits = characters.map(getCharacterWidthUnits);
  const totalWidthUnits = widthUnits.reduce((total, width) => total + width, 0);
  const fontSize = Math.max(36, Math.min(geometry.fontSize, targetArcLength / Math.max(totalWidthUnits, 1)));
  const naturalLength = totalWidthUnits * fontSize;
  const gapsCount = Math.max(0, characters.length - 1);
  const preferredGap = gapsCount > 0 ? Math.max(3, Math.min(20, (targetArcLength - naturalLength) / gapsCount)) : 0;
  const maximumFittingGap = gapsCount > 0 ? (arcLength - naturalLength) / gapsCount : 0;
  const characterGap = gapsCount > 0 ? Math.max(0, Math.min(preferredGap, maximumFittingGap)) : 0;
  const occupiedArcLength = naturalLength + characterGap * Math.max(0, characters.length - 1);
  const startDistance = (arcLength - occupiedArcLength) / 2;
  const startAngle = geometry.startAngle;
  let cursor = startDistance;

  const placements = characters.map((character, index) => {
    const width = widthUnits[index] * fontSize;
    const distance = cursor + width / 2;
    const angle = startAngle + distance / geometry.radius * 180 / Math.PI;
    const point = polarPoint(geometry.centerX, geometry.centerY, geometry.radius, angle);
    cursor += width + characterGap;
    return { character, x: point.x, y: point.y, rotation: angle + 90 };
  });

  return { characters: placements, fontSize, characterGap, occupiedArcLength };
}

export function calculateRimCharacterKnockoutPadding(fontSize: number): number {
  return Math.min(RIM_TEXT_CHARACTER_KNOCKOUT_MAX_PADDING, Math.max(RIM_TEXT_CHARACTER_KNOCKOUT_MIN_PADDING, fontSize * 0.55));
}
import type { MateModel } from "./mateCatalog";
