/* ============================================================
   EL SERVICE WORKER DEL SISTEMA DE GESTIÓN
   ============================================================

   Lo que hace que el sistema se pueda instalar en la computadora (08/10,
   como Vendi y Ventario) y que una caja que se quedó sin internet pueda
   volver a abrirlo: la cola de ventas (`src/datos/cola.js`) ya guarda
   lo cobrado sin conexión, pero sin esto un refresco en ese momento
   dejaba la pantalla en "no se puede acceder al sitio".

   Es el mismo criterio que `sw.js`, el de la app del cliente, y por las
   mismas razones:

   - Nada de Supabase ni de `/api`: los datos siempre de la red. Un stock
     o una caja de hace una hora mostrados como actuales son peores que
     un error, y son datos del comercio que no tienen que quedar escritos
     en un caché que sobrevive al cierre de sesión.
   - La página (sin hash) va a la red primero y usa lo guardado solo sin
     conexión. Al revés, una caja se quedaría con una versión vieja del
     sistema hasta que alguien limpie el navegador.
   - Los archivos del build (con hash) no cambian nunca: se guardan y no
     se vuelve a preguntar.

   Archivo propio y no `sw.js`: aquel guarda `cliente.html`, y los dos
   viven en orígenes distintos (genez.com.ar y cada subdominio).
   ============================================================ */

const VERSION = "genez-gestion-v1";
const CASCARA = `${VERSION}-cascara`;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CASCARA)
      .then((c) => c.add("/index.html"))
      /* Si falla no se aborta: mejor instalado con menos caché que no instalado. */
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  /* Las páginas del sistema son todas la misma (es una sola aplicación):
     red primero, y sin conexión la última que se guardó. La landing no:
     es otra cosa y no tiene por qué quedar guardada. */
  if (req.mode === "navigate") {
    if (url.pathname.startsWith("/landing")) return;
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) { const copia = r.clone(); caches.open(CASCARA).then((c) => c.put("/index.html", copia)); }
          return r;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/iconos/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(CASCARA).then((c) => c.put(req, copia)); }
        return r;
      }))
    );
  }
});
