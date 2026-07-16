import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    // node env: ethers breaks under jsdom (cross-realm Uint8Array). Component
    // tests can opt in with `// @vitest-environment jsdom` per file.
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    testTimeout: 30_000, // ethers scrypt vault encryption is slow
  },
});
