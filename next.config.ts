import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.youtube.com" },
      { protocol: "https", hostname: "*.ytimg.com" },
    ],
  },
};

export default nextConfig;
