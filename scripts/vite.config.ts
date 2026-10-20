import { defineConfig } from "vite-plus";
export default defineConfig({
  root: import.meta.dirname,
  test: { include: ["__tests__/**/*.test.ts"], name: "scripts" },
});
