import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ANVIL build config. Output goes to dist/ and is served as a static SPA.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
  },
});
