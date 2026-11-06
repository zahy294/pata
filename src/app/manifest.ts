// Web app manifest, built to /manifest.webmanifest under static export (nextjs-pwa.md).
// Owner: frontend. Icons (192 and 512 PNG) are added in hours 28–34.
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
