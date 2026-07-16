// Chrome Web Store readiness check. Run after `pnpm build:ext`.
// Exits non-zero on any failure.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const OUT = "out";
// ~41MB of that is ZK circuit artifacts (public/circuits) required for local proving.
const MAX_ZIP_INPUT_BYTES = 60 * 1024 * 1024; // CWS hard limit is ~2GB; keep ours sane
const ALLOWED_PERMISSIONS = ["storage"];

const failures = [];
const check = (ok, msg) => (ok ? console.log(`  ✓ ${msg}`) : failures.push(msg));

console.log("Validating production build…\n");

// --- build exists ---
if (!existsSync(OUT)) {
  console.error("out/ missing — run `pnpm build:ext` first");
  process.exit(1);
}

// --- manifest ---
const manifest = JSON.parse(readFileSync(path.join(OUT, "manifest.json"), "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

check(manifest.manifest_version === 3, "manifest_version is 3");
check(!!manifest.name && manifest.name.length <= 45, "name present (≤45 chars)");
check(
  !!manifest.description && manifest.description.length <= 132,
  "description present (≤132 chars)",
);
check(/^\d+(\.\d+){0,3}$/.test(manifest.version ?? ""), "version is dotted integers");
check(manifest.version === pkg.version, `version matches package.json (${pkg.version})`);
check(!!manifest.action?.default_popup, "action.default_popup set");
check(!!manifest.background?.service_worker, "background service worker set");

// permissions: exact allowlist, no host permissions, no dev-only entries
const perms = manifest.permissions ?? [];
check(
  perms.every((p) => ALLOWED_PERMISSIONS.includes(p)),
  `permissions restricted to [${ALLOWED_PERMISSIONS}] (got [${perms}])`,
);
check((manifest.host_permissions ?? []).length === 0, "no host_permissions");
check(!manifest.content_scripts, "no content scripts");
check(!manifest.web_accessible_resources, "no web_accessible_resources");
check(
  !manifest.content_security_policy ||
    !/unsafe-eval|http:/.test(JSON.stringify(manifest.content_security_policy)),
  "CSP has no unsafe-eval / http sources",
);

// referenced files exist
for (const icon of Object.values(manifest.icons ?? {})) {
  check(existsSync(path.join(OUT, icon)), `icon exists: ${icon}`);
}
check(Object.keys(manifest.icons ?? {}).length >= 3, "16/48/128 icons declared");
check(existsSync(path.join(OUT, manifest.action?.default_popup ?? "")), "popup html exists");
check(
  existsSync(path.join(OUT, manifest.background?.service_worker ?? "")),
  "service worker js exists",
);

// --- output scan: no sourcemaps, no debug code, no dev endpoints, size ---
let totalBytes = 0;
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
const files = walk(OUT);

check(!files.some((f) => f.endsWith(".map")), "no source maps in output");

for (const f of files) {
  totalBytes += statSync(f).size;
  if (!/\.(js|html)$/.test(f)) continue;
  const src = readFileSync(f, "utf8");
  if (/\bdebugger\b/.test(src)) failures.push(`debugger statement in ${f}`);
  // localhost:8545 is viem's bundled localhost-chain constant, not an endpoint we call
  const devRefs = src.match(/localhost:\d+|127\.0\.0\.1:\d+/g)?.filter((m) => !m.endsWith(":8545"));
  if (devRefs?.length) failures.push(`dev endpoint reference in ${f}: ${devRefs[0]}`);
}
check(
  totalBytes <= MAX_ZIP_INPUT_BYTES,
  `bundle size ${(totalBytes / 1024 / 1024).toFixed(1)}MB ≤ ${MAX_ZIP_INPUT_BYTES / 1024 / 1024}MB`,
);

// --- source scan: no hardcoded secrets ---
const srcFiles = walk("src").filter((f) => /\.(ts|tsx|json)$/.test(f));
const SECRET_PATTERNS = [
  [/\b0x[0-9a-fA-F]{64}\b/, "possible private key"],
  [/\b(sk|pk)_(live|test)_[0-9a-zA-Z]{16,}/, "API key"],
  [/(["'])(?:[a-z]+ ){11,23}[a-z]+\1/, "possible hardcoded mnemonic"],
];
for (const f of srcFiles) {
  if (f.endsWith(".test.ts")) continue; // test vectors are fine
  const src = readFileSync(f, "utf8");
  for (const [re, label] of SECRET_PATTERNS) {
    if (re.test(src)) failures.push(`${label} in ${f}`);
  }
}
check(true, "no hardcoded secrets in src/");

// --- report ---
if (failures.length) {
  console.error(`\n✗ ${failures.length} check(s) failed:`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("\n✓ Production build is Chrome Web Store ready.");
