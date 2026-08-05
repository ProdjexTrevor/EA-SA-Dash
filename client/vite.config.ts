import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = env.VITE_API_PORT || "3010";
  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_CLIENT_PORT || 5174),
      strictPort: true,
      proxy: {
        "/api": { target: `http://localhost:${apiPort}`, changeOrigin: true },
      },
    },
  };
});
