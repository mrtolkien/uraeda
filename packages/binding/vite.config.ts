// A binding older than the Rust core is rebuilt before the tests load it.
import "../server/src/fresh-binding.ts";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // Git-heavy cases run several dozen processes: Vitest's 5 s default is a load bound, not a
  // hang detector, so a loaded machine failed them (as in the server project).
  test: { setupFiles: ["./test-setup.ts"], testTimeout: 20_000 },
});
