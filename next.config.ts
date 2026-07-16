import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — output in `out/`, loaded as the Chrome extension popup
  output: "export",
  images: { unoptimized: true },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // snarkjs (inside @avalabs/eerc-sdk) references node builtins it never
      // uses in the browser proof path — stub them out of the client bundle.
      // `node:` scheme imports bypass resolve.fallback, so strip the prefix.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        readline: false,
        constants: false,
        worker_threads: false,
      };
    }
    return config;
  },
};

export default nextConfig;
