import { defineConfig } from "vite-plus";

/**
 * The `uraeda` command: the server's start bundled into one file with every dependency, but the
 * native binding's loader, which `scripts/build.ts` copies next to it as `dist/binding.js`.
 * `URAEDA_PACKAGE` makes `paths.ts` return the package's layout.
 */
export default defineConfig({
  pack: {
    banner: "#!/usr/bin/env node",
    define: { URAEDA_PACKAGE: "true" },
    // The loader is imported next to the bundle, never from the checkout.
    deps: { neverBundle: ["uraeda-binding"], onlyBundle: false },
    entry: { uraeda: "../server/src/main.ts" },
    outputOptions: { codeSplitting: false, paths: { "uraeda-binding": "./binding.js" } },
    platform: "node",
  },
});
