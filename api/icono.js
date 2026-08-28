/**
 * El ícono de la app cuando el comercio todavía no subió el suyo.
 *
 * La inicial sobre el naranja de Genez. No es un logo: es un lugar
 * ocupado hasta que haya uno, y se nota que lo es.
 *
 * POR QUÉ NO SE INVENTA UN LOGO
 * -----------------------------
 * Dibujar algo que parezca la marca de Almha sería peor que una letra:
 * quedaría en la pantalla de inicio de sus clientas como si fuera el logo
 * del local. Una inicial se lee como lo que es —todavía no cargaron el
 * ícono— y no compite con la identidad del comercio.
 *
 * ES UN SVG Y ESO TIENE UNA LIMITACIÓN
 * ------------------------------------
 * Android lo toma bien. iOS prefiere PNG para el ícono de la pantalla de
 * inicio y con un SVG puede caer en una captura de la página. Es
 * aceptable para un respaldo, y la solución de verdad es que el comercio
 * suba su ícono cuadrado: ahí `marca.logo` reemplaza esto y el problema
 * desaparece para todos.
 */

import { createClient } from "@supabase/supabase-js";

const COLOR = "#ea580c";
const FONDO = "#fff7ed";

export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  const u = new URL(req.url || "/", `https://${req.headers.host || "x"}`);
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").split(":")[0];
  const partes = host.split(".");
  const slug = u.searchParams.get("c")
    || (partes.length >= 3 && partes[0] !== "www" ? partes[0] : null);

  let letra = "G";
  if (slug && url && anon) {
    try {
      const supa = createClient(url, anon, { auth: { persistSession: false } });
      const { data } = await supa.rpc("marca_de", { p_slug: slug });
      if (data && data.length && data[0].nombre) {
        letra = data[0].nombre.trim().charAt(0).toUpperCase();
      }
    } catch { /* la G alcanza */ }
  }

  /* `viewBox` de 512 y nada de tamaño fijo: el mismo archivo sirve para
     todas las medidas que pida el manifest. */
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="${FONDO}"/>
  <rect x="24" y="24" width="464" height="464" rx="96" fill="${COLOR}"/>
  <text x="256" y="256" fill="#ffffff"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="260" font-weight="700"
        text-anchor="middle" dominant-baseline="central">${letra}</text>
</svg>`;

  res.setHeader("content-type", "image/svg+xml; charset=utf-8");
  res.setHeader("cache-control", "public, max-age=86400");
  return res.status(200).send(svg);
}
