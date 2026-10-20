
"use client";

import { useEffect, useRef, useState } from "react";

type MindARSystem = {
  start: () => Promise<void>;
  stop: () => void;
};

type AFrameSceneElement = HTMLElement & {
  hasLoaded: boolean;
  systems: Record<string, MindARSystem | undefined>;
};

type AFrameAPI = {
  registerComponent: (
    name: string,
    definition: object
  ) => void;
  registerSystem: (
    name: string,
    definition: object
  ) => void;
  scenes: AFrameSceneElement[];
};

type MindARWindow = Window & {
  AFRAME?: AFrameAPI;
};

export default function WebARPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const arSystemRef = useRef<MindARSystem | null>(null);

  const [status, setStatus] = useState(
    "ARライブラリを準備しています..."
  );
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let scene: AFrameSceneElement | null = null;
    let targetEntity: HTMLElement | null = null;

    const loadScript = (src: string): Promise<void> =>
      new Promise((resolve, reject) => {
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

    const waitForScene = (
      sceneElement: AFrameSceneElement
    ): Promise<void> =>
      new Promise((resolve, reject) => {
        if (sceneElement.hasLoaded) {
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
          sceneElement.removeEventListener("loaded", onLoaded);
        };

        sceneElement.addEventListener("loaded", onLoaded);
      });

    async function initialize() {
      try {
        setStatus("ARライブラリを読み込んでいます...");

        // A-Frameを先に読み込む
        await loadScript("/vendor/aframe.min.js");
        await loadScript("/vendor/mindar-image.prod.js");
        await loadScript("/vendor/mindar-image-aframe.prod.js");

        if (cancelled || !containerRef.current) return;

        const AFRAME = (window as MindARWindow).AFRAME;

        if (!AFRAME) {
          throw new Error(
            "A-Frameが初期化されていません。ライブラリを確認してください。"
          );
        }

        // ARシーンを作成
        const sceneElement = document.createElement(
          "a-scene"
        ) as AFrameSceneElement;

        sceneElement.setAttribute(
          "mindar-image",
          "imageTargetSrc: /assets/targets/targets.mind;"
        );

        sceneElement.setAttribute("color-space", "sRGB");

        sceneElement.setAttribute(
          "renderer",
          "colorManagement: true; physicallyCorrectLights: true;"
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
        });

        // モデルを登録
        const assets = document.createElement("a-assets");

        const modelAsset = document.createElement("a-asset-item");
        modelAsset.setAttribute("id", "ar-model");
        modelAsset.setAttribute(
          "src",
          "/assets/models/model.glb"
        );

        assets.appendChild(modelAsset);
        sceneElement.appendChild(assets);

        // カメラ
        const camera = document.createElement("a-camera");
        camera.setAttribute("position", "0 0 0");
        camera.setAttribute("look-controls", "enabled: false");

        sceneElement.appendChild(camera);

        // 画像マーカーと3Dモデル
        const target = document.createElement("a-entity");

        target.setAttribute(
          "mindar-image-target",
          "targetIndex: 0"
        );

        const model = document.createElement("a-gltf-model");
        model.setAttribute("src", "#ar-model");
        model.setAttribute("position", "0 0 0.1");
        model.setAttribute("rotation", "0 0 0");
        model.setAttribute("scale", "0.2 0.2 0.2");

        target.appendChild(model);
        sceneElement.appendChild(target);

        targetEntity = target;
        scene = sceneElement;

        // マーカー認識イベント
        const onTargetFound = () => {
          if (!cancelled) {
            setStatus("マーカーを認識しました");
          }
        };

        const onTargetLost = () => {
          if (!cancelled) {
            setStatus("マーカーを探しています...");
          }
        };

        const onARReady = () => {
          console.log("[AR] arReady: ARエンジン準備完了");
          if (!cancelled) {
            setStatus("カメラ起動完了。マーカーを映してください");
          }
        };

        const onARError = (event: Event) => {
          console.error("[AR] arError:", event);

          if (!cancelled) {
            setErrorMessage(
              "ARエンジンでエラーが発生しました。コンソールを確認してください。"
            );
          }
        };

        target.addEventListener("targetFound", onTargetFound);
        target.addEventListener("targetLost", onTargetLost);

        sceneElement.addEventListener("arReady", onARReady);
        sceneElement.addEventListener("arError", onARError);

        // クリーンアップで解除できるようにイベントを保持
        sceneElement.dataset.webarEvents = "attached";

        containerRef.current.appendChild(sceneElement);

        await waitForScene(sceneElement);

        if (cancelled) return;

        console.log("[AR] Scene loaded:", sceneElement.hasLoaded);
        console.log(
          "[AR] Registered systems:",
          Object.keys(sceneElement.systems)
        );

        const system =
          sceneElement.systems["mindar-image-system"];

        if (!system) {
          throw new Error(
            "MindARシステムが見つかりません。ライブラリの読み込み順とファイルを確認してください。"
          );
        }

        arSystemRef.current = system;
        setIsReady(true);
        setStatus("ARの準備完了。開始ボタンを押してください");

        // カメラ映像の状態を確認するだけ。スタイルは変更しない
        window.setTimeout(() => {
          if (cancelled) return;

          const videos = sceneElement.querySelectorAll("video");

          console.log("[AR] video要素数:", videos.length);

          videos.forEach((video, index) => {
            console.log(`[AR] video ${index}`, {
              readyState: video.readyState,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              paused: video.paused,
            });
          });
        }, 2000);

        // イベント解除用の参照を保持
        cleanupEvents = () => {
          target.removeEventListener("targetFound", onTargetFound);
          target.removeEventListener("targetLost", onTargetLost);
          sceneElement.removeEventListener("arReady", onARReady);
          sceneElement.removeEventListener("arError", onARError);
        };
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
    }

    let cleanupEvents = () => {};

    initialize();

    return () => {
      cancelled = true;
      cleanupEvents();

      try {
        arSystemRef.current?.stop();
      } catch (error) {
        console.warn("[AR] 停止時のエラー:", error);
      }

      arSystemRef.current = null;
      scene?.remove();
      targetEntity = null;
    };
  }, []);

  const startAR = async () => {
    setErrorMessage("");

    const system = arSystemRef.current;

    if (!system || !isReady) {
      setErrorMessage(
        "MindARの準備ができていません。ページを再読み込みしてください。"
      );
      return;
    }

    setStatus("カメラを起動しています...");

    try {
      console.log("[AR] start() を実行します");

      // iPhone Safariではユーザーの操作から直接起動する
      await system.start();

      console.log("[AR] start() が完了しました");

      setIsRunning(true);
      setStatus("カメラ起動完了。マーカーを映してください");

      window.setTimeout(() => {
        const sceneElement = containerRef.current?.querySelector(
          "a-scene"
        );

        const videos = sceneElement?.querySelectorAll("video");

        console.log("[AR] video要素数:", videos?.length ?? 0);

        videos?.forEach((video, index) => {
          console.log(`[AR] video ${index}`, {
            readyState: video.readyState,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            paused: video.paused,
          });
        });
      }, 1500);
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
      setStatus("ARを停止しました");
      setErrorMessage("");
    } catch (error) {
      console.error("[AR] 停止失敗:", error);
      setErrorMessage("ARを停止できませんでした");
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
          overflow: "hidden",
          background: "#222",
        }}
      />
    </main>
  );
}
