import { defineConfig } from "vite-plus";
export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ["__tests__/**/*.test.ts"],
    name: "scripts",
    // The discovery and runner cases start a nested Vitest or fast-check, bounded at 120 seconds
    // themselves: under ready's load one took 7.9 seconds, past Vitest's default of 5.
    testTimeout: 130_000,
  },
});
