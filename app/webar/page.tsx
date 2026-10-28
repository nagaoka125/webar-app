
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

type TargetRecord = {
  stampId: string;
  label: string;
  modelSrc: string;
  target: HTMLElement;
  model: HTMLElement;
  loaded: boolean;
  loading: boolean;
  loadToken: number;
};

export default function WebARPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const systemRef = useRef<MindARSystem | null>(null);
  const sceneRef = useRef<AFrameSceneElement | null>(null);
  const detectedIdRef = useRef<string | null>(null);
  const targetsRef = useRef<Map<string, TargetRecord>>(new Map());
  const loadingTokensRef = useRef<Map<string, number>>(new Map());
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const runningRef = useRef(false);

  const router = useRouter();

  const [status, setStatus] = useState(
    "ARライブラリを準備しています..."
  );
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [detectedStampId, setDetectedStampId] =
    useState<string | null>(null);

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
          reject(new Error("ARシーンの初期化がタイムアウトしました"));
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

  /**
   * マーカーが認識されたときだけ、対応する3Dモデルを読み込む。
   * 読み込み済みのモデルは再利用する。
   */
  const loadModelForTarget = useCallback(
    (record: TargetRecord) => {
      if (record.loaded || record.loading) {
        return;
      }

      record.loading = true;

      const token =
        (loadingTokensRef.current.get(record.stampId) ?? 0) + 1;

      loadingTokensRef.current.set(record.stampId, token);
      record.loadToken = token;

      setStatus(`${record.label}の模型を読み込んでいます...`);

      // glTFモデルの読み込みはA-Frameに任せる。
      // マーカー認識前にはsrcを設定しない。
      record.model.setAttribute("gltf-model", record.modelSrc);

      const isCurrentLoad = () =>
        loadingTokensRef.current.get(record.stampId) === token;

      const onLoaded = () => {
        record.model.removeEventListener("model-loaded", onLoaded);
        record.model.removeEventListener("model-error", onError);

        if (!isCurrentLoad()) {
          return;
        }

        record.loading = false;
        record.loaded = true;

        if (detectedIdRef.current === record.stampId) {
          setStatus(
            `${record.label}を認識しました。スタンプ獲得ボタンを押してください`
          );
        }
      };

      const onError = (event: Event) => {
        record.model.removeEventListener("model-loaded", onLoaded);
        record.model.removeEventListener("model-error", onError);

        if (!isCurrentLoad()) {
          return;
        }

        record.loading = false;
        record.loaded = false;

        console.error(
          `[AR] モデル読み込み失敗: ${record.modelSrc}`,
          event
        );

        if (detectedIdRef.current === record.stampId) {
          setErrorMessage(
            `${record.label}の模型を読み込めませんでした。モデルのURLとファイル形式を確認してください。`
          );
          setStatus("模型の読み込みに失敗しました");
        }

        // 次回の認識時に再試行できるようにする。
        record.model.removeAttribute("gltf-model");
      };

      record.model.addEventListener("model-loaded", onLoaded);
      record.model.addEventListener("model-error", onError);
    },
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
        setIsReady(false);
        detectedIdRef.current = null;
        targetsRef.current.clear();
        loadingTokensRef.current.clear();

        if (STAMPS.length === 0) {
          throw new Error(
            "STAMPS にマーカー情報が登録されていません。"
          );
        }

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

        // MindARシーンは1つだけ。
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

        // 全モデルのa-assets登録は行わない。
        // モデルはtargetFound後に個別ロードする。

        const camera = document.createElement("a-camera");
        camera.setAttribute("position", "0 0 0");
        camera.setAttribute("look-controls", "enabled: false");
        camera.setAttribute("wasd-controls", "enabled: false");
        sceneElement.appendChild(camera);

        STAMPS.forEach((stamp, index) => {
          const target = document.createElement("a-entity");

          target.setAttribute(
            "mindar-image-target",
            `targetIndex: ${index}`
          );

          // 初期状態ではモデルのsrcを設定しない。
          // 認識されるまで3Dモデルの読み込みを開始しない。
          const model = document.createElement("a-entity");

          model.setAttribute("position", "0 0 0.1");
          model.setAttribute("rotation", "0 0 0");
          model.setAttribute("scale", "0.2 0.2 0.2");

          target.appendChild(model);
          sceneElement.appendChild(target);

          const record: TargetRecord = {
            stampId: stamp.stampId,
            label: stamp.label,
            modelSrc: stamp.modelSrc,
            target,
            model,
            loaded: false,
            loading: false,
            loadToken: 0,
          };

          targetsRef.current.set(stamp.stampId, record);

          target.addEventListener("targetFound", () => {
            if (cancelled) return;

            detectedIdRef.current = stamp.stampId;
            setDetectedStampId(stamp.stampId);
            setErrorMessage("");

            if (record.loaded) {
              setStatus(
                `${stamp.label}を認識しました。スタンプ獲得ボタンを押してください`
              );
            } else {
              loadModelForTarget(record);
            }
          });

          target.addEventListener("targetLost", () => {
            if (cancelled) return;

            if (detectedIdRef.current === stamp.stampId) {
              detectedIdRef.current = null;
              setDetectedStampId(null);
              setStatus("マーカーを探しています...");
              setErrorMessage("");
            }

            // ここではモデルを破棄しない。
            // 再認識時に読み込み済みのモデルを再利用する。
          });
        });

        const onARReady = () => {
          if (!cancelled) {
            setStatus("カメラ起動完了。マーカーを映してください");
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

        // MindARの動画はa-sceneの親要素に追加される。
        // MindAR自身が設定する映像サイズは変更しない。
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
      videoObserver?.disconnect();

      try {
        systemRef.current?.stop();
      } catch (error) {
        console.warn("[AR] 停止時のエラー:", error);
      }

      systemRef.current = null;
      sceneRef.current = null;
      startPromiseRef.current = null;
      runningRef.current = false;

      targetsRef.current.clear();
      loadingTokensRef.current.clear();

      scene?.remove();
    };
  }, [loadScript, waitForScene, loadModelForTarget]);

  const startAR = async () => {
    if (startPromiseRef.current) {
      return;
    }

    setErrorMessage("");

    const system = systemRef.current;

    if (!system || !isReady) {
      setErrorMessage(
        "ARの準備ができていません。ページを再読み込みしてください。"
      );
      return;
    }

    if (runningRef.current) return;

    setStatus("カメラを起動しています...");

    const startPromise = (async () => {
      try {
        await system.start();

        runningRef.current = true;
        setIsRunning(true);
        setStatus("カメラ起動完了。マーカーを映してください");
      } catch (error) {
        console.error("[AR] 起動失敗:", error);

        runningRef.current = false;
        setIsRunning(false);
        setStatus("カメラを起動できませんでした");

        setErrorMessage(
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error)
        );
      } finally {
        startPromiseRef.current = null;
      }
    })();

    startPromiseRef.current = startPromise;
    await startPromise;
  };

  const stopAR = () => {
    try {
      systemRef.current?.stop();

      runningRef.current = false;
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

      if (!stampId || !runningRef.current) {
        setErrorMessage(
          "マーカーを認識してからスタンプを獲得してください。"
        );
        return;
      }

      const saved = window.localStorage.getItem(STAMP_STORAGE_KEY);
      const existing: unknown = saved ? JSON.parse(saved) : [];

      const ids = Array.isArray(existing)
        ? existing.filter(
            (value): value is string =>
              typeof value === "string" &&
              STAMPS.some((stamp) => stamp.id === value)
          )
        : [];

      // stampIdとstamp.idが同じ形式であることを前提に保存する。
      const nextIds = [...new Set([...ids, stampId])];

      window.localStorage.setItem(
        STAMP_STORAGE_KEY,
        JSON.stringify(nextIds)
      );

      const label =
        STAMPS.find((stamp) => stamp.stampId === stampId)?.label ??
        "スタンプ";

      setStatus(`${label}を獲得しました！`);
      setErrorMessage("");

      router.push("/stamp");
    } catch (error) {
      console.error("[AR] スタンプ獲得失敗:", error);
      setErrorMessage("スタンプを獲得できませんでした。");
    }
  };

  const activeTarget =
    STAMPS.find((stamp) => stamp.stampId === detectedStampId) ?? null;

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
        マーカーを認識すると、対応する模型を読み込んで表示します。
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
