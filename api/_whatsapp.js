/**
 * Lo que `api/founder.js` necesita para hablar con WhatsApp, sin red ni
 * base: se prueba con `node scripts/probar-whatsapp.mjs`.
 *
 * El guión bajo del nombre hace que Vercel no lo publique como ruta (ver
 * `_comun.js`). Importa: el plan Hobby deja 12 funciones y ya van 12.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/* La versión de la Graph API que mostraba el panel de Meta el 30/09/2026.
   Meta mantiene cada versión unos dos años; subirla es cambiar esto y
   probar. */
export const GRAPH = "https://graph.facebook.com/v25.0";

/**
 * La firma de Meta: "sha256=" + HMAC-SHA256 del cuerpo, con el app secret.
 *
 * Se calcula sobre los bytes tal como llegaron. Sobre el JSON parseado y
 * vuelto a armar no coincide nunca: basta un espacio o un acento escapado
 * distinto (Meta manda "á" donde JSON.stringify pone "á").
 *
 * La comparación es de tiempo constante: con un === que corta en el primer
 * byte distinto, medir cuánto tarda la respuesta va revelando la firma.
 */
export function firmaValida(crudo, encabezado, secreto) {
  if (!secreto || typeof encabezado !== "string" || !encabezado.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", secreto).update(crudo).digest("hex");
  const recibida = encabezado.slice(7);
  if (recibida.length !== esperada.length || !/^[0-9a-f]+$/i.test(recibida)) return false;
  return timingSafeEqual(Buffer.from(esperada, "hex"), Buffer.from(recibida, "hex"));
}

/**
 * El cuerpo como llegó, en bytes.
 *
 * En Vercel, `req.body` se arma recién cuando alguien lo lee: si no se lo
 * toca, el stream sigue ahí. En desarrollo el middleware de vite.config.js
 * ya lo consumió, y lo deja en `req.cuerpoCrudo`.
 */
export async function leerCrudo(req, maximo = 1024 * 1024) {
  if (typeof req.cuerpoCrudo === "string") return Buffer.from(req.cuerpoCrudo, "utf8");
  const partes = [];
  let total = 0;
  for await (const parte of req) {
    total += parte.length;
    /* Un webhook de Meta pesa unos pocos KB. Uno de un mega no es de Meta,
       y leerlo entero antes de mirar la firma sería regalar memoria. */
    if (total > maximo) throw Object.assign(new Error("Cuerpo demasiado grande."), { codigo: 413 });
    partes.push(parte);
  }
  return Buffer.concat(partes);
}

/**
 * La verificación del webhook: Meta hace un GET con hub.mode=subscribe,
 * hub.verify_token (el que se cargó en su panel) y hub.challenge, y espera
 * el challenge de vuelta, tal cual, como texto.
 */
export function verificarSuscripcion(query, tokenEsperado) {
  if (!tokenEsperado) return { ok: false, codigo: 503, motivo: "Falta WHATSAPP_VERIFY_TOKEN en el servidor." };
  const modo = query["hub.mode"];
  const token = query["hub.verify_token"];
  const desafio = query["hub.challenge"];
  if (modo !== "subscribe" || typeof token !== "string" || typeof desafio !== "string") {
    return { ok: false, codigo: 400, motivo: "No es una verificación de Meta." };
  }
  const a = Buffer.from(token);
  const b = Buffer.from(tokenEsperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, codigo: 403, motivo: "El verify token no coincide." };
  return { ok: true, desafio };
}

/** El cuerpo de un mensaje de texto para /{phone_number_id}/messages. */
export function mensajeDeTexto(waId, texto) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: waId,
    type: "text",
    /* Sin vista previa: un link en la primera respuesta a un comercio no
       tiene por qué desplegar una tarjeta. */
    text: { preview_url: false, body: texto },
  };
}

/**
 * Un error de la Graph API, en algo que se pueda mostrar. Meta contesta
 * { error: { message, code, error_subcode, error_data: { details } } }.
 */
export function errorDeMeta(respuesta, estadoHttp) {
  const e = (respuesta && respuesta.error) || {};
  const detalle = e.error_data && e.error_data.details;
  return {
    code: e.code ?? null,
    subcode: e.error_subcode ?? null,
    message: detalle || e.message || `Meta contestó ${estadoHttp}.`,
    http: estadoHttp,
  };
}

