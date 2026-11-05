"use client";
// QR code of the courier link, drawn locally with the `qrcode` package (no third-party QR service:
// the link is a bearer secret). Owner: frontend (P0-10).
export interface QrCodeProps {
  value: string;
  size?: number;
}

export default function QrCode(props: QrCodeProps) {
  void props;
  return <div>QR code (not built yet, P0-10)</div>;
}
