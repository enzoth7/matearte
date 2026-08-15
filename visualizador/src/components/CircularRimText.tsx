import type { PointerEventHandler } from "react";
import { calculateRimCharacterKnockoutPadding, calculateRimCharacterLayout, createArcPath, rimTextGeometry, RIM_VIEWBOX_SIZE, type RimTextGeometry } from "../catalog/rimGeometry";
import type { ElementTransform } from "../types/customizer";
import { createElementSvgTransform } from "../lib/svgTransform";

interface CircularRimTextProps {
  text: string;
  geometry?: RimTextGeometry;
  transform?: ElementTransform;
  selected?: boolean;
  onPointerDown?: PointerEventHandler<SVGGElement>;
}
interface RimTextFinishMaskProps { id: string; text: string; geometry?: RimTextGeometry; transform?: ElementTransform }

const luminanceMaskAttribute = { "mask-type": "luminance" };

function RimCharacters({ text, geometry = rimTextGeometry, mask = false }: { text: string; geometry?: RimTextGeometry; mask?: boolean }) {
  const layout = calculateRimCharacterLayout(text, geometry);
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

export function RimTextFinishMask({ id, text, geometry = rimTextGeometry, transform }: RimTextFinishMaskProps) {
  return (
    <mask id={id} {...luminanceMaskAttribute} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width={RIM_VIEWBOX_SIZE} height={RIM_VIEWBOX_SIZE}>
      <rect width={RIM_VIEWBOX_SIZE} height={RIM_VIEWBOX_SIZE} fill="white" />
      <g transform={createElementSvgTransform(transform, geometry)}>
        <RimCharacters text={text} geometry={geometry} mask />
      </g>
    </mask>
  );
}

export function CircularRimText({ text, geometry = rimTextGeometry, transform, selected, onPointerDown }: CircularRimTextProps) {
  if (!text.trim()) return null;
  return (
    <g
      transform={createElementSvgTransform(transform, geometry)}
      onPointerDown={onPointerDown}
      className={onPointerDown ? "cursor-grab active:cursor-grabbing" : undefined}
      style={{ touchAction: "none" }}
    >
      {onPointerDown && <path d={createArcPath(geometry)} fill="none" stroke="transparent" strokeWidth="170" pointerEvents="stroke" />}
      {selected && <path d={createArcPath(geometry)} fill="none" stroke="#7a4a31" strokeWidth="5" strokeDasharray="18 12" pointerEvents="none" />}
      <RimCharacters text={text} geometry={geometry} />
    </g>
  );
}
