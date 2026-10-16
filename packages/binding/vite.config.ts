// A binding older than the Rust core is rebuilt before the tests load it.
import "../server/src/fresh-binding.ts";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: { setupFiles: ["./test-setup.ts"] },
});
