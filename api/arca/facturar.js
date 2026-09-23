/**
 * Factura una venta: le pide el CAE a ARCA y lo deja en `comprobantes`.
 *
 * Reemplaza a `api/arca/cae.js`, que recibía la letra, el punto de venta y
 * el total desde el navegador y facturaba siempre con el mismo CUIT, el de
 * una variable de Vercel. Ahora recibe el id de la venta y todo lo demás
 * sale de la base, del comercio de quien llama. La lógica está en
 * `_arca.js`, que es lo que corre también `scripts/probar-arca.mjs`.
 *
 * POR QUÉ AFIP SDK Y NO EL WEBSERVICE DIRECTO
 * --------------------------------------------
 * Facturar exige autenticarse contra WSAA (un token que vence cada 12 h,
 * firmado con un certificado) y después hablarle a WSFEv1 por SOAP. Afip
 * SDK resuelve las dos cosas. El precio: la autenticación pasa por sus
 * servidores, y en producción eso incluye el certificado y la clave
 * privada del comercio. Por ahora solo se usa en homologación, con el
 * CUIT de pruebas que no pide certificado.
 */

import { createClient } from "@supabase/supabase-js";
import { origenValido, quienLlama } from "../_comun.js";
import { facturarVenta, ErrorArca } from "./_arca.js";

const error = (res, estado, message) => res.status(estado).json({ error: { message } });

export default async function handler(req, res) {
  if (!origenValido(req)) return error(res, 403, "Origen no permitido.");
  if (req.method !== "POST") return error(res, 405, "Método no permitido.");

  const quien = await quienLlama(req);
  if (!quien) return error(res, 401, "Sesión inválida.");

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const maestra = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!maestra) return error(res, 503, "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");

  const cuerpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  /* El comercio sale de quién llama. Solo la plataforma —que entra "como"
     un comercio— lo puede nombrar: si viniera del cuerpo para cualquiera,
     un cajero facturaría ventas de otro negocio. */
  const empresaId = quien.es_plataforma ? cuerpo.empresaId : quien.empresa_id;

  /* La service_role porque `comprobantes` no se deja escribir por nadie
     más (ver 0082). Todo lo que lee va filtrado por `empresaId`. */
  const admin = createClient(url, maestra, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const c = await facturarVenta({ admin, empresaId, operacionId: cuerpo.operacionId, usuarioId: quien.id });
    return res.status(200).json({
      id: c.id,
      letra: c.letra,
      puntoVenta: c.punto_venta,
      numero: c.numero,
      cae: c.cae,
      vencimiento: c.cae_vto,
      cuit: c.cuit,
      homologacion: c.modo === "homologacion",
    });
  } catch (e) {
    if (e instanceof ErrorArca) return error(res, e.estado, e.message);
    return error(res, 502, e.message || "ARCA no pudo procesar el comprobante.");
  }
}
