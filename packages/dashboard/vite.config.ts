import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@collabcode/shared": resolve(__dirname, "../shared/src/index.ts")
    }
  },
  server: { port: 5173 },
  preview: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "data-vendor": ["@supabase/supabase-js", "socket.io-client"],
          "motion-vendor": ["framer-motion"],
          "chart-vendor": ["recharts"],
          "icon-vendor": ["lucide-react"]
        }
      }
    }
  }
});
