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
  const sceneRefsRef = useRef<AFrameSceneElement[]>([]);
  const systemsRef = useRef<Record<string, MindARSystem>>({});
  const targetMapRef = useRef<Record<string, HTMLElement>>({});
  const videoObserverRef = useRef<MutationObserver | null>(null);
  const router = useRouter();

  const [status, setStatus] = useState("ARライブラリを準備しています...");
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [detectedStampId, setDetectedStampId] = useState<string | null>(null);

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

  const showTarget = useCallback((stampId: string | null) => {
    Object.entries(targetMapRef.current).forEach(([id, element]) => {
      element.setAttribute("visible", id === stampId ? "true" : "false");
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        setStatus("ARライブラリを読み込んでいます...");
        setErrorMessage("");
        setDetectedStampId(null);

        await loadScript("/vendor/aframe.min.js");
        await loadScript("/vendor/mindar-image.prod.js");
        await loadScript("/vendor/mindar-image-aframe.prod.js");

        if (cancelled || !containerRef.current) return;

        const container = containerRef.current;
        container.innerHTML = "";
        sceneRefsRef.current = [];
        systemsRef.current = {};
        targetMapRef.current = {};

        const AFRAME = (window as MindARWindow).AFRAME;
        if (!AFRAME) {
          throw new Error("A-Frameが初期化されていません。");
        }

        Object.assign(container.style, {
          position: "relative",
          isolation: "isolate",
          overflow: "hidden",
          background: "#000",
        });

        for (const targetConfig of STAMPS) {
          const sceneElement = document.createElement(
            "a-scene"
          ) as AFrameSceneElement;

          sceneElement.dataset.mindarTargetSrc = targetConfig.targetSrc;
          sceneElement.dataset.targetStampId = targetConfig.stampId;

          sceneElement.setAttribute(
            "mindar-image",
            `imageTargetSrc: ${targetConfig.targetSrc}; autoStart: false;`
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
          modelAsset.setAttribute("id", `ar-model-${targetConfig.stampId}`);
          modelAsset.setAttribute("src", targetConfig.modelSrc);
          assets.appendChild(modelAsset);
          sceneElement.appendChild(assets);

          const camera = document.createElement("a-camera");
          camera.setAttribute("position", "0 0 0");
          camera.setAttribute("look-controls", "enabled: false");
          camera.setAttribute("wasd-controls", "enabled: false");
          sceneElement.appendChild(camera);

          const target = document.createElement("a-entity");
          target.setAttribute("mindar-image-target", "targetIndex: 0");
          target.setAttribute("visible", "false");

          const model = document.createElement("a-gltf-model");
          model.setAttribute("src", `#ar-model-${targetConfig.stampId}`);
          model.setAttribute("position", "0 0 0.1");
          model.setAttribute("rotation", "0 0 0");
          model.setAttribute("scale", "0.2 0.2 0.2");

          target.appendChild(model);
          sceneElement.appendChild(target);

          targetMapRef.current[targetConfig.stampId] = target;

          const onTargetFound = () => {
            if (!cancelled) {
              setDetectedStampId(targetConfig.stampId);
              showTarget(targetConfig.stampId);
              setStatus(
                `${targetConfig.label}を認識しました。スタンプ獲得ボタンを押してください`
              );
            }
          };

          const onTargetLost = () => {
            if (!cancelled) {
              setStatus(`${targetConfig.label}を探しています...`);
              if (detectedStampId === targetConfig.stampId) {
                setDetectedStampId(null);
                showTarget(null);
              }
            }
          };

          const onARReady = () => {
            if (!cancelled) {
              setStatus(`${targetConfig.label}の準備完了。マーカーを映してください`);
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

          container.appendChild(sceneElement);
          sceneRefsRef.current.push(sceneElement);
        }

        await Promise.all(
          sceneRefsRef.current.map((sceneElement) => waitForScene(sceneElement))
        );

        if (cancelled) return;

        for (const sceneElement of sceneRefsRef.current) {
          const stamp = STAMPS.find(
            (item) => item.targetSrc === sceneElement.dataset.mindarTargetSrc
          );

          const system = sceneElement.systems["mindar-image-system"];

          if (system && stamp) {
            systemsRef.current[stamp.stampId] = system;
          }
        }

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

          const canvas = container.querySelector("canvas");
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
        showTarget(null);
        setIsReady(true);
        setStatus("ARの準備完了。マーカーを映してください");
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
      videoObserverRef.current?.disconnect();
      videoObserverRef.current = null;

      Object.values(systemsRef.current).forEach((system) => {
        try {
          system.stop();
        } catch (error) {
          console.warn("[AR] 停止時のエラー:", error);
        }
      });

      systemsRef.current = {};
      sceneRefsRef.current.forEach((scene) => scene.remove());
      sceneRefsRef.current = [];
      targetMapRef.current = {};
      showTarget(null);
    };
  }, [loadScript, showTarget, waitForScene]);

  const startAR = async () => {
    setErrorMessage("");

    const systems = Object.values(systemsRef.current);
    if (!systems.length || !isReady) {
      setErrorMessage("MindARの準備ができていません。ページを再読み込みしてください。");
      return;
    }

    setStatus("カメラを起動しています...");

    try {
      await Promise.all(systems.map((system) => system.start()));
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
      Object.values(systemsRef.current).forEach((system) => system.stop());
      setIsRunning(false);
      setDetectedStampId(null);
      showTarget(null);
      setStatus("ARを停止しました");
      setErrorMessage("");
    } catch (error) {
      console.error("[AR] 停止失敗:", error);
      setErrorMessage("ARを停止できませんでした");
    }
  };

  const getStamp = () => {
    try {
      if (!detectedStampId || !isRunning) {
        setErrorMessage("マーカーを認識してからスタンプを獲得してください。");
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

      const nextIds = [...new Set([...ids, detectedStampId])];
      window.localStorage.setItem(STAMP_STORAGE_KEY, JSON.stringify(nextIds));

      const detectedLabel =
        STAMPS.find((target) => target.stampId === detectedStampId)?.label ?? "スタンプ";

      setDetectedStampId(null);
      showTarget(null);
      setStatus(`${detectedLabel}を獲得しました！`);
      setErrorMessage("");
      router.push("/stamp");
    } catch (error) {
      console.error("[AR] スタンプ獲得失敗:", error);
      setErrorMessage("スタンプを獲得できませんでした。");
    }
  };

  const activeTarget =
    STAMPS.find((target) => target.stampId === detectedStampId) ?? null;

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

      <p>マーカーを認識すると、自動で対応する模型を表示します。</p>

      {activeTarget && (
        <p>
          認識中: <strong>{activeTarget.label}</strong>
        </p>
      )}

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
          disabled={!detectedStampId || !isRunning}
          style={{ minHeight: 48, padding: "12px 16px", fontSize: 16 }}
        >
          {activeTarget ? `${activeTarget.label}のスタンプ獲得` : "スタンプ獲得"}
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