/**
 * Pide el CAE de las ventas cobradas como factura que todavía no lo
 * tienen, en orden. Lo llama el cobro después de cada factura, la cola
 * cuando vuelve internet, y el botón de Caja → Facturas.
 *
 * No recibe qué facturar: factura todo lo que espera, de lo más viejo a lo
 * más nuevo, para que la numeración siga el orden de las ventas (ver
 * `facturarPendientes` en `_arca.js`). Tampoco recibe importes, letra ni
 * punto de venta: todo sale de la base, del comercio de quien llama.
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
import { facturarPendientes, ErrorArca } from "./_arca.js";

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
    return res.status(200).json(await facturarPendientes({ admin, empresaId, usuarioId: quien.id }));
  } catch (e) {
    if (e instanceof ErrorArca) return error(res, e.estado, e.message);
    return error(res, 502, e.message || "ARCA no pudo procesar el comprobante.");
  }
}
