import { defineConfig } from "vite-plus";

export default defineConfig({
  test: { setupFiles: ["../binding/test-setup.ts"] },
});
