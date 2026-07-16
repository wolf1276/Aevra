// Builds the Chrome extension into `out/`:
// 1. `next build` (static export) → popup UI in out/
// 2. esbuild bundles background service worker
// 3. copies manifest.json and icons
import { execSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

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

// Chrome refuses to load extensions containing any file/dir starting with "_"
// (reserved for the system). Next's static export always emits `_next/`, and
// our inline-script extraction above used `_inline-*.js` — rename both and
// fix up every reference.
if (existsSync("out/_next")) renameSync("out/_next", "out/next");
for (const f of readdirSync("out")) {
  if (f.startsWith("_inline-")) renameSync(`out/${f}`, `out/${f.slice(1)}`);
}
// Chrome's underscore-prefix ban applies recursively, not just at the
// package root — rename every remaining `_foo` file/dir bottom-up so
// directory renames don't invalidate already-computed child paths.
for (const f of readdirSync("out", { withFileTypes: true, recursive: true }).sort(
  (a, b) => b.parentPath.length - a.parentPath.length,
)) {
  if (f.name.startsWith("_")) {
    renameSync(`${f.parentPath}/${f.name}`, `${f.parentPath}/${f.name.slice(1)}`);
  }
}
for (const f of readdirSync("out", { withFileTypes: true, recursive: true })) {
  if (!f.isFile() || !/\.(html|js|css|txt)$/.test(f.name)) continue;
  const p = `${f.parentPath}/${f.name}`;
  const src = readFileSync(p, "utf8");
  const fixed = src
    .replaceAll("_next/", "next/")
    .replaceAll("./_inline-", "./inline-")
    .replaceAll("/_buildManifest", "/buildManifest")
    .replaceAll("/_ssgManifest", "/ssgManifest")
    .replaceAll("pages/_app", "pages/app")
    .replaceAll("pages/_error", "pages/error")
    .replaceAll("/_not-found", "/not-found");
  if (fixed !== src) writeFileSync(p, fixed);
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
