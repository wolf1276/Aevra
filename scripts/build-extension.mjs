// Builds the Chrome extension into `out/`:
// 1. `next build` (static export) → popup UI in out/
// 2. esbuild bundles background service worker + content script
// 3. copies manifest.json and icons
import { execSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";

import { build } from "esbuild";

execSync("pnpm next build", { stdio: "inherit" });

await build({
  entryPoints: {
    background: "src/extension/background/index.ts",
    content: "src/extension/content/index.ts",
  },
  bundle: true,
  format: "esm",
  target: "chrome120",
  outdir: "out",
  minify: process.env.NODE_ENV === "production",
});

cpSync("src/extension/manifest.json", "out/manifest.json");
if (existsSync("public/icons")) cpSync("public/icons", "out/icons", { recursive: true });

console.log("\nExtension built → load `out/` as unpacked at chrome://extensions");
