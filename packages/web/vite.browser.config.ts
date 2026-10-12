// The layout's checks, in WebKit at an iPhone 17's size, against the server mounted in the test
// server (see `vite.config.ts`), on the fake agent: the tests `vp run ready` runs never start Claude
// Code. The root's config lists this project next to the others.
import { FakeAdapter } from "uraeda-server/testing";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig, type PluginOption } from "vite-plus";
import base, { uraedaServer } from "./vite.config.ts";

const plugins = (base.plugins ?? []).filter(
  (plugin: PluginOption) => !(plugin && "name" in plugin && plugin.name === "uraeda-server"),
);

export default defineConfig({
  ...base,
  plugins: [...plugins, uraedaServer({ adapter: new FakeAdapter() })],
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
