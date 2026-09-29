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
      /* Se registra ANTES de los middlewares internos de Vite, no
         después.

         Con `return () => {...}` esto corría al final, y Vite ya había
         atendido el pedido: a un GET de `/api/manifest` lo trataba como
         un módulo y devolvía el código fuente transformado en vez de
         ejecutarlo. No se notó antes porque todo lo de `api/` se probaba
         con POST, que Vite no toca.

         Es seguro correr primero: lo que no es de `api/`, o no existe
         como archivo, sale por `next()` sin tocarse. */
      {
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
            /* `send` no estaba y el ícono lo usa. Vercel lo provee, así
               que sin esto una función andaba publicada y fallaba en
               desarrollo, que es exactamente al revés de para qué existe
               este middleware. No pisa el content-type si ya lo pusieron:
               un SVG no es texto plano. */
            res.send = (cuerpo) => {
              if (!res.getHeader("content-type")) {
                res.setHeader("content-type",
                  typeof cuerpo === "string" ? "text/html; charset=utf-8" : "application/octet-stream");
              }
              res.end(cuerpo);
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
/* El número de versión de cada despliegue (src/ui/actualizacion.js). Va
   adentro del bundle y publicado aparte en /version.json: una página
   abierta compara el suyo con el de afuera y, si cambió, se actualiza
   sola cuando no está en medio de nada. En Vercel es el commit, más la
   hora del build por si se redespliega el mismo commit con otras
   variables; en local, la hora. */
function publicarVersion(version) {
  return {
    name: "genez-version",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version }) });
    },
  };
}

/* ============================================================
   La pantalla de pruebas: vite --mode pruebas
   ============================================================

   El sistema entero con una conexión a Supabase de mentira
   (src/pruebas/): sirve para ver las pantallas montadas sin una cuenta
   real y sin tocar la base. Una pantalla que se cae acá se caería en
   producción (así se escapó la pantalla en negro del 29/09: nadie la vio
   montada antes de publicar).

   Solo en ese modo: el build de producción no lo ve. Las funciones de
   api/ no se sirven, para que nada de lo que se haga acá llegue a
   Mercado Pago, ARCA o la base real. Y la página lo dice arriba, en
   grande, para que nadie la confunda con la de verdad.
   ============================================================ */
function conexionDePrueba() {
  const falso = resolve(process.cwd(), "src/pruebas/supabaseFalso.js");
  return {
    name: "genez-conexion-de-prueba",
    enforce: "pre",
    async resolveId(fuente, importador) {
      if (!importador || !/(^|\/)supabase\.js$/.test(fuente) || importador.replace(/\\/g, "/").includes("/src/pruebas/")) return null;
      const r = await this.resolve(fuente, importador, { skipSelf: true });
      return r && r.id.replace(/\\/g, "/").endsWith("/src/datos/supabase.js") ? falso : null;
    },
    transformIndexHtml(html) {
      /* Lo que sale mal queda anotado para leerlo desde la consola: los errores (window.__genezErrores) y los avisos rojos, que se van solos a los tres segundos (window.__genezAvisos). */
      html = html.replace("</head>", `<script>window.__genezErrores=[];window.__genezAvisos=[];addEventListener("error",e=>__genezErrores.push(String(e.message)));addEventListener("unhandledrejection",e=>__genezErrores.push(String(e.reason&&e.reason.message||e.reason)));const __ce=console.error;console.error=(...a)=>{__genezErrores.push(a.map(String).join(" ").slice(0,300));__ce(...a)};new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1&&n.dataset&&n.dataset.aviso==="mal")__genezAvisos.push(n.textContent)}))).observe(document.documentElement,{childList:true,subtree:true});</script></head>`);
      return html.replace("<body>", `<body><div style="position:fixed;z-index:99999;bottom:8px;left:50%;transform:translateX(-50%);background:#b45309;color:#fff;font:600 12px system-ui;padding:4px 10px;border-radius:6px;pointer-events:none">Pantalla de pruebas · datos de mentira · nada llega a la base</div>`);
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const pruebas = mode === "pruebas";
  const version = command === "build"
    ? `${(process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7)}-${Date.now().toString(36)}`
    : "dev";
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
    /* Sin esta, api/arca/facturar contestaba "falta el token" en local
       aunque estuviera en el .env: probar-arca.mjs lee el .env por su
       cuenta y no se enteró. */
    "AFIP_ACCESS_TOKEN",
    "ARCA_CLAVE_MAESTRA",
  ]) {
    if (env[clave] && !process.env[clave]) process.env[clave] = env[clave];
  }

  return {
    plugins: pruebas ? [react(), conexionDePrueba()] : [react(), servirApi(), publicarVersion(version)],
    define: { __GENEZ_VERSION__: JSON.stringify(version) },

    /* Dos entradas, dos bundles. La app del cliente no tiene por qué
       cargar el punto de venta, el salón, los reportes ni los gráficos:
       son 1,5 MB que viajarían al teléfono de alguien que quiere ver a
       qué hora tiene turno.

       Mismo repositorio igual, para que los colores, el cliente de
       Supabase y la sesión sean los mismos y no se desincronicen. */
    build: {
      rollupOptions: {
        input: {
          gestion: resolve(process.cwd(), "index.html"),
          cliente: resolve(process.cwd(), "cliente.html"),
          /* La landing pública: no carga nada del sistema ni de la app del
             cliente, solo las cards por rubro y, después, el alta guiada. */
          landing: resolve(process.cwd(), "landing.html"),
        },
      },
    },

    server: {
      port: pruebas ? 5191 : 5173,
      open: !pruebas,
    },
  };
});
