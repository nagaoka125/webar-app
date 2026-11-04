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

export default function StampMap() {
  const { collectedIds, ready } = useCollectedStamps();

  const [position, setPosition] =
    useState<[number, number] | null>(null);

  const [selectedSpot, setSelectedSpot] =
    useState<Stamp | null>(null);

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

    // ページを離れると監視を停止
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const openRoute = (spot: Stamp) => {
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

      {/* スタンプ達成状況 */}
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

      {/* 地図 */}
      <div className="map-container">
        <MapContent
          collectedIds={collectedIds}
          position={position}
          selectedSpot={selectedSpot}
          onSelectSpot={setSelectedSpot}
        />

        <div className="current-location-button">
          {position ? "📍 現在地を取得中" : "📍 現在地を確認中..."}
        </div>
      </div>

      {/* スポット詳細 */}
      {selectedSpot && (
        <div className="spot-detail">
          <button
            className="close-button"
            onClick={() => setSelectedSpot(null)}
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
            onClick={() => openRoute(selectedSpot)}
          >
            🗺 徒歩ルートを表示
          </button>
        </div>
      )}
    </main>
  );
}
