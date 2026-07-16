// Builds the Chrome extension into `out/`:
// 1. `next build` (static export) → popup UI in out/
// 2. esbuild bundles background service worker
// 3. copies manifest.json and icons
import { execSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

import { build } from "esbuild";

execSync("pnpm next build", { stdio: "inherit" });

// MV3 CSP forbids inline scripts; Next's static export bootstraps with them.
// Extract each inline <script> into an external file and reference it by src.
for (const name of readdirSync("out").filter((f) => f.endsWith(".html"))) {
  let i = 0;
  const html = readFileSync(`out/${name}`, "utf8").replace(
    /<script>([\s\S]*?)<\/script>/g,
    (_, body) => {
      const file = `_inline-${name.replace(/\.html$/, "")}-${i++}.js`;
      writeFileSync(`out/${file}`, body);
      return `<script src="./${file}"></script>`;
    },
  );
  writeFileSync(`out/${name}`, html);
}

await build({
  entryPoints: {
    background: "src/extension/background/index.ts",
  },
  bundle: true,
  format: "esm",
  target: "chrome120",
  outdir: "out",
  minify: true,
  drop: ["debugger"],
});

cpSync("src/extension/manifest.json", "out/manifest.json");
if (existsSync("public/icons")) cpSync("public/icons", "out/icons", { recursive: true });

console.log("\nExtension built → load `out/` as unpacked at chrome://extensions");
