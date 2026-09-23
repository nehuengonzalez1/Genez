/* ============================================================
   ARCA · la factura electrónica de una venta
   ============================================================

   Le pide a `api/arca/facturar` que facture una venta que ya está en la
   base, con el token de la sesión, mismo patrón que `mercadopago.js`. No
   manda importes ni letra: el servidor los saca de la venta y del
   comercio, para que nadie pueda pedir un CAE por lo que se le ocurra.

   Todavía no la llama el cobro. Falta resolver qué se imprime cuando la
   venta se hizo sin internet y el CAE llega después.
   ============================================================ */

import { supabase } from "./supabase.js";

export async function facturarVenta(operacionId, empresaId = null) {
  const { data } = await supabase.auth.getSession();
  const token = data && data.session ? data.session.access_token : null;
  if (!token) throw new Error("Se venció la sesión. Volvé a entrar.");

  const r = await fetch("/api/arca/facturar", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ operacionId, empresaId }),
  });

  const cuerpo = await r.json().catch(() => null);
  if (!r.ok) throw new Error((cuerpo && cuerpo.error && cuerpo.error.message) || "ARCA no contestó.");
  return cuerpo;
}
