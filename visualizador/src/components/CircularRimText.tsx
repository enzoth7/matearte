import type { PointerEventHandler } from "react";
import {
  calculateRimCharacterKnockoutPadding,
  calculateRimCharacterLayout,
  createCenteredArcPath,
  polarPoint,
  rimTextGeometry,
  RIM_VIEWBOX_SIZE,
  type RimTextGeometry,
} from "../catalog/rimGeometry";
import { createDefaultElementTransform, type ElementTransform, type RimTextElement } from "../types/customizer";
import { createElementSvgTransform } from "../lib/svgTransform";

interface CircularRimTextProps {
  id?: string;
  text: string;
  geometry?: RimTextGeometry;
  transform?: ElementTransform;
  inverted?: boolean;
  selected?: boolean;
  onPointerDown?: PointerEventHandler<SVGGElement>;
  onResizeDown?: PointerEventHandler<SVGGElement>;
  onToggleInvert?: () => void;
}

export interface RimTextFinishMaskProps {
  id: string;
  text?: string;
  texts?: RimTextElement[];
  geometry?: RimTextGeometry;
  transform?: ElementTransform;
  inverted?: boolean;
}

const luminanceMaskAttribute = { "mask-type": "luminance" };

export function RimCharacters({
  text,
  geometry = rimTextGeometry,
  mask = false,
  inverted = false,
}: {
  text: string;
  geometry?: RimTextGeometry;
  mask?: boolean;
  inverted?: boolean;
}) {
  const isInverted = geometry.inverted ?? inverted;
  const layout = calculateRimCharacterLayout(text, geometry, isInverted);
  const knockoutStrokeWidth = calculateRimCharacterKnockoutPadding(layout.fontSize) * 2;
  return (
    <>
      {layout.characters.map((character, index) => character.character !== " " && (
        <text
          key={`${character.character}-${index}`}
          x={character.x}
          y={character.y}
          transform={`rotate(${character.rotation} ${character.x} ${character.y})`}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={mask ? "black" : "#1f1f1f"}
          stroke={mask ? "black" : "none"}
          strokeWidth={mask ? knockoutStrokeWidth : 0}
          strokeLinejoin="round"
          strokeLinecap="round"
          paintOrder="stroke fill"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize={layout.fontSize}
          fontWeight="700"
        >
          {character.character}
        </text>
      ))}
    </>
  );
}

export function RimTextFinishMask({
  id,
  text = "",
  texts,
  geometry = rimTextGeometry,
  transform,
  inverted = false,
}: RimTextFinishMaskProps) {
  const activeTexts = texts && texts.length > 0
    ? texts.filter((t) => t.text.trim().length > 0)
    : text.trim().length > 0
    ? [{ id: "primary", text, transform: transform ?? createDefaultElementTransform("rim"), inverted }]
    : [];

  return (
    <mask
      id={id}
      {...luminanceMaskAttribute}
      maskUnits="userSpaceOnUse"
      maskContentUnits="userSpaceOnUse"
      x="0"
      y="0"
      width={RIM_VIEWBOX_SIZE}
      height={RIM_VIEWBOX_SIZE}
    >
      <rect width={RIM_VIEWBOX_SIZE} height={RIM_VIEWBOX_SIZE} fill="white" />
      {activeTexts.map((item) => (
        <g
          key={item.id}
          transform={createElementSvgTransform(item.transform, geometry, item.inverted)}
        >
          <RimCharacters
            text={item.text}
            geometry={geometry}
            mask
            inverted={item.inverted}
          />
        </g>
      ))}
    </mask>
  );
}

export function CircularRimText({
  text,
  geometry = rimTextGeometry,
  transform,
  inverted = false,
  selected,
  onPointerDown,
  onResizeDown,
  onToggleInvert,
}: CircularRimTextProps) {
  const isInverted = geometry.inverted ?? inverted;
  const hasText = Boolean(text.trim());

  if (!hasText && !selected) return null;

  const layout = calculateRimCharacterLayout(text, geometry, isInverted);
  const pathArcLength = hasText ? layout.occupiedArcLength + 80 : 300;
  const arcPath = createCenteredArcPath(geometry, pathArcLength, isInverted);

  // Control positions calculation
  const firstChar = layout.characters[0];
  const lastChar = layout.characters[layout.characters.length - 1];

  let moveAngle: number;
  let resizeAngle: number;
  const toggleAngle = isInverted ? 90 : 270;
  const toggleRadius = geometry.radius - 58;

  if (isInverted) {
    moveAngle = firstChar ? firstChar.rotation + 90 + 6 : 175 - 15;
    resizeAngle = lastChar ? lastChar.rotation + 90 - 6 : 5 + 15;
  } else {
    moveAngle = firstChar ? firstChar.rotation - 90 - 6 : geometry.startAngle + 15;
    resizeAngle = lastChar ? lastChar.rotation - 90 + 6 : geometry.endAngle - 15;
  }

  const moveHandlePoint = polarPoint(geometry.centerX, geometry.centerY, geometry.radius, moveAngle);
  const resizeHandlePoint = polarPoint(geometry.centerX, geometry.centerY, geometry.radius, resizeAngle);
  const toggleButtonPoint = polarPoint(geometry.centerX, geometry.centerY, toggleRadius, toggleAngle);

  return (
    <g
      transform={createElementSvgTransform(transform, geometry, isInverted)}
      onPointerDown={onPointerDown}
      className={onPointerDown ? "cursor-grab active:cursor-grabbing" : undefined}
      style={{ touchAction: "none" }}
    >
      {/* Invisible broad hitbox for grabbing anywhere along the text arc */}
      {onPointerDown && (
        <path
          d={arcPath}
          fill="none"
          stroke="transparent"
          strokeWidth="170"
          pointerEvents="stroke"
        />
      )}

      {/* Selected UI Overlay with 3 Controls */}
      {selected && (
        <g>
          {/* Dashed selection track */}
          <path
            d={arcPath}
            fill="none"
            stroke="#7a4a31"
            strokeWidth="5"
            strokeDasharray="18 12"
            pointerEvents="none"
          />

          {/* Control a) Move Control Handle */}
          {onPointerDown && (
            <g
              transform={`translate(${moveHandlePoint.x}, ${moveHandlePoint.y})`}
              pointerEvents="all"
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                e.stopPropagation();
                onPointerDown(e);
              }}
            >
              <circle
                r="20"
                fill="#7a4a31"
                stroke="#ffffff"
                strokeWidth="3.5"
                className="filter drop-shadow-md"
              />
              <text
                x="0"
                y="1"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize="14"
                fontWeight="bold"
                pointerEvents="none"
              >
                ✥
              </text>
            </g>
          )}

          {/* Control b) Scale / Resize Control Handle */}
          {onResizeDown && (
            <g
              transform={`translate(${resizeHandlePoint.x}, ${resizeHandlePoint.y})`}
              pointerEvents="all"
              className="cursor-nwse-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                onResizeDown(e);
              }}
            >
              <circle
                r="20"
                fill="#ffffff"
                stroke="#7a4a31"
                strokeWidth="4"
                className="filter drop-shadow-md"
              />
              <text
                x="0"
                y="1"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#7a4a31"
                fontSize="14"
                fontWeight="bold"
                pointerEvents="none"
              >
                ⤢
              </text>
            </g>
          )}

          {/* Control c) Curvature / Direction Toggle Button */}
          {onToggleInvert && (
            <g
              transform={`translate(${toggleButtonPoint.x}, ${toggleButtonPoint.y})`}
              pointerEvents="all"
              className="cursor-pointer select-none"
              onPointerDown={(e) => {
                e.stopPropagation();
                onToggleInvert();
              }}
            >
              <rect
                x="-36"
                y="-15"
                width="72"
                height="30"
                rx="15"
                fill="#7a4a31"
                stroke="#ffffff"
                strokeWidth="2.5"
                className="filter drop-shadow-md transition-transform hover:scale-105"
              />
              <text
                x="0"
                y="1"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize="12"
                fontWeight="bold"
                fontFamily="system-ui, sans-serif"
                pointerEvents="none"
              >
                {isInverted ? "⌒ Normal" : "⌣ Invertir"}
              </text>
            </g>
          )}
        </g>
      )}

      {hasText && (
        <RimCharacters
          text={text}
          geometry={geometry}
          inverted={isInverted}
        />
      )}
    </g>
  );
}
