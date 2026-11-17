"use client"

import Link from "next/link"

type CameraButtonProps = {
  className?: string
}

export default function CameraButton({ className = "" }: CameraButtonProps) {
  return (
    <Link
      href="/webar?autostart=1"
      className={`camera-launch-button ${className}`.trim()}
      aria-label="ARを起動"
    >
      <div className="camera-icon-wrapper">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </div>
    </Link>
  )
}
