import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 43123,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.API_PROXY ?? "http://127.0.0.1:43124",
        changeOrigin: true,
      },
    },
  },
});
