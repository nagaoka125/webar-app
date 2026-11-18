"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { STAMPS } from "@/lib/stamps";
import type { Stamp } from "@/lib/stamps";
import { useCollectedStamps } from "@/hooks/useCollectedStamps";

const MapContent = dynamic(
  () => import("./MapContent"),
  {
    ssr: false,
    loading: () => <p>地図を読み込んでいます...</p>,
  }
);

type TravelMode = "walk" | "bike";

type RoutePreview = {
  spot: Stamp;
  distanceMeters: number;
  durationMinutes: number;
  isLoading?: boolean;
};

type RouteResult = {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
};

type RouteCandidate = {
  geometry?: {
    coordinates: [number, number][];
  };
  distance?: number;
  duration?: number;
  legs?: Array<{
    steps?: Array<{
      name?: string;
      ref?: string;
      speed?: number;
      distance?: number;
      maneuver?: {
        type?: string;
        modifier?: string;
      };
    }>;
  }>;
};

const buildRouteResult = (route: RouteCandidate): RouteResult => {
  const coordinates = route.geometry?.coordinates.map(
    ([lon, lat]: [number, number]) => [lat, lon] as [number, number]
  ) ?? [];

  return {
    coordinates,
    distanceMeters: route.distance ?? 0,
    durationSeconds: route.duration ?? 0,
  };
};

const findBestRoute = async (
  mode: TravelMode,
  from: [number, number],
  to: [number, number]
): Promise<RouteResult> => {
  const [fromLat, fromLon] = from;
  const [toLat, toLon] = to;

  // 移動手段に応じて接続先を切り替える
  const server =
    mode === "bike"
      ? "routed-bike"
      : "routed-foot";

  const url =
    `https://routing.openstreetmap.de/${server}` +
    `/route/v1/driving/` +
    `${fromLon},${fromLat};${toLon},${toLat}` +
    `?geometries=geojson` +
    `&overview=full` +
    `&steps=true` +
    `&alternatives=true`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("経路の取得に失敗しました");
  }

  const data = await response.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(
      data.message ?? "経路が見つかりませんでした"
    );
  }

  // OSRMが返す推奨ルートを使用
  const route = data.routes[0];

  return buildRouteResult(route);
};

const fetchRoute = async (
  mode: TravelMode,
  from: [number, number],
  to: [number, number]
): Promise<RouteResult> => {
  return findBestRoute(mode, from, to);
};

const getDistanceMeters = (
  from: [number, number],
  to: [number, number]
) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;

  const lat1 = toRadians(from[0]);
  const lon1 = toRadians(from[1]);
  const lat2 = toRadians(to[0]);
  const lon2 = toRadians(to[1]);

  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (meters: number) => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(meters)} m`;
};

const formatDuration = (minutes: number) => `${minutes} 分`;

const getModeLabel = (mode: TravelMode) => {
  if (mode === "bike") return "自転車";
  return "徒歩";
};

export default function StampMap() {
  const { collectedIds, ready } = useCollectedStamps();

  const [position, setPosition] =
    useState<[number, number] | null>(null);

  const [selectedSpot, setSelectedSpot] =
    useState<Stamp | null>(null);

  const [routePreview, setRoutePreview] =
    useState<RoutePreview | null>(null);

  const [showRoute, setShowRoute] = useState(false);
  const [routeCoordinates, setRouteCoordinates] =
    useState<[number, number][] | null>(null);
  const [travelMode, setTravelMode] =
    useState<TravelMode>("bike");

  const collectedCount = collectedIds.length;

  const progress = STAMPS.length
    ? Math.round(
        (collectedCount / STAMPS.length) * 100
      )
    : 0;

  useEffect(() => {
    if (!navigator.geolocation) {
      console.error("位置情報に対応していません");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition([
          pos.coords.latitude,
          pos.coords.longitude,
        ]);
      },
      (error) => {
        console.error("現在地の取得に失敗しました:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000,
      }
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([
          pos.coords.latitude,
          pos.coords.longitude,
        ]);
      },
      () => {
        alert("現在地を取得できませんでした");
      }
    );
  };

  const prepareRoutePreview = async (spot: Stamp, mode: TravelMode=travelMode) => {
    if (!position) {
      alert("現在地が取得できていないため、経路を表示できません。");
      return;
    }

    setSelectedSpot(spot);
    setRoutePreview({
      spot,
      distanceMeters: 0,
      durationMinutes: 0,
      isLoading: true,
    });
    setShowRoute(false);

    try {
      const result = await fetchRoute(
        mode,
        position,
        [spot.latitude, spot.longitude]
      );

      setRoutePreview({
        spot,
        distanceMeters: result.distanceMeters,
        durationMinutes: Math.max(
          1,
          Math.round(result.durationSeconds / 60)
        ),
      });
      setRouteCoordinates(result.coordinates);
    } catch (error) {
      console.error(error);
      const fallbackDistance = getDistanceMeters(
        position,
        [spot.latitude, spot.longitude]
      );

      setRoutePreview({
        spot,
        distanceMeters: fallbackDistance,
        durationMinutes: Math.max(
          1,
          Math.round(fallbackDistance / (travelMode === "bike" ? 180 : 80))
        ),
      });
      setRouteCoordinates([
        position,
        [spot.latitude, spot.longitude],
      ]);
    }
  };

  const confirmRouteDisplay = () => {
    if (!routePreview) return;

    setShowRoute(true);
    setRoutePreview(null);
  };

  const closeRoutePreview = () => {
    setRoutePreview(null);
    setShowRoute(false);
    setSelectedSpot(null);
    setRouteCoordinates(null);
  };

  const openGoogleMapsRoute = (spot: Stamp) => {
    const origin = position
      ? `&origin=${position[0]},${position[1]}`
      : "";

    const mode = travelMode === "bike" ? "bicycling" : "walking";
    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&destination=${spot.latitude},${spot.longitude}` +
      `${origin}&travelmode=${mode}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!ready) {
    return <p>読み込み中...</p>;
  }

  return (
    <main className="stamp-map-page">
      <header className="map-header">
        <div>
          <h2>スタンプラリー</h2>
          <p>
            {collectedCount} / {STAMPS.length} 個獲得
          </p>
        </div>

        <div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span>{progress}%</span>
        </div>
      </header>

      <div className="map-container">
        <MapContent
          collectedIds={collectedIds}
          position={position}
          selectedSpot={selectedSpot}
          showRoute={showRoute}
          routeCoordinates={routeCoordinates}
          onSelectSpot={prepareRoutePreview}
        />

        <button
          className="current-location-button"
          onClick={getCurrentLocation}
        >
          📍 現在地
        </button>
      </div>

      {routePreview && (
        <div className="route-confirm-overlay">
          <div className="route-confirm-modal">
            <h3>経路を表示しますか？</h3>

            <div className="route-confirm-content">
              <p className="route-confirm-label">
                {routePreview.spot.label}
              </p>

              <div className="route-mode-select-wrap">
                <label htmlFor="travel-mode">移動手段</label>
                <select
                  id="travel-mode"
                  value={travelMode}
                  onChange={(e) => {
                    const nextMode = e.target.value as TravelMode;
                    setTravelMode(nextMode);
                    prepareRoutePreview(routePreview.spot, nextMode);
                  }}
                >
                  <option value="bike">自転車</option>
                  <option value="walk">徒歩</option>
                </select>
              </div>

              <div className="route-stat-row">
                <span>距離</span>
                <strong>
                  {routePreview.isLoading
                    ? "計算中..."
                    : formatDistance(routePreview.distanceMeters)}
                </strong>
              </div>

              <div className="route-stat-row">
                <span>{getModeLabel(travelMode)}時間</span>
                <strong>
                  {routePreview.isLoading
                    ? "計算中..."
                    : formatDuration(routePreview.durationMinutes)}
                </strong>
              </div>
            </div>

            <div className="route-confirm-actions">
              <button
                className="route-cancel-button"
                onClick={() => setRoutePreview(null)}
              >
                キャンセル
              </button>

              <button
                className="route-accept-button"
                onClick={confirmRouteDisplay}
                disabled={routePreview.isLoading}
              >
                {routePreview.isLoading ? "計算中..." : "経路を表示"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSpot && !routePreview && (
        <div className="spot-detail">
          <button
            className="close-button"
            onClick={closeRoutePreview}
          >
            ×
          </button>

          <h3>{selectedSpot.label}</h3>

          <p>{selectedSpot.description}</p>

          <p>
            {collectedIds.includes(selectedSpot.stampId)
              ? "✓ スタンプ獲得済み"
              : "★ スタンプ未獲得"}
          </p>

          <button
            className="route-button"
            onClick={() => prepareRoutePreview(selectedSpot)}
          >
            🗺 {getModeLabel(travelMode)}で経路を表示
          </button>

          <button
            className="route-button alt"
            onClick={() => openGoogleMapsRoute(selectedSpot)}
          >
            🚶 Googleマップで開く
          </button>
        </div>
      )}
    </main>
  );
}
