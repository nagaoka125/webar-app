"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STAMP_STORAGE_KEY, STAMPS } from "@/lib/stamps";

type MindARSystem = {
  start: () => Promise<void>;
  stop: () => void;
};

type AFrameSceneElement = HTMLElement & {
  hasLoaded: boolean;
  systems: Record<string, MindARSystem | undefined>;
};

type AFrameAPI = {
  scenes: AFrameSceneElement[];
};

type MindARWindow = Window & {
  AFRAME?: AFrameAPI;
};

export default function WebARPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const systemRef = useRef<MindARSystem | null>(null);
  const sceneRef = useRef<AFrameSceneElement | null>(null);
  const detectedIdRef = useRef<string | null>(null);

  const router = useRouter();

  const [status, setStatus] = useState(
    "ARライブラリを準備しています..."
  );
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [detectedStampId, setDetectedStampId] = useState<string | null>(
    null
  );

  const loadScript = useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(
        `script[data-webar-src="${src}"]`
      ) as HTMLScriptElement | null;

      if (existing?.dataset.loaded === "true") {
        resolve();
        return;
      }

      if (existing) {
        const onLoad = () => {
          cleanup();
          existing.dataset.loaded = "true";
          resolve();
        };

        const onError = () => {
          cleanup();
          reject(new Error(`ライブラリを読み込めません: ${src}`));
        };

        const cleanup = () => {
          existing.removeEventListener("load", onLoad);
          existing.removeEventListener("error", onError);
        };

        existing.addEventListener("load", onLoad);
        existing.addEventListener("error", onError);
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.dataset.webarSrc = src;

      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };

      script.onerror = () => {
        script.remove();
        reject(new Error(`ライブラリを読み込めません: ${src}`));
      };

      document.head.appendChild(script);
    });
  }, []);

  const waitForScene = useCallback(
    (scene: AFrameSceneElement): Promise<void> =>
      new Promise((resolve, reject) => {
        if (scene.hasLoaded) {
          resolve();
          return;
        }

        const timeout = window.setTimeout(() => {
          cleanup();
          reject(
            new Error("ARシーンの初期化がタイムアウトしました")
          );
        }, 20000);

        const onLoaded = () => {
          cleanup();
          resolve();
        };

        const cleanup = () => {
          window.clearTimeout(timeout);
          scene.removeEventListener("loaded", onLoaded);
        };

        scene.addEventListener("loaded", onLoaded);
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    let scene: AFrameSceneElement | null = null;
    let cleanupEvents = () => {};
    let videoObserver: MutationObserver | null = null;

    const initialize = async () => {
      try {
        setStatus("ARライブラリを読み込んでいます...");
        setErrorMessage("");
        setDetectedStampId(null);
        detectedIdRef.current = null;

        if (STAMPS.length === 0) {
          throw new Error(
            "STAMPS にマーカー情報が登録されていません。"
          );
        }

        // MindAR本体 → A-Frame → MindARのA-Frame拡張
        await loadScript("/vendor/mindar-image.prod.js");
        await loadScript("/vendor/aframe.min.js");
        await loadScript("/vendor/mindar-image-aframe.prod.js");

        if (cancelled || !containerRef.current) return;

        const AFRAME = (window as MindARWindow).AFRAME;

        if (!AFRAME) {
          throw new Error("A-Frameが初期化されていません。");
        }

        const container = containerRef.current;
        container.replaceChildren();

        Object.assign(container.style, {
          position: "relative",
          isolation: "isolate",
          overflow: "hidden",
          background: "#000",
        });

        // MindARシーンは1つだけ作る
        const sceneElement = document.createElement(
          "a-scene"
        ) as AFrameSceneElement;

        sceneElement.setAttribute(
          "mindar-image",
          [
            "imageTargetSrc: /assets/targets/all-targets.mind",
            "autoStart: false",
            "maxTrack: 1",
            "uiLoading: yes",
            "uiScanning: yes",
            "uiError: yes",
          ].join("; ") + ";"
        );

        sceneElement.setAttribute("color-space", "sRGB");

        sceneElement.setAttribute(
          "renderer",
          "colorManagement: true; alpha: true"
        );

        sceneElement.setAttribute("vr-mode-ui", "enabled: false");

        sceneElement.setAttribute(
          "device-orientation-permission-ui",
          "enabled: false"
        );

        sceneElement.setAttribute("embedded", "");

        Object.assign(sceneElement.style, {
          position: "absolute",
          inset: "0",
          width: "100%",
          height: "100%",
          zIndex: "1",
          background: "transparent",
        });

        // 3Dモデルのアセットを登録
        const assets = document.createElement("a-assets");

        STAMPS.forEach((stamp) => {
          const asset = document.createElement("a-asset-item");

          asset.setAttribute(
            "id",
            `ar-model-${stamp.stampId}`
          );

          asset.setAttribute("src", stamp.modelSrc);
          assets.appendChild(asset);
        });

        sceneElement.appendChild(assets);

        // カメラも1つだけ
        const camera = document.createElement("a-camera");

        camera.setAttribute("position", "0 0 0");
        camera.setAttribute("look-controls", "enabled: false");
        camera.setAttribute("wasd-controls", "enabled: false");

        sceneElement.appendChild(camera);

        // 1つのシーンに全ターゲットと対応モデルを登録
        STAMPS.forEach((stamp, index) => {
          const target = document.createElement("a-entity");

          // all-targets.mind の画像順と一致させる
          target.setAttribute(
            "mindar-image-target",
            `targetIndex: ${index}`
          );

          const model = document.createElement("a-gltf-model");

          model.setAttribute(
            "src",
            `#ar-model-${stamp.stampId}`
          );

          model.setAttribute("position", "0 0 0.1");
          model.setAttribute("rotation", "0 0 0");
          model.setAttribute("scale", "0.2 0.2 0.2");

          target.appendChild(model);

          target.addEventListener("targetFound", () => {
            if (cancelled) return;

            detectedIdRef.current = stamp.stampId;
            setDetectedStampId(stamp.stampId);

            setStatus(
              `${stamp.label}を認識しました。スタンプ獲得ボタンを押してください`
            );

            setErrorMessage("");
          });

          target.addEventListener("targetLost", () => {
            if (cancelled) return;

            if (detectedIdRef.current === stamp.stampId) {
              detectedIdRef.current = null;
              setDetectedStampId(null);
              setStatus("マーカーを探しています...");
            }
          });

          sceneElement.appendChild(target);
        });

        const onARReady = () => {
          if (!cancelled) {
            setStatus(
              "カメラ起動完了。マーカーを映してください"
            );
          }
        };

        const onARError = (event: Event) => {
          console.error("[AR] arError:", event);

          if (!cancelled) {
            setErrorMessage(
              "ARエラーが発生しました。カメラ権限とターゲットファイルを確認してください。"
            );
          }
        };

        sceneElement.addEventListener("arReady", onARReady);
        sceneElement.addEventListener("arError", onARError);

        cleanupEvents = () => {
          sceneElement.removeEventListener("arReady", onARReady);
          sceneElement.removeEventListener("arError", onARError);
        };

        container.appendChild(sceneElement);
        scene = sceneElement;
        sceneRef.current = sceneElement;

        await waitForScene(sceneElement);

        if (cancelled) return;

        const system =
          sceneElement.systems["mindar-image-system"];

        if (!system) {
          throw new Error(
            "MindARシステムが見つかりません。ライブラリを確認してください。"
          );
        }

        systemRef.current = system;

        // MindARの動画はa-sceneの親要素に追加される
        // ただしMindAR自身が設定する映像サイズは上書きしない
        const updateVideoStyles = () => {
          if (cancelled) return;

          const videos = container.querySelectorAll("video");

          videos.forEach((video) => {
            video.style.position = "absolute";
            video.style.zIndex = "0";
            video.style.pointerEvents = "none";
            video.style.maxWidth = "none";
            video.style.maxHeight = "none";

            video.setAttribute("playsinline", "");
            video.setAttribute("autoplay", "");
            video.setAttribute("muted", "");
          });

          const canvas = sceneElement.querySelector("canvas");

          if (canvas) {
            canvas.style.background = "transparent";
          }
        };

        videoObserver = new MutationObserver(updateVideoStyles);

        videoObserver.observe(container, {
          childList: true,
          subtree: true,
        });

        updateVideoStyles();

        setIsReady(true);
        setStatus(
          "ARの準備完了。開始ボタンを押してください"
        );
      } catch (error) {
        console.error("[AR] 初期化失敗:", error);

        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "ARの初期化に失敗しました"
          );

          setStatus("ARを初期化できませんでした");
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      cleanupEvents();
      videoObserver?.disconnect();

      try {
        systemRef.current?.stop();
      } catch (error) {
        console.warn("[AR] 停止時のエラー:", error);
      }

      systemRef.current = null;
      sceneRef.current = null;
      scene?.remove();
    };
  }, [loadScript, waitForScene]);

  const startAR = async () => {
    setErrorMessage("");

    const system = systemRef.current;

    if (!system || !isReady) {
      setErrorMessage(
        "ARの準備ができていません。ページを再読み込みしてください。"
      );
      return;
    }

    try {
      setStatus("カメラを起動しています...");

      // 起動するMindARシステムは1つだけ
      await system.start();

      setIsRunning(true);
      setStatus(
        "カメラ起動完了。マーカーを映してください"
      );
    } catch (error) {
      console.error("[AR] 起動失敗:", error);

      setIsRunning(false);
      setStatus("カメラを起動できませんでした");

      setErrorMessage(
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error)
      );
    }
  };

  const stopAR = () => {
    try {
      systemRef.current?.stop();

      setIsRunning(false);
      detectedIdRef.current = null;
      setDetectedStampId(null);
      setStatus("ARを停止しました");
      setErrorMessage("");
    } catch (error) {
      console.error("[AR] 停止失敗:", error);
      setErrorMessage("ARを停止できませんでした");
    }
  };

  const getStamp = () => {
    try {
      const stampId = detectedIdRef.current;

      if (!stampId || !isRunning) {
        setErrorMessage(
          "マーカーを認識してからスタンプを獲得してください。"
        );
        return;
      }

      const saved = window.localStorage.getItem(
        STAMP_STORAGE_KEY
      );

      const existing: unknown = saved ? JSON.parse(saved) : [];

      const ids = Array.isArray(existing)
        ? existing.filter(
            (value): value is string =>
              typeof value === "string" &&
              STAMPS.some((stamp) => stamp.id === value)
          )
        : [];

      const nextIds = [
        ...new Set([...ids, stampId]),
      ];

      window.localStorage.setItem(
        STAMP_STORAGE_KEY,
        JSON.stringify(nextIds)
      );

      const label =
        STAMPS.find((stamp) => stamp.stampId === stampId)
          ?.label ?? "スタンプ";

      setStatus(`${label}を獲得しました！`);
      setErrorMessage("");

      router.push("/stamp");
    } catch (error) {
      console.error("[AR] スタンプ獲得失敗:", error);
      setErrorMessage("スタンプを獲得できませんでした。");
    }
  };

  const activeTarget =
    STAMPS.find(
      (stamp) => stamp.stampId === detectedStampId
    ) ?? null;

  return (
    <main
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h1>マーカー型 WebAR</h1>

      <p>
        マーカーを認識すると、対応する模型を自動で表示します。
      </p>

      {activeTarget && (
        <p>
          認識中: <strong>{activeTarget.label}</strong>
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={startAR}
          disabled={!isReady || isRunning}
          style={{
            minHeight: 48,
            padding: "12px 16px",
            fontSize: 16,
          }}
        >
          AR開始
        </button>

        <button
          type="button"
          onClick={stopAR}
          disabled={!isRunning}
          style={{
            minHeight: 48,
            padding: "12px 16px",
            fontSize: 16,
          }}
        >
          AR停止
        </button>

        <button
          type="button"
          onClick={getStamp}
          disabled={!detectedStampId || !isRunning}
          style={{
            minHeight: 48,
            padding: "12px 16px",
            fontSize: 16,
          }}
        >
          {activeTarget
            ? `${activeTarget.label}のスタンプ獲得`
            : "スタンプ獲得"}
        </button>
      </div>

      <p aria-live="polite">{status}</p>

      {errorMessage && (
        <pre
          style={{
            color: "red",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {errorMessage}
        </pre>
      )}

      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "70vh",
          minHeight: 360,
          position: "relative",
          isolation: "isolate",
          overflow: "hidden",
          background: "#000",
        }}
      />
    </main>
  );
}
