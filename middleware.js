/**
 * LA RAÍZ DE UN SUBDOMINIO ES LA APP DEL CLIENTE
 *
 * `almha.genez.com.ar/` tiene que servir la app del cliente y
 * `genez.com.ar/` el sistema de gestión. Son dos HTML distintos en el
 * mismo despliegue —`cliente.html` e `index.html`— y lo único que los
 * separa es el host.
 *
 * POR QUÉ NO ALCANZA UN REWRITE DE vercel.json
 * --------------------------------------------
 * Ahí estuvo el rato perdido. Había un rewrite con la condición de host
 * y no tomaba nunca, ni con lookahead ni con el nombre exacto: el
 * problema no era la condición.
 *
 * **Los rewrites de `vercel.json` se evalúan DESPUÉS del sistema de
 * archivos.** `/` encuentra `index.html` publicado y ahí termina el
 * pedido; la regla ni se mira. La prueba está en el mismo despliegue:
 * el rewrite de `/cliente` sí funciona, y la única diferencia es que
 * `/cliente` no existe como archivo.
 *
 * O sea que ninguna regla declarativa podía ganar. Lo único que corre
 * antes del sistema de archivos es esto, que es además lo que Vercel
 * documenta para el caso —subdominio de un inquilino a una ruta interna—.
 *
 * POR QUÉ NO DICE "ALMHA"
 * -----------------------
 * Porque entonces cada comercio nuevo sería un despliegue. La app es un
 * motor: el comercio sale del dominio, igual que en `slugDelDominio` y en
 * `api/manifest.js`. Acá ni siquiera hace falta saber cuál es —eso lo
 * resuelve `marca_de` cuando la página ya cargó—: alcanza con saber que
 * hay uno.
 *
 * Tampoco se consulta la base para ver si el comercio existe. Sería una
 * ida a Supabase delante de cada visita a la raíz para contestar algo que
 * la app contesta sola dos décimas después, y con la marca puesta.
 *
 * `matcher` es solo `/`: los assets, `/api/*`, el service worker y
 * `/cliente` salen por donde salían. Un subdominio que pida una ruta que
 * no existe sigue dando 404, como antes.
 */

import { rewrite, next } from "@vercel/functions/middleware";

export const config = { matcher: "/" };

/* El dominio de la plataforma, y no un comodín. Sin esto, los dominios de
   Vercel —`genez-algo.vercel.app`, y cada despliegue de vista previa—
   también parecen "un subdominio" y servirían la app del cliente en la
   raíz, que es justo donde se prueba el sistema de gestión. */
const RAIZ = "genez.com.ar";

/* Lo que es de la plataforma y nunca va a ser un comercio. `www` y el
   dominio pelado son la gestión; los otros tres se reservan antes de que
   alguien pida ese nombre y quede el lío. */
const RESERVADOS = new Set(["www", "app", "api", "admin"]);

export default function middleware(pedido) {
  const host = (pedido.headers.get("host") || "").split(":")[0].toLowerCase();
  if (!host.endsWith(`.${RAIZ}`)) return next();

  const slug = host.slice(0, -(RAIZ.length + 1));
  /* Con punto adentro es `algo.otro.genez.com.ar`, que no es de nadie. */
  if (!slug || slug.includes(".") || RESERVADOS.has(slug)) return next();

  return rewrite(new URL("/cliente.html", pedido.url));
}
