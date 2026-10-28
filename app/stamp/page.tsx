"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CameraButton from "../components/CameraButton";
import {
  STAMPS,
  STAMP_STORAGE_KEY,
} from "@/lib/stamps";

export default function StampPage() {
  const [ownedStamps, setOwnedStamps] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const saved = window.localStorage.getItem(STAMP_STORAGE_KEY);
      if (!saved) return [];

      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed)) return [];
      
      const validIds = parsed.filter(
        (id): id is string =>
        typeof id === "string" &&
        STAMPS.some((stamp) => stamp.id === id)
      );

      return [...new Set(validIds)];
    } catch (error) {
      console.error("スタンプ情報の読み込みに失敗しました", error);
      return [];
    }
  });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);

  // モーダル表示中はEscapeキーで閉じられるようにする
  useEffect(() => {
    if (!selectedStampId && !showResetConfirm) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedStampId(null);
        setShowResetConfirm(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedStampId, showResetConfirm]);

  const resetStamps = () => {
    try {
      window.localStorage.removeItem(STAMP_STORAGE_KEY);
      setOwnedStamps([]);
      setShowResetConfirm(false);
      setSelectedStampId(null);
    } catch (error) {
      console.error("スタンプ情報のリセットに失敗しました", error);
    }
  };

  const ownedCount = ownedStamps.length;
  const totalCount = STAMPS.length;
  const progress =
    totalCount === 0
      ? 0
      : Math.round((ownedCount / totalCount) * 100);

  const selectedStamp =
    STAMPS.find((stamp) => stamp.id === selectedStampId) ?? null;

  const selectedStampOwned =
    selectedStamp !== null && ownedStamps.includes(selectedStamp.id);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <Link href="/" style={styles.backLink}>
          ← メインページへ戻る
        </Link>

        <h1 style={styles.title}>スタンプ帳</h1>

        <p style={styles.subtitle}>
          ARで見つけたスタンプを集めよう！
        </p>
      </header>

      <section style={styles.progressCard}>
        <p style={styles.progressLabel}>スタンプ収集状況</p>

        <p style={styles.count}>
          {ownedCount}
          <span style={styles.total}> / {totalCount}</span>
        </p>

        <div
          style={styles.progressTrack}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="スタンプ収集率"
        >
          <div
            style={{
              ...styles.progressFill,
              width: `${progress}%`,
            }}
          />
        </div>

        <p style={styles.progressText}>
          コンプリート率 {progress}%
        </p>

        {progress === 100 && totalCount > 0 && (
          <p style={styles.completeMessage}>
            🎉 全スタンプコンプリート！
          </p>
        )}
      </section>

      <section>
        <h2 style={styles.sectionTitle}>コレクション</h2>

        <p style={styles.hint}>
          カードを押すとスタンプの詳細を確認できます。
        </p>

        <div style={styles.grid}>
          {STAMPS.map((stamp) => {
            const owned = ownedStamps.includes(stamp.id);

            return (
              <button
                key={stamp.id}
                type="button"
                onClick={() => setSelectedStampId(stamp.id)}
                style={{
                  ...styles.stampCard,
                  ...(owned ? {} : styles.lockedCard),
                }}
                aria-label={
                  owned
                    ? `${stamp.name}の詳細を表示`
                    : "未獲得スタンプの詳細を表示"
                }
              >
                <div style={styles.imageArea}>
                  {owned ? (
                    <img
                      src={stamp.image}
                      alt={stamp.name}
                      style={styles.stampImage}
                    />
                  ) : (
                    <div style={styles.lockedImage} aria-hidden="true">
                      ?
                    </div>
                  )}
                </div>

                <h3 style={styles.stampName}>
                  {owned ? stamp.name : "？？？"}
                </h3>

                <p style={styles.stampDescription}>
                  {owned
                    ? stamp.description
                    : "まだ獲得していません"}
                </p>

                <span
                  style={{
                    ...styles.badge,
                    ...(owned ? styles.ownedBadge : styles.unownedBadge),
                  }}
                >
                  {owned ? "獲得済み" : "未獲得"}
                </span>

                <span style={styles.detailHint}>タップして詳細を見る</span>
              </button>
            );
          })}
        </div>
      </section>

      <footer style={styles.footer}>
        <CameraButton />

        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          style={styles.resetButton}
          disabled={ownedCount === 0}
        >
          スタンプをリセット
        </button>
      </footer>

      {/* スタンプ詳細モーダル */}
      {selectedStamp && (
        <div
          style={styles.overlay}
          onClick={() => setSelectedStampId(null)}
        >
          <section
            style={styles.detailDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="stamp-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedStampId(null)}
              style={styles.closeButton}
              aria-label="詳細を閉じる"
            >
              ×
            </button>

            <div style={styles.detailImageArea}>
              {selectedStampOwned ? (
                <img
                  src={selectedStamp.image}
                  alt={selectedStamp.name}
                  style={styles.detailImage}
                />
              ) : (
                <div style={styles.detailLockedImage}>?</div>
              )}
            </div>

            <span
              style={{
                ...styles.badge,
                ...(selectedStampOwned
                  ? styles.ownedBadge
                  : styles.unownedBadge),
              }}
            >
              {selectedStampOwned ? "獲得済み" : "未獲得"}
            </span>

            <h2 id="stamp-detail-title" style={styles.detailTitle}>
              {selectedStampOwned ? selectedStamp.name : "？？？"}
            </h2>

            <p style={styles.detailDescription}>
              {selectedStampOwned
                ? selectedStamp.description
                : "このスタンプはまだ獲得していません。対応するマーカーをARカメラで読み取って、スタンプを集めましょう！"}
            </p>

            <button
              type="button"
              onClick={() => setSelectedStampId(null)}
              style={styles.detailCloseButton}
              area-label="スタンプの詳細を閉じる"
            >
              ×
            </button>
          </section>
        </div>
      )}

      {/* リセット確認モーダル */}
      {showResetConfirm && (
        <div
          style={styles.overlay}
          onClick={() => setShowResetConfirm(false)}
        >
          <section
            style={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="reset-title">スタンプをリセットしますか？</h2>
            <p>獲得したスタンプがすべて未獲得に戻ります。</p>

            <div style={styles.dialogActions}>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                style={styles.cancelButton}
              >
                キャンセル
              </button>

              <button
                type="button"
                onClick={resetStamps}
                style={styles.confirmButton}
              >
                リセットする
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px 16px 40px",
    background: "#f7f5ef",
    color: "#282820",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", sans-serif',
  },
  header: {
    maxWidth: 720,
    margin: "0 auto 24px",
    textAlign: "center",
  },
  backLink: {
    display: "block",
    textAlign: "left",
    color: "#4d6247",
    textDecoration: "none",
    fontSize: 14,
  },
  title: {
    fontSize: 32,
    margin: "24px 0 8px",
  },
  subtitle: {
    color: "#68685e",
    margin: 0,
  },
  progressCard: {
    maxWidth: 720,
    margin: "0 auto 32px",
    padding: 24,
    background: "#fff",
    borderRadius: 20,
    boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
  },
  progressLabel: {
    margin: 0,
    color: "#68685e",
    fontSize: 14,
  },
  count: {
    fontSize: 40,
    fontWeight: 700,
    margin: "8px 0 16px",
  },
  total: {
    fontSize: 22,
    color: "#888",
  },
  progressTrack: {
    height: 10,
    background: "#e8e7df",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#66865b",
    borderRadius: 999,
    transition: "width 0.3s",
  },
  progressText: {
    textAlign: "right",
    fontSize: 13,
    color: "#68685e",
    marginBottom: 0,
  },
  completeMessage: {
    textAlign: "center",
    color: "#527444",
    fontWeight: 700,
  },
  sectionTitle: {
    maxWidth: 720,
    margin: "0 auto 8px",
    fontSize: 21,
  },
  hint: {
    maxWidth: 720,
    margin: "0 auto 16px",
    fontSize: 13,
    color: "#68685e",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
    gap: 14,
    maxWidth: 720,
    margin: "0 auto",
  },
  stampCard: {
    boxSizing: "border-box",
    width: "100%",
    padding: 14,
    border: "1px solid transparent",
    borderRadius: 16,
    background: "#fff",
    color: "#282820",
    textAlign: "center",
    boxShadow: "0 3px 12px rgba(0,0,0,0.04)",
    minWidth: 0,
    cursor: "pointer",
    fontFamily: "inherit",
    appearance: "none",
    WebkitAppearance: "none",
  },
  lockedCard: {
    background: "#edede7",
  },
  imageArea: {
    width: "100%",
    aspectRatio: "1 / 1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f4f2e9",
    borderRadius: 12,
    overflow: "hidden",
  },
  stampImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  lockedImage: {
    width: 76,
    height: 76,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#d9d9d0",
    color: "#85857a",
    fontSize: 44,
    fontWeight: 700,
  },
  stampName: {
    fontSize: 16,
    margin: "12px 0 6px",
  },
  stampDescription: {
    minHeight: 36,
    fontSize: 12,
    lineHeight: 1.5,
    color: "#68685e",
  },
  badge: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  ownedBadge: {
    background: "#e1edda",
    color: "#426139",
  },
  unownedBadge: {
    background: "#e0e0d9",
    color: "#77776d",
  },
  detailHint: {
    display: "block",
    marginTop: 10,
    fontSize: 11,
    color: "#77776d",
  },
  footer: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    maxWidth: 720,
    margin: "32px auto 0",
    alignItems: "center",
  },
  resetButton: {
    border: "none",
    background: "transparent",
    color: "#777",
    padding: 10,
    textDecoration: "underline",
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(0,0,0,0.58)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    overflowY: "auto",
  },
  detailDialog: {
    position: "relative",
    boxSizing: "border-box",
    width: "100%",
    maxWidth: 400,
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: 22,
    padding: "28px 24px 24px",
    textAlign: "center",
    boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 12,
    width: 36,
    height: 36,
    border: "none",
    borderRadius: "50%",
    background: "#f0efe9",
    color: "#444",
    fontSize: 27,
    lineHeight: 1,
    cursor: "pointer",
  },
  bottomCloseButton: {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 48,
  height: 48,
  margin: "20px auto 0",
  border: "none",
  borderRadius: "50%",
  background: "#526f49",
  color: "#fff",
  fontSize: 32,
  lineHeight: 1,
  cursor: "pointer",
  boxShadow: "0 3px 8px rgba(0,0,0,0.15)",
  },  
  detailImageArea: {
    width: "100%",
    maxWidth: 240,
    aspectRatio: "1 / 1",
    margin: "8px auto 18px",
    borderRadius: 16,
    background: "#f4f2e9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  detailImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  detailLockedImage: {
    width: 100,
    height: 100,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#d9d9d0",
    color: "#85857a",
    fontSize: 60,
    fontWeight: 700,
  },
  detailTitle: {
    margin: "14px 0 10px",
    fontSize: 24,
  },
  detailDescription: {
    margin: "0 0 24px",
    fontSize: 15,
    lineHeight: 1.9,
    color: "#55554d",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  detailCloseButton: {
    width: "100%",
    padding: 14,
    border: "none",
    borderRadius: 12,
    background: "#526f49",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  dialog: {
    width: "100%",
    maxWidth: 360,
    background: "#fff",
    borderRadius: 18,
    padding: 24,
  },
  dialogActions: {
    display: "flex",
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
  },
  confirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    border: "none",
    background: "#a33d35",
    color: "#fff",
  },
};