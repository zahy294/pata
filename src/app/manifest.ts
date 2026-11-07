// Web app manifest, built to /manifest.webmanifest under static export (nextjs-pwa.md).
// Owner: frontend. Local 192/512 PNGs match the landscape app icon in the header.
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pata",
    short_name: "Pata",
    description: "Your door, shared only by consent.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF5EC",
    theme_color: "#123B2B",
    icons: [
      { src: "/icons/pata-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/pata-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
