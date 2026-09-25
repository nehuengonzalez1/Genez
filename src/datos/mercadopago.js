/* ============================================================
   MERCADO PAGO · los cobros que entran
   ============================================================

   Le pregunta a `api/mp/pagos` con el token de la sesión, igual que
   `preguntarAlModelo` le pregunta al modelo. Antes el sondeo iba sin
   sesión y la función del servidor tampoco la pedía: cualquiera que
   supiera la URL veía los cobros. Ahora la función exige el token, así
   que el navegador tiene que mandarlo.

   Vive acá y no en la pantalla por la regla de siempre: `src/datos/` es
   lo único que conoce la sesión de Supabase.
   ============================================================ */

import { supabase } from "./supabase.js";

async function tokenDeSesion() {
  const { data } = await supabase.auth.getSession();
  const token = data && data.session ? data.session.access_token : null;
  if (!token) throw new Error("Se venció la sesión. Volvé a entrar.");
  return token;
}

/* Cada comercio pregunta con su propia cuenta (0091). `empresaId` solo
   importa para la plataforma, que no tiene comercio y nombra el que está
   mirando; para un usuario de comercio el servidor usa el suyo. */
export async function consultarCobros(desde, empresaId = null) {
  const token = await tokenDeSesion();
  const params = new URLSearchParams({ desde, t: String(Date.now()) });
  if (empresaId) params.set("empresa", empresaId);
  const r = await fetch(`/api/mp/pagos?${params}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return r.json();
}

/* La cuenta de Mercado Pago del comercio: `estado`, `guardar` ({ token })
   o `quitar`. El token viaja una vez, al guardarlo, y no vuelve nunca. */
export async function conexionMercadoPago(accion, datos = {}, empresaId = null) {
  const token = await tokenDeSesion();
  const r = await fetch("/api/mp/conexion", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ accion, empresaId, ...datos }),
  });
  const respuesta = await r.json().catch(() => null);
  if (!r.ok) throw new Error((respuesta && respuesta.error && respuesta.error.message) || "No se pudo hablar con el servidor.");
  return respuesta;
}
