/* ============================================================
   ARCA · pedir el CAE de un comprobante
   ============================================================

   Le pregunta a `api/arca/cae` con el token de la sesión, mismo patrón
   que `mercadopago.js`. Todavía no la llama ningún cobro real: hoy sirve
   para probar la integración contra el sandbox de Afip SDK, antes de
   que exista un comercio con certificado propio para facturar de verdad.
   ============================================================ */

import { supabase } from "./supabase.js";

export async function pedirCAE(datos) {
  const { data } = await supabase.auth.getSession();
  const token = data && data.session ? data.session.access_token : null;
  if (!token) throw new Error("Se venció la sesión. Volvé a entrar.");

  const r = await fetch("/api/arca/cae", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });

  const cuerpo = await r.json().catch(() => null);
  if (!r.ok) throw new Error((cuerpo && cuerpo.error && cuerpo.error.message) || "ARCA no contestó.");
  return cuerpo;
}
