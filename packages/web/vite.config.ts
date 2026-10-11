import react from "@vitejs/plugin-react";
import { fate } from "react-fate/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    react(),
    fate({
      module: "uraeda-server/fate",
      transport: "native",
    }),
  ],
  server: {
    proxy: {
      // changeOrigin sends the server's own Host, which its guard requires.
      "/fate": { target: "http://127.0.0.1:4310", changeOrigin: true },
    },
  },
  test: {
    environment: "happy-dom",
    environmentOptions: { happyDOM: { url: "http://127.0.0.1:4310/" } },
    // Each test builds a git repository and reads it through the binding.
    testTimeout: 20_000,
  },
});
