// Loads the built extension (out/) into Chromium and smoke-tests the popup.
// Requires `pnpm build:ext` to have run first.
import path from "node:path";

import { type BrowserContext, chromium, expect, test } from "@playwright/test";

const EXT = path.resolve("out"); // playwright runs from the repo root

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  extensionId = new URL(worker.url()).host;
});

test.afterAll(() => context.close());

test("popup boots to the welcome screen", async () => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`chrome-extension://${extensionId}/index.html`);
  await expect(page.getByText("Aevra")).toBeVisible();
  expect(errors).toEqual([]);
});
