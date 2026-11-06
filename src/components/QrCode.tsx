"use client";
// QR code of the courier link, drawn locally with the `qrcode` package (no third-party QR service:
// the link is a bearer secret). Owner: frontend (P0-10).
import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export interface QrCodeProps {
  value: string;
  size?: number;
}

export default function QrCode({ value, size = 216 }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;

    void QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#1F1C18",
        light: "#FFFDF9",
      },
    }).catch(() => {
      // Ignore canvas render errors
    });
  }, [value, size]);

  return (
    <div className="inline-flex flex-col items-center justify-center rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-3.5 shadow-xs">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        aria-label="Courier access QR code"
        className="rounded-lg"
      />
    </div>
  );
}
