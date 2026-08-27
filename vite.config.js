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

          /* Los que empiezan con guión bajo son módulos, no endpoints. Es la
             misma regla que aplica Vercel. */
          if (ruta.split("/").pop().startsWith("_")) return next();

          /* Vercel resuelve /api/anthropic/v1/messages con el rewrite de
             vercel.json. Acá se hace lo mismo a mano: si la ruta exacta no
             existe, se va acortando hasta encontrar el archivo que la
             atiende. Sin esto, el asistente andaría distinto en desarrollo
             que en produccion, que es justo lo que este middleware vino a
             terminar. */
          let base = ruta;
          while (base.length > 5 && !existsSync(resolve(process.cwd(), "." + base + ".js"))) {
            base = base.slice(0, base.lastIndexOf("/"));
          }

          const archivo = resolve(process.cwd(), "." + base + ".js");
          if (base.length <= 5 || !existsSync(archivo)) return next();

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

            const modulo = await server.ssrLoadModule("." + base + ".js");
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

/* Acá había un proxy que mandaba /api/anthropic derecho a api.anthropic.com
   agregándole la credencial. Existía porque en desarrollo no había forma de
   correr las funciones de api/, y se lo llevó puesto el middleware de arriba,
   que sí las corre.

   No es solo simplificar. Ese proxy se salteaba api/anthropic.js entero, o
   sea que la validación de sesión que la función hace existía únicamente en
   producción: se probaba desplegando. Ahora los dos entornos entran por el
   mismo archivo y lo que se prueba local es lo que va a correr publicado. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  /* Las funciones de api/ leen process.env, igual que en Vercel. En
     desarrollo eso lo llena el .env a través de loadEnv: sin esto la
     función de accesos no encuentra la service_role y contesta 503. */
  for (const clave of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "ANTHROPIC_API_KEY",
    "MP_ACCESS_TOKEN",
  ]) {
    if (env[clave] && !process.env[clave]) process.env[clave] = env[clave];
  }

  return {
    plugins: [react(), servirApi()],
    server: {
      port: 5173,
      open: true,
    },
  };
});
