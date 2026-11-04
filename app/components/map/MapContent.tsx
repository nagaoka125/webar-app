"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMap,
} from "react-leaflet";

import { useEffect } from "react";
import L from "leaflet";
import { STAMPS } from "@/lib/stamps";
import type { Stamp } from "@/lib/stamps";

// 獲得済みマーカー
const collectedIcon = L.divIcon({
  className: "",
  html: `<div class="marker-collected">✓</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

// 未獲得マーカー
const uncollectedIcon = L.divIcon({
  className: "",
  html: `<div class="marker-uncollected">★</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

type Props = {
  collectedIds: string[];
  position: [number, number] | null;
  selectedSpot: Stamp | null;
  onSelectSpot: (spot: Stamp) => void;
};

function MapController({
  position,
  selectedSpot,
}: {
  position: [number, number] | null;
  selectedSpot: Stamp | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedSpot) {
      map.flyTo(
        [selectedSpot.latitude, selectedSpot.longitude],
        17
      );
    } else if (position) {
      map.flyTo(position, 16);
    }
  }, [position, selectedSpot, map]);

  return null;
}

export default function MapContent({
  collectedIds,
  position,
  selectedSpot,
  onSelectSpot,
}: Props) {
  return (
    <MapContainer
      center={[34.7025, 135.4959]}
      zoom={15}
      zoomControl={false}
      style={{
        height: "100%",
        width: "100%",
      }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController
        position={position}
        selectedSpot={selectedSpot}
      />

      {position && (
        <CircleMarker
          center={position}
          radius={10}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "#2563eb",
            fillOpacity: 1,
          }}
        >
          <Popup>現在地</Popup>
        </CircleMarker>
      )}

      {/*
        STAMPSの全スポットを表示
      */}
      {STAMPS.map((stamp) => {
        const collected = collectedIds.includes(stamp.stampId);

        return (
          <Marker
            key={stamp.stampId}
            position={[stamp.latitude, stamp.longitude]}
            icon={collected ? collectedIcon : uncollectedIcon}
            eventHandlers={{
              click: () => onSelectSpot(stamp),
            }}
    >
            <Popup>
              <strong>{stamp.label}</strong>
              <p>{collected ? "✓ 獲得済み" : "★ 未獲得"}</p>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
