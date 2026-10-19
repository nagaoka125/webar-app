"use client"

import Link from "next/link"

export default function CameraButton() {
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Link
          href="/webar?autostart=1"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 48,
            minWidth: 160,
            padding: "12px 18px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "#111827",
            color: "white",
            textDecoration: "none",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1.4,
            userSelect: "none",
            WebkitAppearance: "none",
          }}
        >
          ARを起動
        </Link>
      </div>
    </div>
  )
}
