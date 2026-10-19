
"use client";

import React, { useEffect, useRef, useState } from "react";

export default function WebARPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [status, setStatus] = useState("カメラ停止中");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const toggleCamera = async () => {
    // カメラ停止
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }

      streamRef.current = null;
      setIsCameraOn(false);
      setStatus("カメラ停止中");
      setErrorMessage("");
      return;
    }

    setErrorMessage("");
    setStatus("カメラを起動しています...");

    let newStream: MediaStream | null = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "カメラAPIが利用できません。HTTPSでアクセスしてください。"
        );
      }

      const video = videoRef.current;

      if (!video) {
        throw new Error("映像表示用のvideo要素が見つかりません。");
      }

      // iPhone Safari対策
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.muted = true;
      video.autoplay = true;

      // 背面カメラを優先
      newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      // カメラ取得中にvideo要素が失われていないか確認
      if (!videoRef.current) {
        newStream.getTracks().forEach((track) => track.stop());
        return;
      }

      video.srcObject = newStream;

      // 停止処理や再生処理で参照できるように保存
      streamRef.current = newStream;

      // Safariで映像の再生を明示的に開始
      await video.play();

      setIsCameraOn(true);
      setStatus("カメラ映像を表示中");
    } catch (error) {
      console.error("Camera error:", error);

      // 起動に失敗した場合はカメラを解放
      newStream?.getTracks().forEach((track) => track.stop());

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }

      streamRef.current = null;
      setIsCameraOn(false);
      setStatus("カメラを起動できませんでした");

      const e = error as Error;
      setErrorMessage(`${e.name}: ${e.message}`);
    }
  };

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 16,
      }}
    >
      <h1>Webカメラテスト</h1>

      <button
        type="button"
        onClick={toggleCamera}
        style={{
          minHeight: 48,
          padding: "12px 16px",
          fontSize: 16,
        }}
      >
        {isCameraOn ? "カメラ停止" : "カメラ起動"}
      </button>

      <p>{status}</p>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        controls={false}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          minHeight: 240,
          backgroundColor: "#222",
          objectFit: "contain",
        }}
      />

      {errorMessage && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            color: "red",
            overflowWrap: "anywhere",
          }}
        >
          {errorMessage}
        </pre>
      )}
    </main>
  );
}
