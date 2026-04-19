"use client";

import { useEffect } from "react";

export default function GameError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GameError]", error);
  }, [error]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
      style={{ background: "#0B0E14" }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-3xl"
        style={{ background: "#141920", border: "1px solid #252D3D" }}
      >
        ⚠️
      </div>
      <p className="text-white font-rajdhani font-bold text-lg mb-2">
        Something went wrong
      </p>
      <p className="text-sm mb-6" style={{ color: "#8A95A8" }}>
        The page couldn&apos;t load. Please try again.
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 rounded-xl font-bold text-sm transition-opacity hover:opacity-80"
        style={{ background: "#3FEFB4", color: "#0B0E14" }}
      >
        Try Again
      </button>
    </div>
  );
}
