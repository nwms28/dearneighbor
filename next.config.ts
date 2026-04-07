import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalize the Chromium packages so Turbopack/webpack don't try to bundle
  // their native binaries — they're loaded from node_modules at runtime instead.
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core"],
};

export default nextConfig;
