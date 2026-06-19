import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies /api to the backend so there are no CORS issues locally.
// NOTE: target is 127.0.0.1 (NOT "localhost"). Under Node 18+ "localhost"
// resolves to IPv6 ::1 first, but Docker publishes the backend on IPv4
// 0.0.0.0:8000 — so "localhost" makes every /api call fail (ECONNREFUSED),
// especially on Windows. 127.0.0.1 forces IPv4 and fixes it.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
});
