// The layout's checks, in WebKit at an iPhone 17's size, against the server mounted in the test
// server (see `vite.config.ts`). The root's config lists this project next to the others.
import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig } from "vite-plus";
import base from "./vite.config.ts";

export default defineConfig({
  ...base,
  test: {
    name: "uraeda-web-browser",
    include: ["src/__browser__/**/*.test.tsx"],
    globalSetup: ["src/__browser__/setup.ts"],
    testTimeout: 30_000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "webkit" }],
      viewport: { width: 402, height: 874 },
    },
  },
});
