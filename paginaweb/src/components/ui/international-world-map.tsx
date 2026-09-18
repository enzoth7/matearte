"use client";

import world from "@svg-maps/world";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AE, AR, AU, BR, CL, CR, DE, ES, FR, GB, HN, IT, JP, MX, NL, PH, PY, RU, SG, US } from "country-flag-icons/react/3x2";

const flagComponents: Record<string, React.ComponentType<{ className?: string }>> = { AE, AR, AU, BR, CL, CR, DE, ES, FR, GB, HN, IT, JP, MX, NL, PH, PY, RU, SG, US };

type DestinationCountry = { code: string; mapId: string; name: string; region: string };

type InternationalWorldMapProps = {
  destinations: readonly DestinationCountry[];
};

type WorldLocation = {
  id: string;
  name: string;
  path: string;
};

export function InternationalWorldMap({ destinations }: InternationalWorldMapProps) {
  const t = useTranslations("customersPage");
  const originInfo = {
    mapId: "uy",
    name: t("originTitle", { defaultValue: "Uruguay" }),
    region: t("originSubtitle", { defaultValue: "Taller de origen · Paysandú" }),
  };
  const [activeId, setActiveId] = useState(destinations[0].mapId);
  const destinationById = new Map<string, DestinationCountry>(destinations.map((destination) => [destination.mapId, destination]));
  const activeDestination = activeId === "uy" ? originInfo : (destinationById.get(activeId) ?? destinations[0]);
  const activeIndex = activeDestination.mapId === "uy" ? "★" : String(destinations.findIndex((item) => item.mapId === activeDestination.mapId) + 1).padStart(2, "0");

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
          <title id="world-map-title">{t("mapTitle")}</title>
          <desc id="world-map-description">{t("mapDescription", { count: destinations.length })}</desc>
          {world.locations.map((location: WorldLocation) => {
            const destination = destinationById.get(location.id);
            const isOrigin = location.id === "uy";
            const isActive = location.id === activeDestination.mapId;
            const className = isOrigin
              ? "international-map-country international-map-country--origin"
              : destination
              ? "international-map-country international-map-country--destination"
              : "international-map-country";

            return (
              <path
                key={location.id}
                d={location.path}
                className={className}
                data-active={isActive || undefined}
                onMouseEnter={isOrigin ? () => setActiveId("uy") : destination ? () => setActiveId(destination.mapId) : undefined}
              >
                <title>{isOrigin ? `${originInfo.name} · ${originInfo.region}` : destination ? `${destination.name} · ${destination.region}` : location.name}</title>
              </path>
            );
          })}
        </svg>
        <div className="international-map-caption" aria-live="polite">
          <span className="international-map-caption-index">{activeIndex}</span>
          <span>
            <strong>{activeDestination.name}</strong>
            <small>{activeDestination.region}</small>
          </span>
        </div>
      </div>

      <ol className="international-destination-list" aria-label={t("destinationList")}>
        {destinations.map((destination) => {
          const isActive = destination.mapId === activeDestination.mapId;
          const Flag = flagComponents[destination.code];
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
                {Flag ? (
                  <span className="international-destination-flag" aria-hidden="true">
                    <Flag className="international-flag-icon" />
                  </span>
                ) : null}
                <strong>{destination.name}</strong>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
