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

type RoutePreview = {
  spot: Stamp;
  distanceMeters: number;
  durationMinutes: number;
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

export default function StampMap() {
  const { collectedIds, ready } = useCollectedStamps();

  const [position, setPosition] =
    useState<[number, number] | null>(null);

  const [selectedSpot, setSelectedSpot] =
    useState<Stamp | null>(null);

  const [routePreview, setRoutePreview] =
    useState<RoutePreview | null>(null);

  const [showRoute, setShowRoute] = useState(false);

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

  const prepareRoutePreview = (spot: Stamp) => {
    if (!position) {
      alert("現在地が取得できていないため、経路を表示できません。");
      return;
    }

    const distanceMeters = getDistanceMeters(
      position,
      [spot.latitude, spot.longitude]
    );

    const durationMinutes = Math.max(
      1,
      Math.round(distanceMeters / 80)
    );

    setSelectedSpot(spot);
    setRoutePreview({
      spot,
      distanceMeters,
      durationMinutes,
    });
    setShowRoute(false);
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
  };

  const openGoogleMapsRoute = (spot: Stamp) => {
    const origin = position
      ? `&origin=${position[0]},${position[1]}`
      : "";

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&destination=${spot.latitude},${spot.longitude}` +
      `${origin}&travelmode=walking`;

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

              <div className="route-stat-row">
                <span>距離</span>
                <strong>
                  {formatDistance(routePreview.distanceMeters)}
                </strong>
              </div>

              <div className="route-stat-row">
                <span>徒歩時間</span>
                <strong>
                  {formatDuration(routePreview.durationMinutes)}
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
              >
                経路を表示
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
            🗺 経路を表示
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
