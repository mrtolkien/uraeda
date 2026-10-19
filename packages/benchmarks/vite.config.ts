import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    // A test builds temporary repositories and runs git.
    testTimeout: 20_000,
  },
});
