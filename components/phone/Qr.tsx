"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** A QR code for a URL, rendered as inline SVG (crisp on screen and in print). */
export default function Qr({ url, size = 168, className = "" }: { url: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } })
      .then((s) => {
        if (alive) setSvg(s);
      })
      .catch(() => {
        if (alive) setSvg("");
      });
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <div
      className={`overflow-hidden rounded-lg bg-white p-1 [&>svg]:h-full [&>svg]:w-full ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`QR code for ${url}`}
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
