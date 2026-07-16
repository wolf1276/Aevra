import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — output in `out/`, loaded as the Chrome extension popup
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
