import { withSentryConfig } from "@sentry/nextjs";

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
  async redirects() {
    return [
      // Canonicalize: the old Vercel default domain bounces to skripr.app.
      // Auth (production Clerk) is bound to clerk.skripr.app, so the
      // *.vercel.app host would be a broken-auth dead end otherwise.
      {
        source: "/:path*",
        has: [{ type: "host", value: "skripr.vercel.app" }],
        destination: "https://skripr.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
});
