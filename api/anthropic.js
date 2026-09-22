/**
 * Proxy hacia la API de Anthropic para el chat del Asistente y la lectura de
 * remitos por foto.
 *
 * Existe por una sola razón: la API key no puede viajar al navegador. Si la
 * pusiéramos en el front, cualquiera que abra el inspector se la lleva. Acá
 * queda del lado del servidor, en las variables de entorno de Vercel.
 *
 * El cliente llama a /api/anthropic/v1/messages en los dos entornos, y en los
 * dos lo atiende ESTE archivo: en producción por el rewrite de vercel.json, en
 * desarrollo por el middleware de vite.config.js. Antes en desarrollo lo
 * atendía un proxy que hablaba derecho con Anthropic y se saltaba todo lo de
 * abajo, así que la validación existía solo en producción y no se probaba
 * nunca. Un camino, no dos.
 *
 * La función siempre habla con un único endpoint de Anthropic, así que no
 * necesita interpretar la ruta pedida: eso la vuelve más simple y evita que
 * se la pueda usar para llegar a otro lado.
 *
 * POR QUÉ PIDE SESIÓN
 * -------------------
 * Hasta acá lo único que la cuidaba era el origen, y eso no cuida nada: el
 * header `Origin` lo pone el navegador, así que un script que no lo manda se
 * saltaba el chequeo entero. Publicada en un dominio, esta función era un
 * proxy abierto a la cuenta de Anthropic: cualquiera que descubriera la URL
 * podía gastar los créditos.
 *
 * Ahora pide el token de Supabase. El Asistente y CargarCompra se usan
 * adentro del sistema, donde siempre hay sesión, así que no cambia nada para
 * quien lo usa.
 */

import { origenValido, quienLlama } from "./_comun.js";

/* EL TECHO DE LA RESPUESTA

   Es un freno de gasto: la clave es de la plataforma, así que cada llamada
   la paga Genez y no el comercio. Acota lo que puede costar una sola
   petición, no lo que puede costar el mes.

   Estaba en 2000 y quedó corto por un caso concreto: `CargarCompra` pedía
   exactamente 2000 —o sea, el techo— y una factura de proveedor de más de
   veinticinco renglones no entra en eso. El JSON salía cortado a la mitad,
   `JSON.parse` fallaba, y el usuario veía "No pude leer el remito" sin
   ninguna pista de que el problema era el largo.

   8000 cubre unos ciento cincuenta renglones. A los precios de Sonnet 5
   —10 dólares el millón de tokens de salida— el peor caso de una petición
   pasa de 2 a 8 centavos de dólar, que sigue siendo un techo razonable
   para algo que requiere sesión iniciada. */
const MAX_TOKENS = 8000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Solo se aceptan peticiones POST." } });
  }

  if (!origenValido(req)) {
    return res.status(403).json({ error: { message: "Origen no autorizado." } });
  }

  const yo = await quienLlama(req);
  if (!yo) {
    return res.status(401).json({
      error: { message: "Necesitás una sesión abierta para usar el asistente." },
    });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    /* Sin diagnóstico. Estuvo un tiempo devolviendo nombres de variables de
       entorno y su longitud para distinguir "no se desplegó" de "está mal
       cargada"; sirvió para eso y no tiene por qué seguir contándole la
       infraestructura a quien pregunte. Si vuelve a hacer falta, se mira en
       los logs de Vercel, que es donde se miran esas cosas. */
    return res.status(503).json({
      error: {
        message: "Falta la variable ANTHROPIC_API_KEY en el servidor. El resto del " +
          "sistema funciona igual: los diagnósticos se calculan en el navegador.",
      },
    });
  }

  try {
    const cuerpo = typeof req.body === "string" ? JSON.parse(req.body) : { ...(req.body || {}) };
    cuerpo.max_tokens = Math.min(Number(cuerpo.max_tokens) || 1000, MAX_TOKENS);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(cuerpo),
    });

    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: { message: `No se pudo contactar a la API: ${e.message}` } });
  }
}
