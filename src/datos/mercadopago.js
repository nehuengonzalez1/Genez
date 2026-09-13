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

export async function consultarCobros(desde) {
  const { data } = await supabase.auth.getSession();
  const token = data && data.session ? data.session.access_token : null;
  if (!token) throw new Error("Se venció la sesión. Volvé a entrar.");

  const params = new URLSearchParams({ desde, t: String(Date.now()) });
  const r = await fetch(`/api/mp/pagos?${params}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return r.json();
}
