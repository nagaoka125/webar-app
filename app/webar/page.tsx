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
  registerComponent: (name: string, definition: object) => void;
  registerSystem: (name: string, definition: object) => void;
  scenes: AFrameSceneElement[];
};

type MindARWindow = Window & {
  AFRAME?: AFrameAPI;
};

export default function WebARPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const arSystemRef = useRef<MindARSystem | null>(null);
  const sceneRef = useRef<AFrameSceneElement | null>(null);
  const videoObserverRef = useRef<MutationObserver | null>(null);
  const router = useRouter();

  const [status, setStatus] = useState("ARライブラリを準備しています...");
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isARSuccsess, setIsARSuccsess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
    (sceneElement: AFrameSceneElement): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (sceneElement.hasLoaded) {
          resolve();
          return;
        }

        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error("ARシーンの初期化がタイムアウトしました"));
        }, 20000);

        const onLoaded = () => {
          cleanup();
          resolve();
        };

        const cleanup = () => {
          window.clearTimeout(timeout);
          sceneElement.removeEventListener("loaded", onLoaded);
        };

        sceneElement.addEventListener("loaded", onLoaded);
      });
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    let cleanupEvents = () => {};
    let scene: AFrameSceneElement | null = null;

    const initialize = async () => {
      try {
        setStatus("ARライブラリを読み込んでいます...");

        await loadScript("/vendor/aframe.min.js");
        await loadScript("/vendor/mindar-image.prod.js");
        await loadScript("/vendor/mindar-image-aframe.prod.js");

        if (cancelled || !containerRef.current) return;

        const AFRAME = (window as MindARWindow).AFRAME;

        if (!AFRAME) {
          throw new Error("A-Frameが初期化されていません。");
        }

        const container = containerRef.current;

        Object.assign(container.style, {
          position: "relative",
          isolation: "isolate",
          overflow: "hidden",
          background: "#000",
        });

        const sceneElement = document.createElement(
          "a-scene"
        ) as AFrameSceneElement;

        sceneElement.setAttribute(
          "mindar-image",
          "imageTargetSrc: /assets/targets/targets.mind; autoStart: false;"
        );
        sceneElement.setAttribute("color-space", "sRGB");
        sceneElement.setAttribute(
          "renderer",
          "colorManagement: true; alpha: true; physicallyCorrectLights: true"
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

        const assets = document.createElement("a-assets");
        const modelAsset = document.createElement("a-asset-item");

        modelAsset.setAttribute("id", "ar-model");
        modelAsset.setAttribute("src", "/assets/models/model.glb");
        assets.appendChild(modelAsset);
        sceneElement.appendChild(assets);

        const camera = document.createElement("a-camera");
        camera.setAttribute("position", "0 0 0");
        camera.setAttribute("look-controls", "enabled: false");
        camera.setAttribute("wasd-controls", "enabled: false");
        sceneElement.appendChild(camera);

        const target = document.createElement("a-entity");
        target.setAttribute("mindar-image-target", "targetIndex: 0");

        const model = document.createElement("a-gltf-model");
        model.setAttribute("src", "#ar-model");
        model.setAttribute("position", "0 0 0.1");
        model.setAttribute("rotation", "0 0 0");
        model.setAttribute("scale", "0.2 0.2 0.2");

        target.appendChild(model);
        sceneElement.appendChild(target);

        const onTargetFound = () => {
          if (!cancelled) {
            setIsARSuccsess(true);
            setStatus("マーカーを認識しました。スタンプ獲得ボタンを押してください");
          }
        };

        const onTargetLost = () => {
          if (!cancelled) {
            setIsARSuccsess(false);
            setStatus("マーカーを探しています...");
          }
        };

        const onARReady = () => {
          if (!cancelled) {
            setStatus("カメラ起動完了。マーカーを映してください");
          }
        };

        const onARError = (event: Event) => {
          console.error("[AR] arError:", event);

          if (!cancelled) {
            setErrorMessage(
              "ARエンジンでエラーが発生しました。カメラ権限と画像ターゲットを確認してください。"
            );
          }
        };

        target.addEventListener("targetFound", onTargetFound);
        target.addEventListener("targetLost", onTargetLost);
        sceneElement.addEventListener("arReady", onARReady);
        sceneElement.addEventListener("arError", onARError);

        cleanupEvents = () => {
          target.removeEventListener("targetFound", onTargetFound);
          target.removeEventListener("targetLost", onTargetLost);
          sceneElement.removeEventListener("arReady", onARReady);
          sceneElement.removeEventListener("arError", onARError);
        };

        container.appendChild(sceneElement);
        scene = sceneElement;
        sceneRef.current = sceneElement;

        await waitForScene(sceneElement);

        if (cancelled) return;

        const system = sceneElement.systems["mindar-image-system"];

        if (!system) {
          throw new Error(
            "MindARシステムが見つかりません。vendor内のライブラリを確認してください。"
          );
        }

        arSystemRef.current = system;

        const updateVideoStyles = () => {
          if (cancelled) return;

          const videos = container.querySelectorAll("video");

          videos.forEach((video) => {
            Object.assign(video.style, {
              position: "absolute",
              zIndex: "0",
              pointerEvents: "none",
              maxWidth: "none",
              maxHeight: "none",
            });

            video.setAttribute("playsinline", "");
            video.setAttribute("autoplay", "");
            video.setAttribute("muted", "");
          });

          const canvas = sceneElement.querySelector("canvas");

          if (canvas) {
            canvas.style.background = "transparent";
          }
        };

        const observer = new MutationObserver(updateVideoStyles);
        observer.observe(container, {
          childList: true,
          subtree: true,
        });
        videoObserverRef.current = observer;

        updateVideoStyles();

        setIsReady(true);
        setStatus("ARの準備完了。開始ボタンを押してください");
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
      videoObserverRef.current?.disconnect();
      videoObserverRef.current = null;

      try {
        arSystemRef.current?.stop();
      } catch (error) {
        console.warn("[AR] 停止時のエラー:", error);
      }

      arSystemRef.current = null;
      sceneRef.current = null;
      scene?.remove();
    };
  }, [loadScript, waitForScene]);

  const startAR = async () => {
    setErrorMessage("");

    const system = arSystemRef.current;

    if (!system || !isReady) {
      setErrorMessage("MindARの準備ができていません。ページを再読み込みしてください。");
      return;
    }

    setIsARSuccsess(false);
    setStatus("カメラを起動しています...");

    try {
      await system.start();

      setIsRunning(true);
      setStatus("カメラ起動完了。マーカーを映してください");
    } catch (error) {
      console.error("[AR] カメラ起動失敗:", error);

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
      arSystemRef.current?.stop();
      setIsRunning(false);
      setIsARSuccsess(false);
      setStatus("ARを停止しました");
      setErrorMessage("");
    } catch (error) {
      console.error("[AR] 停止失敗:", error);
      setErrorMessage("ARを停止できませんでした");
    }
  };

  const getStamp = () => {
    try {
      if (!isARSuccsess || !isRunning) {
        setErrorMessage("マーカーを認識してからスタンプを獲得してください。");
        return;
      }

      const stampId = STAMPS[0]?.id;

      if (!stampId) {
        setErrorMessage("獲得できるスタンプがありません。");
        return;
      }

      const saved = window.localStorage.getItem(STAMP_STORAGE_KEY);
      const existing = saved ? JSON.parse(saved) : [];
      const ids = Array.isArray(existing)
        ? existing.filter(
            (value): value is string =>
              typeof value === "string" &&
              STAMPS.some((stamp) => stamp.id === value)
          )
        : [];

      const nextIds = [...new Set([...ids, stampId])];
      window.localStorage.setItem(STAMP_STORAGE_KEY, JSON.stringify(nextIds));

      setIsARSuccsess(false);
      setStatus("スタンプを獲得しました！");
      setErrorMessage("");
      router.push("/stamp");
    } catch (error) {
      console.error("[AR] スタンプ獲得失敗:", error);
      setErrorMessage("スタンプを獲得できませんでした。");
    }
  };

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

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={startAR}
          disabled={!isReady || isRunning}
          style={{ minHeight: 48, padding: "12px 16px", fontSize: 16 }}
        >
          AR開始
        </button>

        <button
          type="button"
          onClick={stopAR}
          disabled={!isRunning}
          style={{ minHeight: 48, padding: "12px 16px", fontSize: 16 }}
        >
          AR停止
        </button>

        <button
          type="button"
          onClick={getStamp}
          disabled={!isARSuccsess || !isRunning}
          style={{ minHeight: 48, padding: "12px 16px", fontSize: 16 }}
        >
          スタンプ獲得
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
