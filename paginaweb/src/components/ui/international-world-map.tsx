"use client";

import world from "@svg-maps/world";
import { useState } from "react";
import type { DestinationCountry } from "@/data/international-clients";

type InternationalWorldMapProps = {
  destinations: readonly DestinationCountry[];
};

type WorldLocation = {
  id: string;
  name: string;
  path: string;
};

export function InternationalWorldMap({ destinations }: InternationalWorldMapProps) {
  const [activeId, setActiveId] = useState(destinations[0].mapId);
  const destinationById = new Map<string, DestinationCountry>(destinations.map((destination) => [destination.mapId, destination]));
  const activeDestination = destinationById.get(activeId) ?? destinations[0];

  return (
    <div className="international-map-layout">
      <div className="international-map-canvas">
        <svg
          className="international-map-svg"
          viewBox={world.viewBox}
          role="img"
          aria-labelledby="world-map-title world-map-description"
          preserveAspectRatio="xMidYMid meet"
        >
          <title id="world-map-title">Destinos internacionales de MateArte Uruguay</title>
          <desc id="world-map-description">Mapa del mundo con trece países destacados a los que MateArte ha enviado sus piezas.</desc>
          {world.locations.map((location: WorldLocation) => {
            const destination = destinationById.get(location.id);
            const isActive = location.id === activeDestination.mapId;

            return (
              <path
                key={location.id}
                d={location.path}
                className={destination ? "international-map-country international-map-country--destination" : "international-map-country"}
                data-active={isActive || undefined}
                onMouseEnter={destination ? () => setActiveId(destination.mapId) : undefined}
              >
                <title>{destination ? `${destination.name} · ${destination.region}` : location.name}</title>
              </path>
            );
          })}
        </svg>
        <div className="international-map-caption" aria-live="polite">
          <span className="international-map-caption-index">{String(destinations.findIndex((item) => item.mapId === activeDestination.mapId) + 1).padStart(2, "0")}</span>
          <span>
            <strong>{activeDestination.name}</strong>
            <small>{activeDestination.region}</small>
          </span>
        </div>
      </div>

      <ol className="international-destination-list" aria-label="Lista de destinos internacionales">
        {destinations.map((destination, index) => {
          const isActive = destination.mapId === activeDestination.mapId;
          return (
            <li key={destination.code}>
              <button
                type="button"
                className="international-destination-button"
                data-active={isActive || undefined}
                aria-pressed={isActive}
                onClick={() => setActiveId(destination.mapId)}
                onMouseEnter={() => setActiveId(destination.mapId)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{destination.name}</strong>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
