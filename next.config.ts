import type { NextConfig } from "next";

// Static export: the app is plain files on Cloudflare Pages and IPFS (ADR 0001).
// There is no Next server, so no Server Actions, route handlers that read the request,
// cookies, headers, redirects or proxy. The server is the Worker in server/.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    agentFeedback: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
