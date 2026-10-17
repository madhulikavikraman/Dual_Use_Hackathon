import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Volunteers' phones reach the dev server over the venue Wi-Fi (a LAN IP) or a tunnel; without these the dev
  // server refuses their requests for dev assets. Development only; production builds ignore this list.
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.loca.lt",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
  ],
  partialPrefetching: true,
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
