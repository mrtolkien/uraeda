// A binding older than the Rust core is rebuilt before the tests load it.
import "./src/fresh-binding.ts";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    setupFiles: ["../binding/test-setup.ts"],
    // Many tests build a git repository and read it through the binding, as the web tests do.
    testTimeout: 20_000,
  },
});
