import { defineConfig } from "vite-plus";
import { gitTestTimeout } from "../../scripts/test-policy.ts";

export default defineConfig({
  test: {
    // A test builds temporary repositories and runs git.
    testTimeout: gitTestTimeout,
  },
});
