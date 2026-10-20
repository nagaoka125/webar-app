
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

  const [status, setStatus] = useState("ARの準備ができています");
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let scene: AFrameSceneElement | null = null;
    let onLoaded: (() => void) | null = null;
    let onTargetFound: (() => void) | null = null;
    let onTargetLost: (() => void) | null = null;
    let onError: ((event: Event) => void) | null = null;

    const loadScript = (src: string) =>
      new Promise<void>((resolve, reject) => {
        const existing = document.querySelector(
          `script[data-webar-src="${src}"]`
        ) as HTMLScriptElement | null;

        if (existing?.dataset.loaded === "true") {
          resolve();
          return;
        }

        if (existing) {
          existing.addEventListener("load", () => resolve(), {
            once: true,
          });
          existing.addEventListener(
            "error",
            () => reject(new Error(`読み込み失敗: ${src}`)),
            { once: true }
          );
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

        script.onerror = () =>
          reject(new Error(`ライブラリを読み込めません: ${src}`));

        document.head.appendChild(script);
      });

    async function initialize() {
      try {
        setStatus("ARライブラリを読み込んでいます...");

        // A-Frame を先に読み込む
        await loadScript("/vendor/mindar-image.prod.js");
        await loadScript("/vendor/aframe.min.js");
        await loadScript("/vendor/mindar-image-aframe.prod.js");

        if (cancelled || !containerRef.current) return;

        const AFRAME = (window as MindARWindow).AFRAME;

        if (!AFRAME) {
          throw new Error("A-Frame が初期化されていません");
        }

        // コンテナ内にARシーンを作成
        const sceneElement = document.createElement("a-scene") as AFrameSceneElement;

        sceneElement.setAttribute(
          "mindar-image",
          "imageTargetSrc: /assets/targets/targets.mind; autoStart: false;"
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
        sceneElement.style.width = "100%";
        sceneElement.style.height = "100%";

        const assets = document.createElement("a-assets");
        const modelAsset = document.createElement("a-asset-item");
        modelAsset.setAttribute("id", "ar-model");
        modelAsset.setAttribute("src", "/assets/models/model.glb");
        assets.appendChild(modelAsset);
        sceneElement.appendChild(assets);

        const camera = document.createElement("a-camera");
        camera.setAttribute("position", "0 0 0");
        camera.setAttribute("look-controls", "enabled: false");
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

        containerRef.current.appendChild(sceneElement);
        scene = sceneElement;

        onLoaded = () => {
          if (!cancelled) setStatus("ARの準備完了。開始ボタンを押してください");
        };

        onTargetFound = () => {
          if (!cancelled) setStatus("マーカーを認識しました");
        };

        onTargetLost = () => {
          if (!cancelled) setStatus("マーカーを探しています...");
        };

        onError = (event: Event) => {
          console.error("AR scene error:", event);
          if (!cancelled) {
            setErrorMessage("ARシーンでエラーが発生しました。コンソールを確認してください。");
          }
        };

        sceneElement.addEventListener("loaded", onLoaded);
        target.addEventListener("targetFound", onTargetFound);
        target.addEventListener("targetLost", onTargetLost);
        sceneElement.addEventListener("renderstart", onLoaded);
        sceneElement.addEventListener("arError", onError);

        // A-Frame の scene 初期化完了を待つ
        await new Promise<void>((resolve, reject) => {
          if (sceneElement.hasLoaded) {
            resolve();
            return;
          }

          const timeout = window.setTimeout(() => {
            reject(new Error("ARシーンの初期化がタイムアウトしました"));
          }, 15000);

          sceneElement.addEventListener(
            "loaded",
            () => {
              window.clearTimeout(timeout);
              resolve();
            },
            { once: true }
          );
        });

        if (cancelled) return;

        console.log(
          "Scene loaded:",
          sceneElement.hasLoaded
        );

        console.log(
          "Registered systems:",
          Object.keys(sceneElement.systems)
        );

        const system = sceneElement.systems["mindar-image-system"];

        if (!system) {
          throw new Error("MindAR システムが見つかりません。ライブラリの読み込みを確認してください。");
        }
        arSystemRef.current = system;

        arSystemRef.current = system;
        setStatus("ARの準備完了。開始ボタンを押してください");
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "ARの初期化に失敗しました"
          );
          setStatus("ARを初期化できませんでした");
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;

      if (scene) {
        if (onLoaded) scene.removeEventListener("loaded", onLoaded);
        if (onError) scene.removeEventListener("arError", onError);

        const target = scene.querySelector("[mindar-image-target]");
        if (target && onTargetFound) {
          target.removeEventListener("targetFound", onTargetFound);
        }
        if (target && onTargetLost) {
          target.removeEventListener("targetLost", onTargetLost);
        }
      }

      try {
        arSystemRef.current?.stop();
      } catch (error) {
        console.warn("AR停止時のエラー:", error);
      }

      arSystemRef.current = null;
      scene?.remove();
    };
  }, []);

  const startAR = async () => {
    setErrorMessage("");

    try {
      if (!arSystemRef.current) {
        throw new Error("ARの準備がまだできていません。少し待ってください。");
      }

      setStatus("カメラを起動しています...");

      await arSystemRef.current.start();

      setIsRunning(true);
      setStatus("マーカーをカメラに映してください");
    } catch (error) {
      console.error("AR start error:", error);

      setIsRunning(false);
      setStatus("ARを開始できませんでした");

      setErrorMessage(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const stopAR = () => {
    try {
      arSystemRef.current?.stop();
      setIsRunning(false);
      setStatus("AR停止中");
      setErrorMessage("");
    } catch (error) {
      console.error(error);
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

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={startAR}
          disabled={isRunning}
          style={{ minHeight: 48, padding: "12px 16px" }}
        >
          AR開始
        </button>

        <button
          type="button"
          onClick={stopAR}
          disabled={!isRunning}
          style={{ minHeight: 48, padding: "12px 16px" }}
        >
          AR停止
        </button>
      </div>

      <p>{status}</p>

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
          overflow: "hidden",
          position: "relative",
          background: "#222",
        }}
      />
    </main>
  );
}
