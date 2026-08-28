/* ============================================================
   EL SERVICE WORKER DE LA APP DEL CLIENTE
   ============================================================

   Lo que hace que la app abra sin conexión y que instalada se sienta una
   aplicación y no una pestaña.

   LO QUE NO CACHEA, Y ES LO MÁS IMPORTANTE
   ----------------------------------------
   Nada que venga de Supabase ni de `/api`. Dos razones, y las dos pesan:

   Los datos tienen que estar frescos. Mostrar un turno que se cancetó
   hace una hora, o un abono con las clases de ayer, es peor que no
   mostrar nada: la persona toma una decisión con un número viejo.

   Y son datos de una persona. Guardarlos en un caché del navegador es
   dejarlos escritos en un lugar que sobrevive al cierre de sesión.

   O sea: el caché es para el envase —el HTML, el JavaScript, los
   estilos— y nunca para el contenido.

   LO QUE SÍ, Y CÓMO
   -----------------
   Los archivos del build llevan el hash en el nombre, así que una vez
   descargados no cambian nunca: cachear primero y no volver a preguntar
   es correcto y hace que la app abra instantánea.

   El HTML no lleva hash, así que va al revés: se pide a la red y se usa
   el caché solo si no hay conexión. Si fuera al revés, alguien se
   quedaría con una versión vieja de la app hasta que limpie el
   navegador.

   NO PROMETE LO QUE NO HIZO
   -------------------------
   Sin conexión, una reserva no se guarda para "mandarla después". El
   sistema de gestión tiene una cola para las ventas —ahí tiene sentido,
   porque el cobro ya ocurrió— pero un turno no: el lugar puede no estar
   cuando vuelva la señal, y decirle a alguien que tiene turno para
   después avisarle que no, es peor que decirle que no ahora.
   ============================================================ */

const VERSION = "genez-cliente-v1";
const CASCARA = `${VERSION}-cascara`;

/* Lo mínimo para que abra sin conexión. El resto entra solo a medida que
   se usa: precargar el bundle entero le cuesta datos a alguien que capaz
   nunca abre la pantalla de reservar. */
const BASE = ["/cliente.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CASCARA)
      .then((c) => c.addAll(BASE))
      /* Si alguno falla no se aborta la instalación: es preferible una
         app instalada con menos caché que una que no se instala. */
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(
        claves.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /* Los datos, siempre de la red. Que no haya un `catch` es a propósito:
     si no hay conexión, la app tiene que enterarse y decirlo, no recibir
     algo viejo que parece actual. */
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  /* Navegación: red primero, caché si no hay. */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone();
          caches.open(CASCARA).then((c) => c.put("/cliente.html", copia));
          return r;
        })
        .catch(() => caches.match("/cliente.html"))
    );
    return;
  }

  /* Los archivos con hash: caché primero, y se guarda lo que llegue. */
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((r) => {
          const copia = r.clone();
          caches.open(CASCARA).then((c) => c.put(req, copia));
          return r;
        })
      )
    );
  }
});
