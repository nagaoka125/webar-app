"use client";

import { useEffect, useState } from "react";
import { STAMP_STORAGE_KEY, STAMPS } from "@/lib/stamps";

export function useCollectedStamps() {
  const [collectedIds, setCollectedIds] =
    useState<string[]>([]);

  const [ready, setReady] = useState(false);

  // localStorageから獲得情報を読み込む
  useEffect(() => {
    const loadStamps = () => {
      try {
        const saved = localStorage.getItem(
          STAMP_STORAGE_KEY
        );

        const parsed: unknown = saved
          ? JSON.parse(saved)
          : [];

        const validIds = Array.isArray(parsed)
          ? parsed.filter(
              (id): id is string =>
                typeof id === "string" &&
                STAMPS.some(
                  (stamp) => stamp.stampId === id
                )
            )
          : [];

        setCollectedIds([...new Set(validIds)]);
      } catch (error) {
        console.error("スタンプ情報の読み込みに失敗:", error);
        setCollectedIds([]);
      } finally {
        setReady(true);
      }
    };

    loadStamps();

    // 別タブでの変更にも対応
    window.addEventListener("storage", loadStamps);

    return () => {
      window.removeEventListener("storage", loadStamps);
    };
  }, []);

  return {
    collectedIds,
    ready,
  };
}
