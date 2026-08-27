import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/* ============================================================
   Servir api/ en desarrollo
   ============================================================

   En producción Vercel toma cada archivo de `api/` y lo publica solo. En
   desarrollo no lo tomaba nadie: `/api/mp/pagos` daba 404 y por eso
   Ajustes tiene un botón para simular un cobro.

   Para el asistente eso alcanzaba —se puede trabajar sin él— pero para
   dar de alta un usuario no: es la funcionalidad, no un extra. Sin esto
   habría que publicar en Vercel para probar cada cambio.

   El shim es chico a propósito: `req.body` ya parseado y `res.status().json()`,
   que es lo único que usan las funciones de este repo. No pretende ser
   Vercel, pretende que el mismo archivo corra en los dos lados.
   ============================================================ */
function servirApi() {
  return {
    name: "genez-servir-api",
    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          const ruta = (req.url || "").split("?")[0];
          if (!ruta.startsWith("/api/")) return next();

          /* El asistente lo atiende el proxy de abajo, que además le
             agrega la credencial. */
          if (ruta.startsWith("/api/anthropic")) return next();

          const archivo = resolve(process.cwd(), "." + ruta + ".js");
          if (!existsSync(archivo)) return next();

          try {
            const crudo = await new Promise((ok, mal) => {
              const partes = [];
              req.on("data", (p) => partes.push(p));
              req.on("end", () => ok(Buffer.concat(partes).toString("utf8")));
              req.on("error", mal);
            });

            req.body = crudo && (req.headers["content-type"] || "").includes("json")
              ? JSON.parse(crudo)
              : crudo;

            res.status = (n) => { res.statusCode = n; return res; };
            res.json = (o) => {
              res.setHeader("content-type", "application/json; charset=utf-8");
              res.end(JSON.stringify(o));
              return res;
            };

            const modulo = await server.ssrLoadModule("." + ruta + ".js");
            await modulo.default(req, res);
          } catch (e) {
            server.config.logger.error(`api${ruta}: ${e.message}`);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader("content-type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ error: { message: e.message } }));
            }
          }
        });
      };
    },
  };
}

// El navegador no puede llamar a la API de Anthropic directamente (CORS y,
// sobre todo, porque la API key no debe viajar al front). El servidor de
// desarrollo hace de intermediario y agrega la credencial del lado del server.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  /* Las funciones de api/ leen process.env, igual que en Vercel. En
     desarrollo eso lo llena el .env a través de loadEnv: sin esto la
     función de accesos no encuentra la service_role y contesta 503. */
  for (const clave of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "MP_ACCESS_TOKEN",
  ]) {
    if (env[clave] && !process.env[clave]) process.env[clave] = env[clave];
  }

  return {
    plugins: [react(), servirApi()],
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
