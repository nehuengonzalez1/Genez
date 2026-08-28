/* ============================================================
   PRUEBA · qué app sirve cada host
   ============================================================

   `almha.genez.com.ar/` es la app del cliente y `genez.com.ar/` el
   sistema de gestión. Eso lo decide `middleware.js`, y es la única regla
   del proyecto que no se puede probar mirando la pantalla: se equivoca en
   producción, contra un host que en desarrollo no existe.

   Las dos formas de equivocarse son distintas y las dos importan:

   - De menos: el subdominio de un comercio sirve la gestión, que es el
     bug que esto vino a cerrar.
   - **De más**: un host que no es de ningún comercio —el dominio pelado,
     `www`, y sobre todo los `*.vercel.app` de cada vista previa— sirve la
     app del cliente, y entonces no queda dónde probar la gestión.

   No hay base ni red: la función es pura y se la llama y listo.

     node scripts/probar-dominio.mjs
   ============================================================ */

import middleware from "../middleware.js";

let fallas = 0;
let total = 0;
const decir = (ok, texto) => { total++; if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };

/* El middleware contesta con una respuesta vacía y la decisión en un
   encabezado: `x-middleware-rewrite` si desvía, `x-middleware-next` si
   deja pasar. Es el contrato de `@vercel/functions`, no una invención de
   acá. */
function destino(host) {
  /* La URL del pedido y el encabezado van por separado a propósito: hay
     hosts que hay que poder probar y no arman una URL válida —el vacío—,
     y el middleware los tiene que contestar igual. Lo único que mira de
     la URL es la base para armar el desvío. */
  const r = middleware(new Request("https://x/", { headers: host ? { host } : {} }));
  const desvio = r.headers.get("x-middleware-rewrite");
  return desvio ? new URL(desvio).pathname : null;
}

const CLIENTE = "/cliente.html";

console.log("\nLos que son de un comercio\n");

for (const host of ["almha.genez.com.ar", "rivadavia.genez.com.ar", "super25.genez.com.ar"]) {
  decir(destino(host) === CLIENTE, `${host} sirve la app del cliente`);
}

/* Con el puerto pegado, que es como llega el host de un pedido que no
   entró por el 443. */
decir(destino("almha.genez.com.ar:8443") === CLIENTE, "el puerto en el host no confunde");
decir(destino("ALMHA.Genez.Com.Ar") === CLIENTE, "las mayúsculas tampoco");

console.log("\nLos que son de la plataforma\n");

for (const host of ["genez.com.ar", "www.genez.com.ar", "app.genez.com.ar", "api.genez.com.ar", "admin.genez.com.ar"]) {
  decir(destino(host) === null, `${host} sigue siendo la gestión`);
}

console.log("\nLos que no son de este dominio\n");

/* Este es el que más caro sale: cada rama abierta tiene su despliegue en
   `*.vercel.app` y ahí se prueba la gestión antes de publicar. Si el
   middleware los tomara por comercios, la vista previa mostraría la app
   del cliente y nadie entendería por qué. */
for (const host of [
  "genez.vercel.app",
  "genez-git-backend-supabase-nehuen.vercel.app",
  "localhost",
  "localhost:5173",
  "otrodominio.com",
  "genez.com.ar.otrodominio.com",
]) {
  decir(destino(host) === null, `${host} no toca`);
}

/* Un subdominio de un subdominio no es de nadie: `marca_de` no lo va a
   encontrar y la app quedaría sin marca. Mejor la gestión, que al menos
   es una pantalla que existe. */
decir(destino("uno.dos.genez.com.ar") === null, "uno.dos.genez.com.ar no es un comercio");

/* Sin host —un pedido malformado— no se adivina nada. */
decir(destino("") === null, "sin host, no se desvía");

console.log(`\n${total} verificaciones · ${fallas ? `${fallas} MAL` : "todo en verde"}\n`);
process.exit(fallas ? 1 : 0);
