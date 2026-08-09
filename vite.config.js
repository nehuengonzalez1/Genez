import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// El navegador no puede llamar a la API de Anthropic directamente (CORS y,
// sobre todo, porque la API key no debe viajar al front). El servidor de
// desarrollo hace de intermediario y agrega la credencial del lado del server.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      open: true,
      proxy: {
        "/api/anthropic": {
          target: "https://api.anthropic.com",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/anthropic/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (env.ANTHROPIC_API_KEY) {
                proxyReq.setHeader("x-api-key", env.ANTHROPIC_API_KEY);
                proxyReq.setHeader("anthropic-version", "2023-06-01");
              }
            });
          },
        },
      },
    },
  };
});
