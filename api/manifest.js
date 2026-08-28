/**
 * El manifest de la app, distinto para cada comercio.
 *
 * Es lo que decide qué dice el ícono en la pantalla de inicio del teléfono.
 * Con un manifest estático diría "Genez" para todos, que es exactamente lo
 * que esta app no puede ser: la persona instala Almha, no instala Genez.
 *
 * DE DÓNDE SALE EL COMERCIO
 * -------------------------
 * Del dominio, igual que en el front: `almha.genez.com.ar`. El navegador
 * pide el manifest antes de que corra una línea de JavaScript, así que no
 * hay otra forma de saber de quién es la app en ese momento.
 *
 * En desarrollo no hay subdominio y se acepta `?c=almha`, lo mismo que
 * hace `slugDelDominio`.
 *
 * NO PIDE SESIÓN, Y ESTÁ BIEN
 * ---------------------------
 * Todo lo que devuelve sale de `marca_de`, que es pública por diseño: el
 * nombre del comercio y sus colores. Un manifest, por definición, lo lee
 * el navegador antes de que nadie inicie sesión.
 */

import { createClient } from "@supabase/supabase-js";

function slugDe(req) {
  const url = new URL(req.url || "/", `https://${req.headers.host || "x"}`);
  const forzado = url.searchParams.get("c");
  if (forzado) return forzado.trim().toLowerCase();

  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").split(":")[0];
  const partes = host.split(".");
  if (partes.length >= 3 && partes[0] !== "www") return partes[0];
  return null;
}

export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  const slug = slugDe(req);
  let marca = null;

  if (slug && url && anon) {
    try {
      const supa = createClient(url, anon, { auth: { persistSession: false } });
      const { data } = await supa.rpc("marca_de", { p_slug: slug });
      if (data && data.length) marca = data[0];
    } catch {
      /* Sin marca se sirve el manifest genérico: una app instalable con
         nombre feo es mejor que una que no se puede instalar. */
    }
  }

  const nombre = marca ? marca.nombre : "Genez";
  const icono = (marca && marca.logo) || `/api/icono${slug ? `?c=${slug}` : ""}`;

  res.setHeader("content-type", "application/manifest+json; charset=utf-8");
  /* Corto: si el comercio cambia su nombre o su color, no queremos que el
     teléfono siga mostrando el anterior por una semana. */
  res.setHeader("cache-control", "public, max-age=3600");

  return res.status(200).json({
    name: nombre,
    short_name: nombre,
    description: (marca && marca.bajada) || "Turnos y planes",
    /* El subdominio es la app entera, así que arranca en la raíz. En
       desarrollo, donde conviven las dos, hace falta la ruta. */
    start_url: slug ? "/" : "/cliente.html",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf7f2",
    theme_color: "#faf7f2",
    lang: "es-AR",
    icons: [
      { src: icono, sizes: "192x192", type: icono.endsWith(".svg") || icono.startsWith("/api/") ? "image/svg+xml" : "image/png", purpose: "any" },
      { src: icono, sizes: "512x512", type: icono.endsWith(".svg") || icono.startsWith("/api/") ? "image/svg+xml" : "image/png", purpose: "any" },
    ],
  });
}
