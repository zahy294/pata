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
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [],
  };
}
