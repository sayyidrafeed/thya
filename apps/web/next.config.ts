import type { NextConfig } from "next";

// Static export served by nginx (see nginx.conf); redirects and headers live there, not here.
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  typedRoutes: true,
  images: { unoptimized: true },
};

export default nextConfig;
